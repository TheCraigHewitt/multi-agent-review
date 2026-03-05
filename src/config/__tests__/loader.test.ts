import { describe, it, expect, vi, beforeEach } from 'vitest';
import { execSync } from 'node:child_process';
import { detectRepo } from '../loader.js';

vi.mock('node:child_process', () => ({
  execSync: vi.fn(),
}));

const mockExecSync = vi.mocked(execSync);

describe('detectRepo', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('parses SSH URL to owner/repo', () => {
    mockExecSync.mockReturnValue('git@github.com:TheCraigHewitt/multi-agent-review.git\n');
    const result = detectRepo('/tmp/project');
    expect(result).toBe('TheCraigHewitt/multi-agent-review');
  });

  it('parses HTTPS URL to owner/repo', () => {
    mockExecSync.mockReturnValue('https://github.com/owner/repo.git\n');
    const result = detectRepo('/tmp/project');
    expect(result).toBe('owner/repo');
  });

  it('parses HTTPS URL without .git suffix', () => {
    mockExecSync.mockReturnValue('https://github.com/owner/repo\n');
    const result = detectRepo('/tmp/project');
    expect(result).toBe('owner/repo');
  });

  it('returns null for non-GitHub URL', () => {
    mockExecSync.mockReturnValue('https://gitlab.com/owner/repo.git\n');
    const result = detectRepo('/tmp/project');
    expect(result).toBeNull();
  });

  it('returns null when git command fails', () => {
    mockExecSync.mockImplementation(() => {
      throw new Error('not a git repo');
    });
    const result = detectRepo('/tmp/project');
    expect(result).toBeNull();
  });
});
