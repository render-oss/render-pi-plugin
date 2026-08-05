# @render/pi-render

Render integration for the [Pi coding agent](https://pi.dev) — Render's OSS skills plus hosted
Render MCP access, in one installable package.

v1 is intentionally a **subset** of the sibling `render-plugin-claude-code`,
`render-opencode-plugin`, `render-codex-plugin`, and `render-cursor-plugin` family: it ships the
skills and the control plane, not the slash commands, subagent, or Blueprint hook.

## Install

```bash
pi install https://github.com/render-lab/render-pi-plugin
```

Pi installs the package's runtime dependencies, including its MCP adapter. There is no separate
MCP package or MCP support prerequisite to install.

For a reproducible install pinned to this release:

```bash
pi install https://github.com/render-lab/render-pi-plugin@v0.1.0
```

## What you get (v1)

- **Skills** synced from [`render-oss/skills`](https://github.com/render-oss/skills) — Render
  deployment, Blueprint, debugging, and monitoring know-how, auto-loaded by the model and
  invocable as `/skill:render-*`.
- **Render MCP access** via `pi-mcp-adapter` (OAuth by default, `RENDER_API_KEY` for CI) — the
  full control plane: services, deploys, logs, env vars, Postgres.

MCP is lazy and proxy-only. On a clean first run, the adapter makes one best-effort Render
connection to populate its local tool-metadata cache, but it does not open an OAuth flow. If that
bootstrap cannot connect, Pi and the Render skills continue to work; authenticated MCP operations
connect on demand.

Because that bootstrap runs before you have credentials, the first session reports once that the
Render server requires authentication (an HTTP 401). This is expected, not a failure — Pi and all
21 skills load normally. Run `/mcp-auth render` when you want the Render tools, and the notice
stops.

## Auth

- **OAuth (recommended, interactive):** run `/mcp-auth render` in a session — no API key needed.
- **`RENDER_API_KEY` (CI/non-interactive):** set the env var before starting Pi; the adapter reads
  it only when making a lazy connection and sends it as a bearer token.

The Render server is configured by this package rather than read from your MCP config, so it stays
isolated from any MCP servers you've set up yourself. The trade-off: `/mcp setup`, `/mcp enable`,
and `/mcp disable` don't apply to it, and `/mcp status` reports what this package configured.

Headless Linux OAuth requires an unlocked system credential store. Use `RENDER_API_KEY` when one
isn't available.

## Skills-only mode

Run `pi config` and disable this package's extension while leaving its skills enabled. This removes
the MCP tools but keeps every `/skill:render-*` command available.

## Update or remove

```bash
pi update --extensions
pi remove https://github.com/render-lab/render-pi-plugin
```

An install pinned to `@v0.1.0` stays pinned; install a newer tag explicitly to move it forward.

## Compatibility

v0.1.0 is verified against Pi `0.83.0`, `pi-mcp-adapter` `2.19.0`, and Node.js `22.19.0` or newer.
See [`docs/SPEC.md`](./docs/SPEC.md) for the complete scope and deferred work.

## Development

```bash
npm install
npm run verify   # typecheck + lint + tests — the single green light
```

Test-first; see [`docs/SPEC.md`](./docs/SPEC.md) §7.

### Updating skills

`renderinc/skills` is the source of truth. Copybara mirrors its distributable files to
[`render-oss/skills`](https://github.com/render-oss/skills), and this repository syncs from that
public mirror. `.github/workflows/sync-skills.yml` checks daily at 06:00 UTC and can also be run
manually; it verifies changes before opening a `skills-sync` pull request.

Run the same sync locally:

```bash
npm run sync-skills
npm run sync-skills -- --ref <commit-or-tag>
npm run sync-skills -- --repo ../../skills --ref main  # local source-of-truth clone
npm run verify
```

The script applies the public mirror's source-only eval exclusions and records the resolved source,
ref, and commit in `skills/.sync-source`. Never edit vendored skills by hand. Keep auto-merge
disabled unless the repository requires the verify check; then set the
`SKILLS_SYNC_AUTOMERGE=true` repository Actions variable to allow squash auto-merge.

The public mirror is the release input. Public contributions can temporarily lead the internal
clone until their reverse-Copybara PR is merged, so compare local-clone output with
`render-oss/skills` before using it in a release.
