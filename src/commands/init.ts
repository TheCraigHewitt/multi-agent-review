import { existsSync, readFileSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  findProjectRoot,
  detectRepo,
  detectBaseBranch,
  saveConfig,
  getMarDir,
  saveState,
} from '../config/loader.js';
import { addCodexNotify, isCodexConfigured, getCodexConfigPath } from '../config/codex.js';
import { DEFAULT_CONFIG, type Config } from '../config/types.js';

export async function initCommand(): Promise<void> {
  let projectRoot: string;
  try {
    projectRoot = findProjectRoot();
  } catch {
    console.error('Error: Not in a git repository.');
    process.exit(1);
  }

  const marDir = getMarDir(projectRoot);
  const configPath = join(marDir, 'config.json');

  if (existsSync(configPath)) {
    console.log(`Already initialized at ${configPath}`);
    console.log('To reconfigure, delete .mar/config.json and run init again.');
    return;
  }

  // Detect repo
  const repo = detectRepo(projectRoot);
  if (!repo) {
    console.error(
      'Error: Could not detect GitHub repo from git remotes.\n' +
        'Make sure origin points to a GitHub repository.'
    );
    process.exit(1);
  }

  // Detect base branch
  const baseBranch = detectBaseBranch(projectRoot);

  const config: Config = {
    repo,
    baseBranch,
    branchPattern: DEFAULT_CONFIG.branchPattern!,
    model: DEFAULT_CONFIG.model!,
    reviewPrompt: DEFAULT_CONFIG.reviewPrompt!,
    maxDiffLines: DEFAULT_CONFIG.maxDiffLines!,
  };

  // Save config
  saveConfig(config, projectRoot);
  console.log(`Created ${configPath}`);

  // Initialize state
  saveState({ reviews: [], lastChecked: {} }, projectRoot);
  console.log(`Created ${join(marDir, 'state.json')}`);

  // Add .mar/ to .gitignore
  const gitignorePath = join(projectRoot, '.gitignore');
  if (existsSync(gitignorePath)) {
    const content = readFileSync(gitignorePath, 'utf-8');
    if (!content.includes('.mar/')) {
      appendFileSync(gitignorePath, '\n.mar/\n');
      console.log('Added .mar/ to .gitignore');
    }
  } else {
    appendFileSync(gitignorePath, '.mar/\n');
    console.log('Created .gitignore with .mar/');
  }

  // Configure Codex notify
  if (!isCodexConfigured()) {
    addCodexNotify();
    console.log(`Updated Codex config: ${getCodexConfigPath()}`);
  } else {
    console.log('Codex notify already configured');
  }

  console.log('\nSetup complete:');
  console.log(`  Repo:         ${config.repo}`);
  console.log(`  Base branch:  ${config.baseBranch}`);
  console.log(`  Branch match: ${config.branchPattern}`);
  console.log(`  Model:        ${config.model}`);
  console.log(
    '\nCodex will now notify mar when it finishes a turn.'
  );
  console.log('You can also run reviews manually: mar review <branch>');
}
