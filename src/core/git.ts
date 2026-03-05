import { execSync } from 'node:child_process';
import { resolve } from 'node:path';

function git(args: string, cwd: string): string {
  return execSync(`git ${args}`, {
    cwd,
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
    maxBuffer: 10 * 1024 * 1024, // 10MB for large diffs
  }).trim();
}

export function getCurrentBranch(cwd: string): string {
  return git('rev-parse --abbrev-ref HEAD', cwd);
}

export function getLatestCommit(cwd: string, branch?: string): string {
  const ref = branch ?? 'HEAD';
  return git(`rev-parse ${ref}`, cwd);
}

export function getMergeBase(
  branch: string,
  baseBranch: string,
  cwd: string
): string {
  return git(`merge-base ${baseBranch} ${branch}`, cwd);
}

export function getDiff(
  mergeBase: string,
  branch: string,
  cwd: string
): string {
  return git(`diff ${mergeBase}...${branch}`, cwd);
}

export function getDiffStat(
  mergeBase: string,
  branch: string,
  cwd: string
): string {
  return git(`diff --stat ${mergeBase}...${branch}`, cwd);
}

export function getCommitLog(
  mergeBase: string,
  branch: string,
  cwd: string
): string {
  return git(
    `log --oneline --no-decorate ${mergeBase}..${branch}`,
    cwd
  );
}

export function getRepoRoot(cwd: string): string {
  // Resolve worktree to main repo via git-common-dir
  const commonDir = git('rev-parse --git-common-dir', cwd);
  if (commonDir === '.git') {
    return git('rev-parse --show-toplevel', cwd);
  }
  // commonDir is an absolute or relative path to the main .git dir
  const gitDir = resolve(cwd, commonDir);
  // Main repo root is parent of .git dir
  return resolve(gitDir, '..');
}

export function branchMatchesPattern(
  branch: string,
  pattern: string
): boolean {
  // Convert glob pattern to regex: codex/* -> ^codex\/.*$
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*');
  return new RegExp(`^${escaped}$`).test(branch);
}

export function fetchBranch(branch: string, cwd: string): void {
  try {
    git(`fetch origin ${branch}`, cwd);
  } catch {
    // Branch may only exist locally
  }
}
