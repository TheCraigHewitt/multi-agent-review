import * as core from '@actions/core';
import * as github from '@actions/github';
import Anthropic from '@anthropic-ai/sdk';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';

// Inlined schema — matches src/core/claude.ts ReviewOutputSchema
const ReviewOutputSchema = z.object({
  summary: z.string(),
  walkthrough: z.array(z.object({ file: z.string(), description: z.string() })),
  findings: z.array(
    z.object({
      file: z.string(),
      line: z.number(),
      severity: z.enum(['critical', 'warning', 'suggestion']),
      comment: z.string(),
      suggestion: z.string().optional(),
    })
  ),
  verdict: z.enum(['clean', 'minor_issues', 'major_issues', 'critical']),
});

type ReviewOutput = z.infer<typeof ReviewOutputSchema>;
type Verdict = ReviewOutput['verdict'];

interface Finding {
  file: string;
  line: number;
  severity: 'critical' | 'warning' | 'suggestion';
  comment: string;
  suggestion?: string;
}

// Inlined formatting — matches src/core/github.ts
function formatReviewBody(
  summary: string,
  walkthrough: { file: string; description: string }[],
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

function formatInlineComment(finding: Finding): string {
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

async function run(): Promise<void> {
  try {
    const apiKey = core.getInput('anthropic_api_key', { required: true });
    const model = core.getInput('model') || 'claude-sonnet-4-6';
    const maxDiffLines = parseInt(core.getInput('max_diff_lines') || '5000', 10);

    const context = github.context;
    if (!context.payload.pull_request) {
      core.info('Not a pull request event, skipping.');
      return;
    }

    const pr = context.payload.pull_request;
    const baseSha = pr.base.sha as string;
    const headSha = pr.head.sha as string;
    const repo = `${context.repo.owner}/${context.repo.repo}`;
    const prNumber = pr.number as number;

    core.info(`Reviewing PR #${prNumber} in ${repo}`);

    // Get diff
    const diff = execSync(`git diff ${baseSha}...${headSha}`, {
      encoding: 'utf-8',
      maxBuffer: 10 * 1024 * 1024,
    }).trim();

    if (!diff) {
      core.info('No diff found, skipping review.');
      return;
    }

    const diffStat = execSync(`git diff --stat ${baseSha}...${headSha}`, {
      encoding: 'utf-8',
      maxBuffer: 1024 * 1024,
    }).trim();

    const commitLog = execSync(`git log --oneline --no-decorate ${baseSha}..${headSha}`, {
      encoding: 'utf-8',
      maxBuffer: 1024 * 1024,
    }).trim();

    // Truncate diff
    const diffLines = diff.split('\n');
    const truncated =
      diffLines.length > maxDiffLines
        ? diffLines.slice(0, maxDiffLines).join('\n') +
          `\n\n[... truncated at ${maxDiffLines} lines, ${diffLines.length - maxDiffLines} lines omitted ...]`
        : diff;

    // Load prompt from repo checkout
    let systemPrompt: string;
    try {
      systemPrompt = readFileSync(
        join(process.cwd(), 'src', 'prompts', 'default-review.md'),
        'utf-8'
      );
    } catch {
      // Fallback inline prompt
      systemPrompt = `You are a senior code reviewer. Review the diff for security vulnerabilities, bugs, performance issues, and convention violations. Only report specific, actionable issues. If the code looks good, return empty findings.`;
    }

    const userMessage = `## Commit Log\n${commitLog}\n\n## Diff Summary\n${diffStat}\n\n## Full Diff\n${truncated}`;

    // Call Anthropic API
    core.info('Calling Claude for review...');
    const client = new Anthropic({ apiKey });

    const response = await client.messages.create({
      model,
      max_tokens: 8192,
      system: systemPrompt + '\n\nReturn your review as JSON matching this schema: summary (string), walkthrough (array of {file, description}), findings (array of {file, line, severity, comment, suggestion?}), verdict (clean|minor_issues|major_issues|critical).',
      messages: [{ role: 'user', content: userMessage }],
    });

    // Extract text from response
    const textBlock = response.content.find((b) => b.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      throw new Error('No text response from Claude');
    }

    // Parse JSON from response (handle markdown code blocks)
    let jsonText = textBlock.text.trim();
    const jsonMatch = jsonText.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
    if (jsonMatch) {
      jsonText = jsonMatch[1].trim();
    }

    const reviewOutput = ReviewOutputSchema.parse(JSON.parse(jsonText));

    core.info(`Review: ${reviewOutput.verdict} (${reviewOutput.findings.length} findings)`);

    // Format review
    const body = formatReviewBody(
      reviewOutput.summary,
      reviewOutput.walkthrough,
      reviewOutput.verdict,
      reviewOutput.findings.length
    );

    const comments = reviewOutput.findings.map((f) => ({
      path: f.file,
      line: f.line,
      body: formatInlineComment(f),
    }));

    // Post review via gh CLI (GITHUB_TOKEN is available in Actions)
    const payload = {
      commit_id: headSha,
      body,
      event: 'COMMENT',
      comments,
    };

    execSync(
      `gh api repos/${repo}/pulls/${prNumber}/reviews --method POST --input -`,
      {
        encoding: 'utf-8',
        input: JSON.stringify(payload),
        stdio: ['pipe', 'pipe', 'pipe'],
      }
    );

    core.info('Review posted successfully.');

    // Set outputs
    core.setOutput('verdict', reviewOutput.verdict);
    core.setOutput('findings_count', reviewOutput.findings.length.toString());
  } catch (error) {
    core.setFailed((error as Error).message);
  }
}

run();
