import { Command } from 'commander';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { initCommand } from './commands/init.js';
import { reviewCommand } from './commands/review.js';
import { statusCommand } from './commands/status.js';
import { notifyHandlerCommand } from './commands/notify-handler.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(
  readFileSync(join(__dirname, '..', 'package.json'), 'utf-8')
);

const program = new Command();

program
  .name('mar')
  .description('Multi-agent review — Claude Code reviews for AI-authored PRs')
  .version(pkg.version);

program
  .command('init')
  .description('Initialize multi-agent-review in the current project')
  .action(initCommand);

program
  .command('review [branch]')
  .description('Review a branch and post findings to its PR')
  .option('--cwd <dir>', 'Working directory (for notify handler)')
  .action(reviewCommand);

program
  .command('status')
  .description('Show configuration and recent reviews')
  .action(statusCommand);

program
  .command('notify-handler')
  .description('Handle Codex notify events (called automatically)')
  .argument('[payload]', 'JSON payload from Codex')
  .action(notifyHandlerCommand);

program.parse();
