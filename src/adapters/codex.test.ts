/**
 * Tests for the Codex adapter (export).
 *
 * Uses Node.js built-in test runner (node --test).
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { exportToCodex, exportToCodexString } from './codex.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a minimal gitagent directory in a temp folder. */
function makeAgentDir(opts: {
  name?: string;
  description?: string;
  soul?: string;
  rules?: string;
  duties?: string;
  skills?: Array<{ name: string; description: string; instructions: string }>;
}): string {
  const dir = mkdtempSync(join(tmpdir(), 'gitagent-codex-test-'));

  const manifest = {
    spec_version: '0.1.0',
    name: opts.name ?? 'test-agent',
    version: '0.1.0',
    description: opts.description ?? 'A test agent',
  };

  writeFileSync(
    join(dir, 'agent.yaml'),
    `spec_version: '0.1.0'\nname: ${manifest.name}\nversion: '0.1.0'\ndescription: '${manifest.description}'\n`,
    'utf-8',
  );

  if (opts.soul !== undefined) {
    writeFileSync(join(dir, 'SOUL.md'), opts.soul, 'utf-8');
  }

  if (opts.rules !== undefined) {
    writeFileSync(join(dir, 'RULES.md'), opts.rules, 'utf-8');
  }

  if (opts.duties !== undefined) {
    writeFileSync(join(dir, 'DUTIES.md'), opts.duties, 'utf-8');
  }

  if (opts.skills) {
    const skillsDir = join(dir, 'skills');
    mkdirSync(skillsDir);
    for (const skill of opts.skills) {
      const skillDir = join(skillsDir, skill.name);
      mkdirSync(skillDir);
      writeFileSync(
        join(skillDir, 'SKILL.md'),
        `---\nname: ${skill.name}\ndescription: ${skill.description}\n---\n\n${skill.instructions}`,
        'utf-8',
      );
    }
  }

  return dir;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('exportToCodex', () => {
  test('produces AGENTS.md with soul and rules', () => {
    const dir = makeAgentDir({
      soul: '# Soul\nI am a helpful assistant.',
      rules: '# Rules\n- Be concise',
    });

    const result = exportToCodex(dir);
    const agentsMd = result.files.find(f => f.path === 'AGENTS.md');

    assert.ok(agentsMd, 'AGENTS.md should be present');
    assert.ok(agentsMd.content.includes('I am a helpful assistant'), 'should contain soul');
    assert.ok(agentsMd.content.includes('Be concise'), 'should contain rules');
  });

  test('produces AGENTS.md with duties', () => {
    const dir = makeAgentDir({
      soul: '# Soul\nI orchestrate.',
      duties: '# Duties\n- Route to specialists',
    });

    const result = exportToCodex(dir);
    const agentsMd = result.files.find(f => f.path === 'AGENTS.md');

    assert.ok(agentsMd, 'AGENTS.md should be present');
    assert.ok(agentsMd.content.includes('Route to specialists'), 'should contain duties');
  });

  test('includes skills as separate files', () => {
    const dir = makeAgentDir({
      soul: '# Soul\nI review code.',
      skills: [
        { name: 'code-review', description: 'Review code', instructions: 'Check for bugs.' },
        { name: 'security-audit', description: 'Audit security', instructions: 'Check OWASP Top 10.' },
      ],
    });

    const result = exportToCodex(dir);

    assert.equal(result.files.length, 3, 'should have AGENTS.md + 2 skills');

    const review = result.files.find(f => f.path === 'skills/code-review/SKILL.md');
    assert.ok(review, 'code-review skill should be present');
    assert.ok(review.content.includes('Check for bugs'), 'skill content should be preserved');

    const audit = result.files.find(f => f.path === 'skills/security-audit/SKILL.md');
    assert.ok(audit, 'security-audit skill should be present');
  });

  test('AGENTS.md includes skill summaries with progressive disclosure', () => {
    const dir = makeAgentDir({
      skills: [
        { name: 'review', description: 'Code review', instructions: 'Detailed instructions here.' },
      ],
    });

    const result = exportToCodex(dir);
    const agentsMd = result.files.find(f => f.path === 'AGENTS.md');

    assert.ok(agentsMd, 'AGENTS.md should be present');
    assert.ok(agentsMd.content.includes('## Skills'), 'should have skills section');
    assert.ok(agentsMd.content.includes('### review'), 'should list skill name');
    assert.ok(agentsMd.content.includes('skills/review/SKILL.md'), 'should reference full file');
  });

  test('minimal agent produces valid output', () => {
    const dir = makeAgentDir({});

    const result = exportToCodex(dir);
    assert.equal(result.files.length, 1, 'should have just AGENTS.md');
    assert.ok(result.files[0].content.includes('test-agent'), 'should contain agent name');
  });
});

describe('exportToCodexString', () => {
  test('wraps files with path headers', () => {
    const dir = makeAgentDir({
      soul: '# Soul\nI exist.',
      skills: [{ name: 'test-skill', description: 'Test', instructions: 'Do testing.' }],
    });

    const result = exportToCodexString(dir);

    assert.ok(result.includes('# === AGENTS.md ==='), 'should have AGENTS.md header');
    assert.ok(result.includes('# === skills/test-skill/SKILL.md ==='), 'should have skill header');
  });
});
