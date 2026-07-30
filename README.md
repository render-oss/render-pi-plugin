# @render/pi-render

Render integration for the [Pi coding agent](https://pi.dev) — Render's OSS skills plus hosted
Render MCP access, in one installable package.

v1 is intentionally a **subset** of the sibling `render-plugin-claude-code`,
`render-opencode-plugin`, `render-codex-plugin`, and `render-cursor-plugin` family: it ships the
skills and the control plane, not the slash commands, subagent, or Blueprint hook.

> **Status:** v1 in development. See [`docs/SPEC.md`](./docs/SPEC.md) for the full
> specification — scope, integration seams, and what's deferred.

## Install

```bash
pi install npm:@render/pi-render
```

## What you get (v1)

- **Skills** synced from [`render-oss/skills`](https://github.com/render-oss/skills) — Render
  deployment, Blueprint, debugging, and monitoring know-how, auto-loaded by the model and
  invocable as `/skill:render-*`.
- **Render MCP access** via `pi-mcp-adapter` (OAuth by default, `RENDER_API_KEY` for CI) — the
  full control plane: services, deploys, logs, env vars, Postgres.

That's deliberately it. v1 is Render *knowledge* plus the Render *control plane*; see
[`docs/SPEC.md`](./docs/SPEC.md) §9 for what's deferred and why.

## Auth

- **OAuth (recommended, interactive):** run `/mcp-auth render` in a session — no API key needed.
- **`RENDER_API_KEY` (CI/non-interactive):** set the env var; the MCP server uses it as a bearer token.

The Render server is configured by this package rather than read from your MCP config, so it stays
isolated from any MCP servers you've set up yourself. The trade-off: `/mcp setup`, `/mcp enable`,
and `/mcp disable` don't apply to it, and `/mcp status` reports what this package configured.

## Development

```bash
npm install
npm run verify   # typecheck + lint + tests — the single green light
```

Test-first; see [`docs/SPEC.md`](./docs/SPEC.md) §7. Skills are re-synced with
`npm run sync-skills`, which repoints `skills/` at a new pinned upstream commit — do that in its
own pull request and never edit `skills/` by hand.
