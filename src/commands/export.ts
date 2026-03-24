import { Command } from 'commander';
import { resolve } from 'node:path';
import { error, heading, info, success } from '../utils/format.js';
import {
  exportToSystemPrompt,
  exportToClaudeCode,
  exportToOpenAI,
  exportToCrewAI,
  exportToOpenClawString,
  exportToNanobotString,
  exportToCopilotString,
  exportToOpenCodeString,
  exportToCursorString,
  exportToCodexString,
} from '../adapters/index.js';
import { exportToLyzrString } from '../adapters/lyzr.js';
import { exportToGitHubString } from '../adapters/github.js';

type ExportFn = (dir: string) => string;

const adapters: Record<string, ExportFn> = {
  'system-prompt': exportToSystemPrompt,
  'claude-code': exportToClaudeCode,
  'openai': exportToOpenAI,
  'crewai': exportToCrewAI,
  'openclaw': exportToOpenClawString,
  'nanobot': exportToNanobotString,
  'lyzr': exportToLyzrString,
  'github': exportToGitHubString,
  'copilot': exportToCopilotString,
  'opencode': exportToOpenCodeString,
  'cursor': exportToCursorString,
  'codex': exportToCodexString,
};

const supportedFormats = Object.keys(adapters).join(', ');

interface ExportOptions {
  format: string;
  dir: string;
  output: string | undefined;
}

export const exportCommand = new Command('export')
  .description('Export agent to other formats')
  .requiredOption('-f, --format <format>', `Export format (${supportedFormats})`)
  .option('-d, --dir <dir>', 'Agent directory', '.')
  .option('-o, --output <output>', 'Output file path')
  .action(async (options: ExportOptions) => {
    const dir = resolve(options.dir);

    heading('Exporting agent');
    info(`Format: ${options.format}`);

    try {
      const adapter = adapters[options.format];
      if (!adapter) {
        error(`Unknown format: ${options.format}`);
        info(`Supported formats: ${supportedFormats}`);
        process.exit(1);
      }

      const result = adapter(dir);

      if (options.output) {
        const { writeFileSync } = await import('node:fs');
        writeFileSync(resolve(options.output), result, 'utf-8');
        success(`Exported to ${options.output}`);
      } else {
        console.log(result);
      }
    } catch (e) {
      error((e as Error).message);
      process.exit(1);
    }
  });
