# Contributing

Thanks for your interest in contributing to multi-agent-review.

## Getting Started

1. Fork the repo and clone your fork
2. Install dependencies: `npm install`
3. Create a branch: `git checkout -b my-feature`
4. Make your changes
5. Run checks: `npm run typecheck && npm run build && npm test`
6. Push and open a PR against `main`

## Prerequisites

- Node.js >= 20
- [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code) (for testing reviews)
- [GitHub CLI](https://cli.github.com/) (for testing GitHub integration)

## Development

```bash
npm run dev          # Watch mode TypeScript compilation
npm run build        # Full build
npm run typecheck    # Type checking only
npm test             # Run tests
npm run test:watch   # Watch mode tests
```

## Pull Requests

- Keep PRs focused on a single change
- Include tests for new functionality
- Make sure CI passes before requesting review
- Use clear commit messages

## Reporting Issues

- Use the bug report or feature request templates
- Include reproduction steps for bugs
- Check existing issues before opening a new one

## Code Style

- TypeScript strict mode
- ESM modules
- Follow existing patterns in the codebase
