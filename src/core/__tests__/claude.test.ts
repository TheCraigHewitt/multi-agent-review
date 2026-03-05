import { describe, it, expect } from 'vitest';
import { ReviewOutputSchema, truncateDiff } from '../claude.js';

describe('truncateDiff', () => {
  it('returns diff unchanged when under limit', () => {
    const diff = 'line1\nline2\nline3';
    expect(truncateDiff(diff, 10)).toBe(diff);
  });

  it('truncates diff at maxLines', () => {
    const lines = Array.from({ length: 100 }, (_, i) => `line${i}`);
    const diff = lines.join('\n');
    const result = truncateDiff(diff, 50);
    expect(result).toContain('line0');
    expect(result).toContain('line49');
    expect(result).not.toContain('line50');
    expect(result).toContain('[... truncated at 50 lines, 50 lines omitted ...]');
  });

  it('returns exact diff when at the limit', () => {
    const lines = Array.from({ length: 5 }, (_, i) => `line${i}`);
    const diff = lines.join('\n');
    expect(truncateDiff(diff, 5)).toBe(diff);
  });
});

describe('ReviewOutputSchema', () => {
  const validOutput = {
    summary: 'Clean code',
    walkthrough: [{ file: 'src/foo.ts', description: 'Added auth' }],
    findings: [
      {
        file: 'src/foo.ts',
        line: 10,
        severity: 'warning',
        comment: 'Missing validation',
      },
    ],
    verdict: 'minor_issues',
  };

  it('validates correct input', () => {
    const result = ReviewOutputSchema.parse(validOutput);
    expect(result.verdict).toBe('minor_issues');
    expect(result.findings).toHaveLength(1);
  });

  it('accepts optional suggestion field', () => {
    const withSuggestion = {
      ...validOutput,
      findings: [
        { ...validOutput.findings[0], suggestion: 'const x = validate(input);' },
      ],
    };
    const result = ReviewOutputSchema.parse(withSuggestion);
    expect(result.findings[0].suggestion).toBe('const x = validate(input);');
  });

  it('accepts clean verdict with empty findings', () => {
    const clean = { ...validOutput, findings: [], verdict: 'clean' };
    const result = ReviewOutputSchema.parse(clean);
    expect(result.verdict).toBe('clean');
    expect(result.findings).toHaveLength(0);
  });

  it('rejects missing summary', () => {
    const { summary, ...noSummary } = validOutput;
    expect(() => ReviewOutputSchema.parse(noSummary)).toThrow();
  });

  it('rejects invalid verdict value', () => {
    expect(() =>
      ReviewOutputSchema.parse({ ...validOutput, verdict: 'good' })
    ).toThrow();
  });

  it('rejects invalid severity value', () => {
    const bad = {
      ...validOutput,
      findings: [{ ...validOutput.findings[0], severity: 'info' }],
    };
    expect(() => ReviewOutputSchema.parse(bad)).toThrow();
  });

  it('rejects finding missing file field', () => {
    const bad = {
      ...validOutput,
      findings: [{ line: 1, severity: 'warning', comment: 'test' }],
    };
    expect(() => ReviewOutputSchema.parse(bad)).toThrow();
  });
});
