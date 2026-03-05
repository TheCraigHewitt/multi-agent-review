import { describe, it, expect } from 'vitest';
import { ConfigSchema, StateSchema } from '../types.js';

describe('ConfigSchema', () => {
  it('validates a complete config', () => {
    const config = {
      repo: 'owner/repo',
      baseBranch: 'main',
      branchPattern: 'codex/*',
      model: 'sonnet',
      reviewPrompt: null,
      maxDiffLines: 5000,
    };
    const result = ConfigSchema.parse(config);
    expect(result.repo).toBe('owner/repo');
  });

  it('applies defaults for optional fields', () => {
    const result = ConfigSchema.parse({ repo: 'owner/repo' });
    expect(result.baseBranch).toBe('main');
    expect(result.branchPattern).toBe('codex/*');
    expect(result.model).toBe('sonnet');
    expect(result.reviewPrompt).toBeNull();
    expect(result.maxDiffLines).toBe(5000);
  });

  it('rejects invalid repo format (no slash)', () => {
    expect(() => ConfigSchema.parse({ repo: 'noslash' })).toThrow();
  });

  it('rejects invalid repo format (multiple slashes)', () => {
    expect(() => ConfigSchema.parse({ repo: 'a/b/c' })).toThrow();
  });

  it('rejects missing repo', () => {
    expect(() => ConfigSchema.parse({})).toThrow();
  });

  it('accepts custom reviewPrompt path', () => {
    const result = ConfigSchema.parse({
      repo: 'owner/repo',
      reviewPrompt: '.mar/custom-prompt.md',
    });
    expect(result.reviewPrompt).toBe('.mar/custom-prompt.md');
  });
});

describe('StateSchema', () => {
  it('validates empty state', () => {
    const result = StateSchema.parse({ reviews: [] });
    expect(result.reviews).toHaveLength(0);
    expect(result.lastChecked).toEqual({});
  });

  it('validates populated state', () => {
    const state = {
      reviews: [
        {
          branch: 'codex/feature',
          prNumber: 42,
          commitSha: 'abc123',
          reviewId: 100,
          verdict: 'clean',
          findingsCount: 0,
          timestamp: '2025-01-01T00:00:00.000Z',
        },
      ],
      lastChecked: {
        'codex/feature': 'abc123',
      },
    };
    const result = StateSchema.parse(state);
    expect(result.reviews).toHaveLength(1);
    expect(result.lastChecked['codex/feature']).toBe('abc123');
  });

  it('defaults lastChecked to empty object', () => {
    const result = StateSchema.parse({ reviews: [] });
    expect(result.lastChecked).toEqual({});
  });

  it('accepts review without optional reviewId', () => {
    const state = {
      reviews: [
        {
          branch: 'codex/test',
          prNumber: 1,
          commitSha: 'def456',
          verdict: 'minor_issues',
          findingsCount: 2,
          timestamp: '2025-06-01T00:00:00.000Z',
        },
      ],
    };
    const result = StateSchema.parse(state);
    expect(result.reviews[0].reviewId).toBeUndefined();
  });
});
