import { describe, it, expect } from 'vitest';
import { branchMatchesPattern } from '../git.js';

describe('branchMatchesPattern', () => {
  it('matches exact branch name', () => {
    expect(branchMatchesPattern('codex/feature', 'codex/feature')).toBe(true);
  });

  it('matches wildcard pattern', () => {
    expect(branchMatchesPattern('codex/add-auth', 'codex/*')).toBe(true);
  });

  it('matches nested wildcard', () => {
    expect(branchMatchesPattern('codex/feat/sub', 'codex/*/*')).toBe(true);
  });

  it('does not match non-matching branch', () => {
    expect(branchMatchesPattern('feature/foo', 'codex/*')).toBe(false);
  });

  it('does not match partial prefix', () => {
    expect(branchMatchesPattern('codex-extra/foo', 'codex/*')).toBe(false);
  });

  it('matches pattern with no wildcard exactly', () => {
    expect(branchMatchesPattern('main', 'main')).toBe(true);
  });

  it('does not match empty branch against pattern', () => {
    expect(branchMatchesPattern('', 'codex/*')).toBe(false);
  });

  it('matches star-only pattern against any branch', () => {
    expect(branchMatchesPattern('anything', '*')).toBe(true);
  });

  it('matches double-star pattern across slashes', () => {
    expect(branchMatchesPattern('codex/deep/nested', 'codex/**')).toBe(true);
  });
});
