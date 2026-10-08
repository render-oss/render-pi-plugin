# Changelog

## 0.2.0 - 2026-10-08

### Changed

- Vendored all 21 Render skills from `render-oss/skills` release `skills-v1.0.0` instead of `main`: shared, single-sourced reference content across skills, doc retrieval that does not require `curl`, and the Render Workflows skill updated for SDK 1.x.

### Removed

- Reference files replaced by shared references: `render-deploy/references/blueprint-spec.md`, `render-disks/references/sizing-and-snapshots.md`, `render-networking/references/troubleshooting.md`, `render-scaling/references/instance-types.md`, and `render-web-services/references/deploy-lifecycle.md`.

## 0.1.0 - 2026-08-03

Initial GitHub release of the Render integration for the Pi coding agent.

### Added

- 21 Render skills vendored from `render-oss/skills`, including deployment, Blueprint, debugging,
  monitoring, database, networking, and service guidance.
- Lazy hosted Render MCP access through `pi-mcp-adapter`.
- Interactive OAuth via `/mcp-auth render`.
- Non-interactive bearer authentication through `RENDER_API_KEY` without copying the token into
  package configuration.
- One-command installation from `https://github.com/render-oss/render-pi-plugin`.

### Scope

This first release intentionally does not include the sibling plugins' dedicated slash commands,
Render subagent, or automatic Blueprint validation hook. Pi exposes every bundled skill through
`/skill:render-*`, and the MCP adapter supplies the Render control-plane tools.
