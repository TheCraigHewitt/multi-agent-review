import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { getRepoRoot, getCurrentBranch, getLatestCommit, branchMatchesPattern } from '../core/git.js';
import { findPR } from '../core/github.js';
import { loadConfig, loadState, getMarDir } from '../config/loader.js';

export async function notifyHandlerCommand(
  payload: string | undefined
): Promise<void> {
  try {
    await handleNotify(payload);
  } catch {
    // Notify handler must never crash or block Codex
    process.exit(0);
  }
}

async function handleNotify(payload: string | undefined): Promise<void> {
  // Parse Codex payload
  let cwd: string;
  if (payload) {
    try {
      const data = JSON.parse(payload);
      cwd = data.cwd ?? process.cwd();
    } catch {
      // Invalid JSON — use cwd
      cwd = process.cwd();
    }
  } else {
    cwd = process.cwd();
  }

  // Resolve to repo root (handles worktrees)
  let projectRoot: string;
  try {
    projectRoot = getRepoRoot(cwd);
  } catch {
    return; // Not a git repo
  }

  // Check if mar is initialized
  if (!existsSync(join(getMarDir(projectRoot), 'config.json'))) {
    return;
  }

  const config = loadConfig(projectRoot);

  // Get current branch
  let branch: string;
  try {
    branch = getCurrentBranch(cwd);
  } catch {
    return;
  }

  // Check branch pattern
  if (!branchMatchesPattern(branch, config.branchPattern)) {
    return;
  }

  // Check for new commits since last review
  const state = loadState(projectRoot);
  const currentCommit = getLatestCommit(cwd);
  const lastReviewed = state.lastChecked[branch];
  if (lastReviewed === currentCommit) {
    return; // No new commits
  }

  // Check for open PR (this is the network call)
  const pr = findPR(config.repo, branch, projectRoot);
  if (!pr) {
    return; // No open PR
  }

  // Spawn review as detached background process
  const child = spawn('mar', ['review', branch, '--cwd', projectRoot], {
    detached: true,
    stdio: 'ignore',
    cwd: projectRoot,
  });
  child.unref();
}
