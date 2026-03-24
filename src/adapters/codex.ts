import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import yaml from 'js-yaml';
import { loadAgentManifest, loadFileIfExists } from '../utils/loader.js';
import { loadAllSkills, getAllowedTools, type ParsedSkill } from '../utils/skill-loader.js';
import { buildComplianceSection } from './shared.js';

/**
 * Export a gitagent to OpenAI Codex CLI format.
 *
 * Codex uses:
 *   - `~/.codex/AGENTS.md`           Global instructions (identity + rules)
 *   - `~/.codex/skills/X/SKILL.md`   Skills with YAML frontmatter (same as gitagent)
 *   - Per-project `AGENTS.md`        Project-level overrides
 *
 * Mapping:
 *   - SOUL.md + RULES.md + DUTIES.md  → `AGENTS.md`   (concatenated)
 *   - Each skill                      → `skills/<name>/SKILL.md` (passed through)
 *   - Knowledge (always_load docs)    → Appended to `AGENTS.md` as reference sections
 *   - Compliance                      → Appended to `AGENTS.md` as constraints
 *
 * Lossy:
 *   - Sub-agents (agents/) are not exported — Codex subagent format is undocumented
 *   - Tools (tools/) are not exported — Codex uses its own MCP config
 *   - Knowledge activation conditions are ignored — only always_load docs are included
 *   - Hooks and config are not exported
 */

export interface CodexFile {
  /** Relative path from the output root (e.g., "AGENTS.md" or "skills/review/SKILL.md") */
  path: string;
  /** File content */
  content: string;
}

export interface CodexExport {
  files: CodexFile[];
}

export function exportToCodex(dir: string): CodexExport {
  const agentDir = resolve(dir);
  const manifest = loadAgentManifest(agentDir);

  const files: CodexFile[] = [];

  // Load skills once — used for both AGENTS.md summary and file passthrough
  const skillsDir = join(agentDir, 'skills');
  const skills = loadAllSkills(skillsDir);

  // --- AGENTS.md: global instructions ---
  const agentsMd = buildAgentsMd(agentDir, manifest, skills);
  files.push({ path: 'AGENTS.md', content: agentsMd });

  // --- Skills: reconstruct SKILL.md from parsed data ---
  for (const skill of skills) {
    const skillDirName = skill.directory.split('/').pop()!;
    const fm = skill.frontmatter;

    // Reconstruct the SKILL.md with frontmatter + body
    const frontmatter = yaml.dump(
      { name: fm.name, description: fm.description, ...(fm['allowed-tools'] ? { 'allowed-tools': fm['allowed-tools'] } : {}) },
      { lineWidth: 120 },
    ).trimEnd();
    const content = `---\n${frontmatter}\n---\n\n${skill.instructions}\n`;

    files.push({
      path: `skills/${skillDirName}/SKILL.md`,
      content,
    });
  }

  return { files };
}

/**
 * Export as a single string showing the files that would be written.
 * Used by `gitagent export --format codex`.
 */
export function exportToCodexString(dir: string): string {
  const exp = exportToCodex(dir);
  const parts: string[] = [];

  for (const file of exp.files) {
    parts.push(`# === ${file.path} ===`);
    parts.push(file.content.trimEnd());
    parts.push('');
  }

  return parts.join('\n').trimEnd() + '\n';
}

/**
 * Build the AGENTS.md content from SOUL.md, RULES.md, DUTIES.md,
 * compliance config, and always-loaded knowledge documents.
 */
function buildAgentsMd(
  agentDir: string,
  manifest: ReturnType<typeof loadAgentManifest>,
  skills: ParsedSkill[],
): string {
  const parts: string[] = [];

  // Header
  parts.push(`# ${manifest.name}`);
  parts.push(`${manifest.description}\n`);

  // Identity
  const soul = loadFileIfExists(join(agentDir, 'SOUL.md'));
  if (soul) {
    parts.push(soul.trim());
  }

  // Constraints
  const rules = loadFileIfExists(join(agentDir, 'RULES.md'));
  if (rules) {
    parts.push(rules.trim());
  }

  // Duties / delegation
  const duties = loadFileIfExists(join(agentDir, 'DUTIES.md'));
  if (duties) {
    parts.push(duties.trim());
  }

  // Skills summary (progressive disclosure — point to full files)
  if (skills.length > 0) {
    const skillLines: string[] = ['## Skills\n'];
    for (const skill of skills) {
      const skillDirName = skill.directory.split('/').pop()!;
      skillLines.push(`### ${skill.frontmatter.name}`);
      skillLines.push(skill.frontmatter.description);
      const tools = getAllowedTools(skill.frontmatter);
      if (tools.length > 0) {
        skillLines.push(`Allowed tools: ${tools.join(', ')}`);
      }
      skillLines.push(`Full instructions: \`skills/${skillDirName}/SKILL.md\``);
      skillLines.push('');
    }
    parts.push(skillLines.join('\n'));
  }

  // Compliance constraints
  if (manifest.compliance) {
    const complianceSection = buildComplianceSection(manifest.compliance);
    if (complianceSection) {
      parts.push(complianceSection);
    }
  }

  // Knowledge (always_load documents — same pattern as claude-code.ts)
  const knowledgeDir = join(agentDir, 'knowledge');
  const indexPath = join(knowledgeDir, 'index.yaml');
  if (existsSync(indexPath)) {
    const index = yaml.load(readFileSync(indexPath, 'utf-8')) as {
      documents?: Array<{ path: string; always_load?: boolean }>;
    };

    if (index.documents) {
      const alwaysLoad = index.documents.filter(d => d.always_load);
      for (const doc of alwaysLoad) {
        const content = loadFileIfExists(join(knowledgeDir, doc.path));
        if (content) {
          parts.push(`## Reference: ${doc.path}\n\n${content.trim()}`);
        }
      }
    }
  }

  return parts.join('\n\n') + '\n';
}
