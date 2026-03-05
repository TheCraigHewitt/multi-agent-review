import { execSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
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

function loadReviewSchema(): string {
  const distPath = join(__dirname, '..', 'prompts', 'review-schema.json');
  if (existsSync(distPath)) {
    return readFileSync(distPath, 'utf-8');
  }

  const srcPath = join(__dirname, '..', '..', 'src', 'prompts', 'review-schema.json');
  if (existsSync(srcPath)) {
    return readFileSync(srcPath, 'utf-8');
  }

  throw new Error('Could not find review schema file');
}

export interface ReviewOptions {
  model: string;
  cwd: string;
  customPromptPath: string | null;
  maxDiffLines: number;
}

export async function runReview(
  diff: string,
  commitLog: string,
  diffStat: string,
  options: ReviewOptions
): Promise<ReviewOutput> {
  const prompt = loadReviewPrompt(options.customPromptPath);
  const schema = loadReviewSchema();

  // Truncate diff if too large
  const diffLines = diff.split('\n');
  const truncated =
    diffLines.length > options.maxDiffLines
      ? diffLines.slice(0, options.maxDiffLines).join('\n') +
        `\n\n[... truncated at ${options.maxDiffLines} lines, ${diffLines.length - options.maxDiffLines} lines omitted ...]`
      : diff;

  const stdinContent = `## Commit Log\n${commitLog}\n\n## Diff Summary\n${diffStat}\n\n## Full Diff\n${truncated}`;

  const schemaArg = schema.replace(/'/g, "'\\''");

  const cmd = [
    'claude',
    '-p',
    '--model', options.model,
    '--output-format', 'json',
    '--json-schema', `'${schemaArg}'`,
    '--allowedTools', '"Read,Glob,Grep"',
    '--append-system-prompt', `'${prompt.replace(/'/g, "'\\''")}'`,
  ].join(' ');

  const result = execSync(cmd, {
    cwd: options.cwd,
    encoding: 'utf-8',
    input: stdinContent,
    stdio: ['pipe', 'pipe', 'pipe'],
    maxBuffer: 10 * 1024 * 1024,
    timeout: 5 * 60 * 1000, // 5 minute timeout
  });

  const parsed = JSON.parse(result);
  return ReviewOutputSchema.parse(parsed);
}
