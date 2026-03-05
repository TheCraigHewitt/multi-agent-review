import { execSync } from 'node:child_process';

function gh(args: string, cwd: string): string {
  return execSync(`gh ${args}`, {
    cwd,
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
    maxBuffer: 5 * 1024 * 1024,
  }).trim();
}

export interface PRInfo {
  number: number;
  headRefName: string;
  url: string;
}

export interface InlineComment {
  path: string;
  line: number;
  body: string;
}

export interface ExistingReview {
  id: number;
  body: string;
}

export function findPR(
  repo: string,
  branch: string,
  cwd: string
): PRInfo | null {
  try {
    const result = gh(
      `pr list --repo ${repo} --head ${branch} --json number,headRefName,url --limit 1`,
      cwd
    );
    const prs = JSON.parse(result);
    if (prs.length === 0) return null;
    return prs[0] as PRInfo;
  } catch {
    return null;
  }
}

export function findExistingReview(
  repo: string,
  prNumber: number,
  cwd: string
): ExistingReview | null {
  try {
    const result = gh(
      `api repos/${repo}/pulls/${prNumber}/reviews --jq '[.[] | select(.body | contains("multi-agent-review"))] | last'`,
      cwd
    );
    if (!result || result === 'null') return null;
    const review = JSON.parse(result);
    return { id: review.id, body: review.body };
  } catch {
    return null;
  }
}

export function postReview(
  repo: string,
  prNumber: number,
  commitSha: string,
  body: string,
  comments: InlineComment[],
  cwd: string
): number {
  const payload = {
    commit_id: commitSha,
    body,
    event: 'COMMENT',
    comments: comments.map((c) => ({
      path: c.path,
      line: c.line,
      body: c.body,
    })),
  };

  const result = execSync(
    `gh api repos/${repo}/pulls/${prNumber}/reviews --method POST --input -`,
    {
      cwd,
      encoding: 'utf-8',
      input: JSON.stringify(payload),
      stdio: ['pipe', 'pipe', 'pipe'],
    }
  ).trim();

  const parsed = JSON.parse(result);
  return parsed.id;
}

export function updateReview(
  repo: string,
  prNumber: number,
  reviewId: number,
  body: string,
  cwd: string
): void {
  execSync(
    `gh api repos/${repo}/pulls/${prNumber}/reviews/${reviewId} --method PUT --input -`,
    {
      cwd,
      encoding: 'utf-8',
      input: JSON.stringify({ body }),
      stdio: ['pipe', 'pipe', 'pipe'],
    }
  );
}

export type Verdict = 'clean' | 'minor_issues' | 'major_issues' | 'critical';

export interface WalkthroughEntry {
  file: string;
  description: string;
}

export function formatReviewBody(
  summary: string,
  walkthrough: WalkthroughEntry[],
  verdict: Verdict,
  findingsCount: number
): string {
  const verdictLabels: Record<Verdict, string> = {
    clean: 'No issues found',
    minor_issues: 'Minor issues found',
    major_issues: 'Major issues found',
    critical: 'Critical issues found',
  };

  const walkthroughRows = walkthrough
    .map((w) => `| \`${w.file}\` | ${w.description} |`)
    .join('\n');

  const walkthroughSection =
    walkthrough.length > 0
      ? `
<details>
<summary>Walkthrough (${walkthrough.length} files changed)</summary>

| File | Change |
|------|--------|
${walkthroughRows}

</details>`
      : '';

  return `## Code Review

**Verdict:** ${verdictLabels[verdict]}${findingsCount > 0 ? ` (${findingsCount} finding${findingsCount === 1 ? '' : 's'})` : ''}

**Summary:** ${summary}
${walkthroughSection}

---
*Reviewed by [multi-agent-review](https://github.com/TheCraigHewitt/multi-agent-review) using Claude Code*`;
}

export interface Finding {
  file: string;
  line: number;
  severity: 'critical' | 'warning' | 'suggestion';
  comment: string;
  suggestion?: string;
}

export function formatInlineComment(finding: Finding): string {
  const badges: Record<string, string> = {
    critical: '**critical**',
    warning: '**warning**',
    suggestion: '**suggestion**',
  };

  let body = `${badges[finding.severity]} ${finding.comment}`;

  if (finding.suggestion) {
    body += `\n\n\`\`\`suggestion\n${finding.suggestion}\n\`\`\``;
  }

  return body;
}
