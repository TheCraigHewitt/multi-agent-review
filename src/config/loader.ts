import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { execSync } from 'node:child_process';
import { ConfigSchema, StateSchema, type Config, type State } from './types.js';

export function findProjectRoot(startDir?: string): string {
  const cwd = startDir ?? process.cwd();
  try {
    const root = execSync('git rev-parse --show-toplevel', {
      cwd,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
    return root;
  } catch {
    throw new Error(`Not a git repository: ${cwd}`);
  }
}

export function getMarDir(projectRoot: string): string {
  return join(projectRoot, '.mar');
}

export function loadConfig(projectRoot?: string): Config {
  const root = projectRoot ?? findProjectRoot();
  const configPath = join(getMarDir(root), 'config.json');

  if (!existsSync(configPath)) {
    throw new Error(
      `No .mar/config.json found in ${root}. Run "mar init" first.`
    );
  }

  const raw = JSON.parse(readFileSync(configPath, 'utf-8'));
  return ConfigSchema.parse(raw);
}

export function saveConfig(config: Config, projectRoot: string): void {
  const marDir = getMarDir(projectRoot);
  if (!existsSync(marDir)) {
    mkdirSync(marDir, { recursive: true });
  }
  writeFileSync(
    join(marDir, 'config.json'),
    JSON.stringify(config, null, 2) + '\n'
  );
}

export function loadState(projectRoot: string): State {
  const statePath = join(getMarDir(projectRoot), 'state.json');

  if (!existsSync(statePath)) {
    return { reviews: [], lastChecked: {} };
  }

  const raw = JSON.parse(readFileSync(statePath, 'utf-8'));
  return StateSchema.parse(raw);
}

export function saveState(state: State, projectRoot: string): void {
  const marDir = getMarDir(projectRoot);
  if (!existsSync(marDir)) {
    mkdirSync(marDir, { recursive: true });
  }
  writeFileSync(
    join(marDir, 'state.json'),
    JSON.stringify(state, null, 2) + '\n'
  );
}

export function detectRepo(projectRoot: string): string | null {
  try {
    const remoteUrl = execSync('git remote get-url origin', {
      cwd: projectRoot,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();

    // Handle SSH: git@github.com:owner/repo.git
    const sshMatch = remoteUrl.match(/git@github\.com:([^/]+\/[^/.]+)/);
    if (sshMatch) return sshMatch[1];

    // Handle HTTPS: https://github.com/owner/repo.git
    const httpsMatch = remoteUrl.match(/github\.com\/([^/]+\/[^/.]+)/);
    if (httpsMatch) return httpsMatch[1];

    return null;
  } catch {
    return null;
  }
}

export function detectBaseBranch(projectRoot: string): string {
  try {
    const result = execSync(
      'git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null || echo refs/remotes/origin/main',
      { cwd: projectRoot, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
    ).trim();
    return result.replace('refs/remotes/origin/', '');
  } catch {
    return 'main';
  }
}
