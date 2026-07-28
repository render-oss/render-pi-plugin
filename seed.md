A single **Pi package** (`pi install npm:@render/pi-render` or `pi install git:github.com/render-oss/pi-render`) that brings Render into the Pi coding agent, at **parity** with the existing `render-plugin-claude-code`, `render-opencode-plugin`, `render-codex-plugin`, and `render-cursor-plugin` family.

**Phase 1 goal:** ship parity as fast as possible by **reusing existing assets** — Render's OSS skills, hosted MCP, and CLI, plus Pi's existing community MCP client — and writing only the thin Pi glue. No net-new tooling. Pi-native polish and Workflows tooling are explicitly out of scope (§5).

---

## 1. What we ship

| Pi resource | What we ship | Source (reuse) |
| --- | --- | --- |
| **Skills** | Render OSS skills, loaded natively | `render-oss/skills` (synced, don't fork) |
| **MCP access** | Hosted Render MCP wired in via the existing `pi-mcp-adapter` package | `mcp.render.com` + `pi-mcp-adapter` (npm) |
| **Prompt templates** | `/deploy-to-render`, `/check-render-status` | ported from Claude Code / opencode |
| **Subagent** | `@render` specialized subagent | ported from `agents/render-assistant.md` |
| **Blueprint validate hook** | auto-run `render blueprints validate` on `render.yaml` edits | ported from opencode plugin |

Package manifest (`package.json`):

```json
{
  "name": "@render/pi-render",
  "keywords": ["pi-package"],
  "pi": {
    "extensions": ["./src/index.ts"],
    "skills": ["./skills"],
    "prompts": ["./prompts"]
  },
  "dependencies": {
    "pi-mcp-adapter": "^1.0.0"
  },
  "peerDependencies": {
    "@earendil-works/pi-coding-agent": "*",
    "@earendil-works/pi-ai": "*",
    "@earendil-works/pi-tui": "*",
    "typebox": "*"
  }
}
```

> Runtime deps go in `dependencies` (Pi installs git/npm packages with `--omit=dev`). Pi core packages go in `peerDependencies` with `"*"` — Pi provides them at runtime. We drop `@renderinc/sdk` in Phase 1 (only needed for the out-of-scope Workflows tools).
> 

---

## 2. Design principles

1. **Reuse, don't rebuild.** Skills are already the Agent Skills standard (Pi loads them natively); the hosted MCP already exposes the full control plane; `pi-mcp-adapter` already implements a production MCP client. We only glue.
2. **Match the family.** Same commands, subagent, and blueprint hook as the Claude Code / opencode plugins.
3. **Reuse an existing MCP client.** Pi ships "no MCP" by design, but `pi-mcp-adapter` is a mature community client with a programmatic API. Depend on it rather than hand-rolling a client.
4. **Stay in lockstep with OSS.** A `sync-skills` script pulls canonical skills from `render-oss/skills` (same approach as the sibling plugins).

---

## 3. Components — what to build & roughly how

### 3.1 Bundled skills (reuse, ~0 code)

- **How:** `scripts/sync-skills.sh` clones/pulls `render-oss/skills` and copies the `skills/render-*` dirs (incl. `references/` and `assets/`). Pi auto-discovers `SKILL.md` files from the package `skills/` dir; invoked via `/skill:render-*` or auto-loaded by the model.
- **Effort:** trivial — CI/sync concern, ~1:1 with the sibling plugins' `sync-skills.sh`.

### 3.2 MCP access (reuse `pi-mcp-adapter`)

- **What:** expose the hosted Render MCP server's tools (`list_services`, deploys, logs, env vars, Postgres query, create/redeploy, etc.) as Pi tools — the full control plane, no REST re-wrapping and **no custom MCP client**.
- **How:** depend on `pi-mcp-adapter` and use its programmatic API, which is designed for "an integration that already owns its MCP config":
    
    ```tsx
    import { createMcpAdapter } from "pi-mcp-adapter";
    
    export default createMcpAdapter({
      config: {
        mcpServers: {
          render: { url: "<https://mcp.render.com/mcp>", lifecycle: "eager" },
        },
      },
    });
    ```
    
    - The supplied `config` is an isolated snapshot — not merged with the user's ambient MCP servers, never mutated.
    - The adapter handles transport (StreamableHTTP + SSE fallback), JSON-Schema→typebox, paginated discovery, cancellation, reconnection, and the context-saving proxy tool / `directTools` allowlist.
- **Auth:** **OAuth** — now supported by the Render MCP — via `pi-mcp-adapter`'s interactive `/mcp-auth` flow (credentials stored in the OS credential store; no API key required, matching the Claude Code plugin). `RENDER_API_KEY` remains the non-interactive/CI fallback (sent as a header).
- **Effort:** low — config + wiring only; no client engineering.

### 3.3 Blueprint auto-validate hook (direct port)

- **What:** when the agent writes/edits `render.yaml`/`render.yml`, auto-run `render blueprints validate` and inject the result. Also a standalone `render_validate_blueprint` tool.
- **How:** port the opencode plugin's `tool.execute.after` logic to Pi's `tool_result` (or `tool_call`) event. Detect touched files (`path`/`file_path`), filter to blueprint filenames, `execFile("render", ["blueprints", "validate"], { cwd })`, surface failures inline; handle `ENOENT` (CLI missing) with an install hint — exactly like opencode.
- **Effort:** low — ~1:1 port of existing code.

### 3.4 Prompt templates & `@render` subagent (ports)

- **What:** `/deploy-to-render`, `/check-render-status`; a `@render` subagent specialized in Render ops.
- **How:** markdown prompt templates in `prompts/`; an agent def (`agents/render.md`) discovered by a Pi subagent extension. ~1:1 from Claude Code / opencode plugins.
- **Effort:** low.

**Build order:** skills + `sync-skills` → prompts + `@render` subagent → blueprint hook → MCP wiring. All low-effort ports/config — parity in days.

---

## 4. Auth & configuration

- **Auth:** prefer **OAuth** for interactive use (`pi-mcp-adapter` `/mcp-auth`, no key needed, creds in the OS credential store). Fall back to `RENDER_API_KEY` from env for non-interactive/CI (matches SDK / MCP / CLI conventions). Optional `/render:login` helper.
- **CLI dependency:** detect `render` on PATH; the blueprint hook needs it. If missing, surface an install hint (`brew install render` / install.sh).
- **Settings keys** (`settings.json`): MCP tool allowlist (via `directTools`), behavior when the CLI is missing.

---

## 6. Open questions / decisions

1. **Dynamic vs curated MCP tools.** `pi-mcp-adapter` proxies all tools by default; a `directTools` allowlist gives a tighter, safer surface. Proposal: proxy + curated allowlist in settings.
2. **`pi-mcp-adapter` as a hard dependency.** It's a community package pinned to pi core peer deps. Acceptable for parity; keep the wiring thin so we can swap the adapter (or fall back to CLI) if it goes stale.
3. **Naming / distribution.** npm `@render/pi-render` and/or git under `render-oss`; reuse the `sync-skills` CI from the sibling plugins.

---

## 7. Reuse map (what comes from where)

- **Skills content** → `render-oss/skills` (sync, don't fork)
- **Control-plane tools** → hosted MCP `https://mcp.render.com/mcp` via `pi-mcp-adapter`
- **Blueprint validation** → `render` CLI `blueprints validate` (port opencode hook)
- **Commands / subagent** → port from `render-plugin-claude-code` + `render-opencode-plugin`
- **Pi glue (extension wiring, hook, tool registration)** → thin, this repo