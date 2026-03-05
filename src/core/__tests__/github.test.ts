import { describe, it, expect } from 'vitest';
import { formatReviewBody, formatInlineComment, type Verdict, type Finding } from '../github.js';

describe('formatReviewBody', () => {
  it('formats clean verdict with no findings', () => {
    const body = formatReviewBody('All looks good', [], 'clean', 0);
    expect(body).toContain('**Verdict:** No issues found');
    expect(body).toContain('**Summary:** All looks good');
    expect(body).toContain('multi-agent-review');
    expect(body).not.toContain('finding');
  });

  it('includes finding count for non-clean verdict', () => {
    const body = formatReviewBody('Some issues', [], 'minor_issues', 2);
    expect(body).toContain('Minor issues found (2 findings)');
  });

  it('renders singular finding count', () => {
    const body = formatReviewBody('One issue', [], 'warning' as Verdict, 1);
    expect(body).toContain('1 finding)');
    expect(body).not.toContain('findings)');
  });

  it('includes walkthrough when files provided', () => {
    const walkthrough = [
      { file: 'src/foo.ts', description: 'Added validation' },
      { file: 'src/bar.ts', description: 'Refactored handler' },
    ];
    const body = formatReviewBody('Changes made', walkthrough, 'minor_issues', 1);
    expect(body).toContain('Walkthrough (2 files changed)');
    expect(body).toContain('`src/foo.ts`');
    expect(body).toContain('Added validation');
    expect(body).toContain('`src/bar.ts`');
  });

  it('omits walkthrough section when empty', () => {
    const body = formatReviewBody('Clean code', [], 'clean', 0);
    expect(body).not.toContain('Walkthrough');
    expect(body).not.toContain('<details>');
  });
});

describe('formatInlineComment', () => {
  it('formats critical severity', () => {
    const finding: Finding = {
      file: 'src/auth.ts',
      line: 42,
      severity: 'critical',
      comment: 'SQL injection vulnerability',
    };
    const result = formatInlineComment(finding);
    expect(result).toContain('**critical**');
    expect(result).toContain('SQL injection vulnerability');
  });

  it('formats warning severity', () => {
    const finding: Finding = {
      file: 'src/api.ts',
      line: 10,
      severity: 'warning',
      comment: 'Missing error handling',
    };
    const result = formatInlineComment(finding);
    expect(result).toContain('**warning**');
    expect(result).toContain('Missing error handling');
  });

  it('formats suggestion severity', () => {
    const finding: Finding = {
      file: 'src/utils.ts',
      line: 5,
      severity: 'suggestion',
      comment: 'Consider using const',
    };
    const result = formatInlineComment(finding);
    expect(result).toContain('**suggestion**');
  });

  it('includes code suggestion block when provided', () => {
    const finding: Finding = {
      file: 'src/auth.ts',
      line: 42,
      severity: 'warning',
      comment: 'Missing validation',
      suggestion: 'const token = z.string().parse(input);',
    };
    const result = formatInlineComment(finding);
    expect(result).toContain('```suggestion');
    expect(result).toContain('const token = z.string().parse(input);');
    expect(result).toContain('```');
  });

  it('omits suggestion block when not provided', () => {
    const finding: Finding = {
      file: 'src/auth.ts',
      line: 42,
      severity: 'warning',
      comment: 'Missing validation',
    };
    const result = formatInlineComment(finding);
    expect(result).not.toContain('```suggestion');
  });
});
