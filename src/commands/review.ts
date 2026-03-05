import { findProjectRoot, loadConfig } from '../config/loader.js';
import { getCurrentBranch } from '../core/git.js';
import { reviewBranch, type ReviewResult } from '../core/reviewer.js';

export async function reviewCommand(
  branch: string | undefined,
  options: { cwd?: string; dryRun?: boolean }
): Promise<void> {
  const projectRoot = options.cwd ?? findProjectRoot();
  const config = loadConfig(projectRoot);

  const targetBranch = branch ?? getCurrentBranch(projectRoot);

  if (targetBranch === config.baseBranch) {
    console.error(
      `Error: Cannot review the base branch (${config.baseBranch}).`
    );
    process.exit(1);
  }

  try {
    const result = await reviewBranch(targetBranch, config, projectRoot, {
      dryRun: options.dryRun ?? false,
    });
    printResult(result);
  } catch (err) {
    console.error(`Review failed: ${(err as Error).message}`);
    process.exit(1);
  }
}

function printResult(result: ReviewResult): void {
  if (result.dryRun) {
    console.log('\n--- Dry Run (not posted) ---');
  } else {
    console.log('\n--- Review Posted ---');
  }
  console.log(`Branch:   ${result.branch}`);
  if (result.prNumber) {
    console.log(`PR:       #${result.prNumber} (${result.prUrl})`);
  }
  console.log(`Verdict:  ${result.verdict}`);
  console.log(`Findings: ${result.findingsCount}`);
  console.log(`Summary:  ${result.summary}`);
}
