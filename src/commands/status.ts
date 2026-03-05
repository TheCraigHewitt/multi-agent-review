import { findProjectRoot, loadConfig, loadState } from '../config/loader.js';
import { isCodexConfigured } from '../config/codex.js';

export async function statusCommand(): Promise<void> {
  let projectRoot: string;
  try {
    projectRoot = findProjectRoot();
  } catch {
    console.error('Error: Not in a git repository.');
    process.exit(1);
  }

  let config;
  try {
    config = loadConfig(projectRoot);
  } catch {
    console.log('Not initialized. Run "mar init" first.');
    return;
  }

  console.log('Configuration:');
  console.log(`  Repo:         ${config.repo}`);
  console.log(`  Base branch:  ${config.baseBranch}`);
  console.log(`  Branch match: ${config.branchPattern}`);
  console.log(`  Model:        ${config.model}`);
  console.log(`  Max diff:     ${config.maxDiffLines} lines`);
  console.log(
    `  Custom prompt: ${config.reviewPrompt ?? 'none (using default)'}`
  );

  console.log(`\nCodex notify: ${isCodexConfigured() ? 'configured' : 'not configured'}`);

  const state = loadState(projectRoot);
  if (state.reviews.length === 0) {
    console.log('\nNo reviews yet.');
    return;
  }

  console.log(`\nRecent reviews (${state.reviews.length} total):`);
  const recent = state.reviews.slice(-5).reverse();
  for (const review of recent) {
    const date = new Date(review.timestamp).toLocaleString();
    console.log(
      `  PR #${review.prNumber} | ${review.branch} | ${review.verdict} | ${review.findingsCount} findings | ${date}`
    );
  }
}
