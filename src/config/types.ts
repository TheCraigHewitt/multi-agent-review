import { z } from 'zod';

export const ConfigSchema = z.object({
  repo: z.string().regex(/^[^/]+\/[^/]+$/, 'Must be owner/repo format'),
  baseBranch: z.string().default('main'),
  branchPattern: z.string().default('codex/*'),
  model: z.string().default('sonnet'),
  reviewPrompt: z.string().nullable().default(null),
  maxDiffLines: z.number().int().positive().default(5000),
});

export type Config = z.infer<typeof ConfigSchema>;

export const StateSchema = z.object({
  reviews: z.array(z.object({
    branch: z.string(),
    prNumber: z.number(),
    commitSha: z.string(),
    reviewId: z.number().optional(),
    verdict: z.string(),
    findingsCount: z.number(),
    timestamp: z.string(),
  })),
  lastChecked: z.record(z.string(), z.string()).default({}),
});

export type State = z.infer<typeof StateSchema>;

export const DEFAULT_CONFIG: Partial<Config> = {
  baseBranch: 'main',
  branchPattern: 'codex/*',
  model: 'sonnet',
  reviewPrompt: null,
  maxDiffLines: 5000,
};
