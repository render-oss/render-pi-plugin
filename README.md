# @render/pi-render

Render integration for the [Pi coding agent](https://pi.dev) — at parity with the
`render-plugin-claude-code`, `render-opencode-plugin`, `render-codex-plugin`, and
`render-cursor-plugin` family.

> **Status:** Phase 1, in development. See [`PLAN.md`](./PLAN.md) for the TDD build plan
> and [`seed.md`](./seed.md) for scope.

## Install

```bash
pi install npm:@render/pi-render
```

## What you get (Phase 1)

- **Skills** synced from [`render-oss/skills`](https://github.com/render-oss/skills)
- **Render MCP access** via `pi-mcp-adapter` (OAuth by default, `RENDER_API_KEY` for CI)
- **Prompt templates:** `/deploy-to-render`, `/check-render-status`
- **`@render` subagent** for Render ops
- **Blueprint validation:** auto-runs `render blueprints validate` when you edit `render.yaml`

## Auth

- **OAuth (recommended, interactive):** run `/mcp-auth render` in a session — no API key needed.
- **`RENDER_API_KEY` (CI/non-interactive):** set the env var; the MCP server uses it as a bearer token.

The `render` CLI must be on `PATH` for Blueprint validation (`brew install render`).

## Development

```bash
npm install
npm run verify   # typecheck + lint + tests — the single green light
```

Test-first: see [`PLAN.md`](./PLAN.md). Skills are re-synced with `npm run sync-skills`.
