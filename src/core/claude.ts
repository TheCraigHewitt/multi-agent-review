import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, unlinkSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { z } from 'zod';

const __dirname = dirname(fileURLToPath(import.meta.url));

export const ReviewOutputSchema = z.object({
  summary: z.string(),
  walkthrough: z.array(
    z.object({
      file: z.string(),
      description: z.string(),
    })
  ),
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

export type ReviewOutput = z.infer<typeof ReviewOutputSchema>;

function loadReviewPrompt(customPromptPath: string | null): string {
  if (customPromptPath && existsSync(customPromptPath)) {
    return readFileSync(customPromptPath, 'utf-8');
  }

  // Bundled prompt — resolve relative to package root
  const bundledPath = join(__dirname, '..', 'prompts', 'default-review.md');
  if (existsSync(bundledPath)) {
    return readFileSync(bundledPath, 'utf-8');
  }

  // Fallback: try source location
  const srcPath = join(__dirname, '..', '..', 'src', 'prompts', 'default-review.md');
  if (existsSync(srcPath)) {
    return readFileSync(srcPath, 'utf-8');
  }

  throw new Error('Could not find review prompt file');
}

function loadReviewSchema(): object {
  const distPath = join(__dirname, '..', 'prompts', 'review-schema.json');
  if (existsSync(distPath)) {
    return JSON.parse(readFileSync(distPath, 'utf-8'));
  }

  const srcPath = join(__dirname, '..', '..', 'src', 'prompts', 'review-schema.json');
  if (existsSync(srcPath)) {
    return JSON.parse(readFileSync(srcPath, 'utf-8'));
  }

  throw new Error('Could not find review schema file');
}

export interface ReviewOptions {
  model: string;
  cwd: string;
  customPromptPath: string | null;
  maxDiffLines: number;
}

export function truncateDiff(diff: string, maxLines: number): string {
  const diffLines = diff.split('\n');
  if (diffLines.length <= maxLines) return diff;
  return (
    diffLines.slice(0, maxLines).join('\n') +
    `\n\n[... truncated at ${maxLines} lines, ${diffLines.length - maxLines} lines omitted ...]`
  );
}

export function buildReviewPayload(
  diff: string,
  commitLog: string,
  diffStat: string,
  options: Pick<ReviewOptions, 'customPromptPath' | 'maxDiffLines'>
): { systemPrompt: string; userMessage: string; schema: object } {
  const systemPrompt = loadReviewPrompt(options.customPromptPath);
  const schema = loadReviewSchema();
  const truncated = truncateDiff(diff, options.maxDiffLines);
  const userMessage = `## Commit Log\n${commitLog}\n\n## Diff Summary\n${diffStat}\n\n## Full Diff\n${truncated}`;
  return { systemPrompt, userMessage, schema };
}

export async function runReview(
  diff: string,
  commitLog: string,
  diffStat: string,
  options: ReviewOptions
): Promise<ReviewOutput> {
  const { systemPrompt, userMessage, schema } = buildReviewPayload(
    diff, commitLog, diffStat, options
  );

  const pid = process.pid;
  const schemaPath = join(tmpdir(), `mar-schema-${pid}.json`);
  const promptPath = join(tmpdir(), `mar-prompt-${pid}.md`);

  writeFileSync(schemaPath, JSON.stringify(schema));
  writeFileSync(promptPath, systemPrompt);

  try {
    const cmd = [
      'claude',
      '-p',
      '--model', options.model,
      '--output-format', 'json',
      '--json-schema', schemaPath,
      '--allowedTools', 'Read,Glob,Grep',
      '--append-system-prompt', `"$(cat ${promptPath})"`,
    ].join(' ');

    const result = execSync(cmd, {
      cwd: options.cwd,
      encoding: 'utf-8',
      input: userMessage,
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: '/bin/sh',
      maxBuffer: 10 * 1024 * 1024,
      timeout: 5 * 60 * 1000, // 5 minute timeout
    });

    const parsed = JSON.parse(result);
    return ReviewOutputSchema.parse(parsed);
  } finally {
    try { unlinkSync(schemaPath); } catch {}
    try { unlinkSync(promptPath); } catch {}
  }
}
