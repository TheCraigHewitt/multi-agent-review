import {
  getMergeBase,
  getDiff,
  getDiffStat,
  getCommitLog,
  getLatestCommit,
  fetchBranch,
} from './git.js';
import {
  findPR,
  findExistingReview,
  postReview,
  updateReview,
  formatReviewBody,
  formatInlineComment,
  type InlineComment,
  type Verdict,
} from './github.js';
import { runReview, type ReviewOutput } from './claude.js';
import { loadState, saveState } from '../config/loader.js';
import type { Config } from '../config/types.js';

export interface ReviewResult {
  branch: string;
  prNumber: number;
  prUrl: string;
  reviewId: number;
  verdict: string;
  findingsCount: number;
  summary: string;
}

export async function reviewBranch(
  branch: string,
  config: Config,
  projectRoot: string
): Promise<ReviewResult> {
  console.log(`Reviewing branch: ${branch}`);

  // Fetch latest
  fetchBranch(branch, projectRoot);
  fetchBranch(config.baseBranch, projectRoot);

  // Get diff info
  const mergeBase = getMergeBase(branch, `origin/${config.baseBranch}`, projectRoot);
  const diff = getDiff(mergeBase, branch, projectRoot);
  const diffStat = getDiffStat(mergeBase, branch, projectRoot);
  const commitLog = getCommitLog(mergeBase, branch, projectRoot);
  const commitSha = getLatestCommit(projectRoot, branch);

  if (!diff.trim()) {
    throw new Error(`No diff found between ${config.baseBranch} and ${branch}`);
  }

  const diffLineCount = diff.split('\n').length;
  console.log(`Diff: ${diffLineCount} lines across commits:\n${commitLog}`);

  // Find PR
  const pr = findPR(config.repo, branch, projectRoot);
  if (!pr) {
    throw new Error(
      `No open PR found for branch ${branch} in ${config.repo}`
    );
  }
  console.log(`Found PR #${pr.number}: ${pr.url}`);

  // Resolve custom prompt path
  const customPromptPath = config.reviewPrompt
    ? `${projectRoot}/${config.reviewPrompt}`
    : `${projectRoot}/.mar/review-prompt.md`;

  // Run Claude review
  console.log('Running Claude review...');
  const reviewOutput = await runReview(diff, commitLog, diffStat, {
    model: config.model,
    cwd: projectRoot,
    customPromptPath,
    maxDiffLines: config.maxDiffLines,
  });

  console.log(
    `Review complete: ${reviewOutput.verdict} (${reviewOutput.findings.length} findings)`
  );

  // Format review body
  const body = formatReviewBody(
    reviewOutput.summary,
    reviewOutput.walkthrough,
    reviewOutput.verdict as Verdict,
    reviewOutput.findings.length
  );

  // Format inline comments
  const inlineComments: InlineComment[] = reviewOutput.findings.map((f) => ({
    path: f.file,
    line: f.line,
    body: formatInlineComment(f),
  }));

  // Post or update review
  const existing = findExistingReview(config.repo, pr.number, projectRoot);
  let reviewId: number;

  if (existing) {
    console.log(`Updating existing review #${existing.id}`);
    updateReview(config.repo, pr.number, existing.id, body, projectRoot);
    reviewId = existing.id;

    // Post new inline comments separately if there are findings
    if (inlineComments.length > 0) {
      reviewId = postReview(
        config.repo,
        pr.number,
        commitSha,
        body,
        inlineComments,
        projectRoot
      );
    }
  } else {
    reviewId = postReview(
      config.repo,
      pr.number,
      commitSha,
      body,
      inlineComments,
      projectRoot
    );
  }

  // Update state
  const state = loadState(projectRoot);
  state.reviews.push({
    branch,
    prNumber: pr.number,
    commitSha,
    reviewId,
    verdict: reviewOutput.verdict,
    findingsCount: reviewOutput.findings.length,
    timestamp: new Date().toISOString(),
  });
  state.lastChecked[branch] = commitSha;
  saveState(state, projectRoot);

  return {
    branch,
    prNumber: pr.number,
    prUrl: pr.url,
    reviewId,
    verdict: reviewOutput.verdict,
    findingsCount: reviewOutput.findings.length,
    summary: reviewOutput.summary,
  };
}
