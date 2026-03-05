# multi-agent-review

Automated PR reviews by Claude Code for commits made by Codex and other AI agents. Like CodeRabbit, but for agent-to-agent code review.

**Flow:** Codex writes code → pushes a PR → Claude Code reviews it → posts a structured GitHub PR review with inline comments.

## Quick Start

```bash
npm install -g multi-agent-review

cd your-project
mar init

# Reviews happen automatically when Codex finishes a turn.
# Or run manually:
mar review codex/my-feature
```

## Prerequisites

- Node.js >= 20
- [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code) (`claude` command)
- [GitHub CLI](https://cli.github.com/) (`gh` command, authenticated)
- [Codex CLI](https://github.com/openai/codex) (optional, for automatic reviews)

## How It Works

1. **`mar init`** sets up your project:
   - Creates `.mar/config.json` with detected repo and branch defaults
   - Adds a `notify` hook to `~/.codex/config.toml` so Codex triggers reviews automatically
   - Adds `.mar/` to `.gitignore`

2. **When Codex finishes a turn**, the notify handler checks:
   - Is the branch a `codex/*` branch? (configurable pattern)
   - Are there new commits since the last review?
   - Is there an open PR for this branch?
   - If all yes: spawns a background review

3. **The review** runs `claude -p` with a structured review prompt:
   - Reads the cumulative diff against the base branch
   - Analyzes for security issues, bugs, performance problems, convention violations
   - Returns structured JSON with findings

4. **Posts to GitHub** as a proper PR review:
   - Summary with verdict and collapsible file walkthrough
   - Inline comments on specific diff lines with severity badges
   - Uses `COMMENT` event (advisory only, never blocks merges)
   - Updates existing review instead of posting duplicates

## GitHub Action

Add Claude reviews to any repo without installing the CLI:

```yaml
# .github/workflows/review.yml
name: Claude Review
on: pull_request

jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: TheCraigHewitt/multi-agent-review@v1
        with:
          anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
```

### Action Inputs

| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `anthropic_api_key` | Anthropic API key | Yes | — |
| `model` | Claude model to use | No | `claude-sonnet-4-6` |
| `max_diff_lines` | Diff truncation limit | No | `5000` |

### Action Outputs

| Output | Description |
|--------|-------------|
| `verdict` | Review verdict (`clean`, `minor_issues`, `major_issues`, `critical`) |
| `findings_count` | Number of findings |

## Commands

### `mar init`

Initialize in the current git repository. Detects the GitHub remote and base branch automatically.

### `mar review [branch]`

Review a specific branch (defaults to current branch). Requires an open PR.

```bash
mar review codex/add-auth

# Preview review locally without posting to GitHub
mar review codex/add-auth --dry-run
```

### `mar status`

Show current configuration and recent review history.

### `mar notify-handler [payload]`

Called automatically by Codex via the notify hook. Not intended for manual use.

## Configuration

After `mar init`, edit `.mar/config.json`:

```json
{
  "repo": "owner/repo",
  "baseBranch": "main",
  "branchPattern": "codex/*",
  "model": "sonnet",
  "reviewPrompt": null,
  "maxDiffLines": 5000
}
```

| Field | Description | Default |
|-------|-------------|---------|
| `repo` | GitHub owner/repo | Auto-detected |
| `baseBranch` | Branch to diff against | Auto-detected |
| `branchPattern` | Glob pattern for branches to review | `codex/*` |
| `model` | Claude model to use | `sonnet` |
| `reviewPrompt` | Path to custom review prompt | `null` (uses built-in) |
| `maxDiffLines` | Truncate diffs longer than this | `5000` |

### Custom Review Prompt

Place a `.mar/review-prompt.md` in your project to override the default review prompt. The prompt receives the diff via stdin and should instruct Claude to return JSON matching the review schema.

## Review Output

PR reviews include a summary comment:

```markdown
## Code Review

**Verdict:** Minor issues found (2 findings)

**Summary:** Adds token validation to the auth flow and updates session access control.

<details>
<summary>Walkthrough (3 files changed)</summary>

| File | Change |
|------|--------|
| `src/routes/auth.ts` | Add Zod validation for token exchange |
| `src/services/token-service.ts` | Extract token parsing helper |
| `src/routes/__tests__/auth.test.ts` | Add malformed token tests |

</details>
```

And inline comments on specific lines:

```
**warning** Missing input validation on the token parameter.

\`\`\`suggestion
const token = z.string().min(1).parse(req.body.token);
\`\`\`
```

## License

MIT
