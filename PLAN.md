# `pi-render` — Build Plan (TDD)

How we build the Phase 1 package described in [`seed.md`](./seed.md): parity with the sibling Render plugins, reuse-first, shipped test-first with a **single, unambiguous green light** at every step.

---

## 1. Guiding constraints

1. **TDD, red → green → refactor.** Every unit of behavior starts as a failing test. No production code without a test that demanded it.
2. **One green light.** A single command — `npm run verify` — is the source of truth. It runs typecheck + lint + tests. "Done" for any milestone = *the new tests exist and `npm run verify` is green.* CI runs the exact same command.
3. **Reuse, don't rebuild** (per `seed.md` §2). We test *our glue*, not Render's MCP, the CLI, or `pi-mcp-adapter`. Those are boundaries we mock.
4. **No build step.** Pi loads `.ts` via jiti at runtime. We ship source. `tsc` is typecheck-only (`--noEmit`); tests run TS directly via Vitest.
5. **Parity is the scope ceiling.** If a sibling plugin doesn't ship it, it's out (see `seed.md` §5).

---

## 2. Tooling & stack

| Concern | Choice | Notes |
| --- | --- | --- |
| Language | TypeScript (ESM) | Loaded by Pi via jiti; no compile output |
| Test runner | **Vitest** (`globals: true`) | Ecosystem standard for pi extensions |
| Extension testing | **Typed fake `ExtensionAPI`** (`tests/support/fake-pi.ts`) + pure unit tests | Drives the extension against pi's *public* API; captures registered tools/commands/handlers to assert + invoke with synthetic events. No third-party runtime. |
| Path resolution in tests | `vite-tsconfig-paths` | Resolves pi core type paths during transpile |
| Lint/format | **Biome** | Single fast tool; matches pi-extensions convention |
| Typecheck | `tsc --noEmit` | Correctness gate only |
| Package manager | **npm** | Pi installs packages with `npm install --omit=dev` |

**Dependencies split** (critical — Pi installs with `--omit=dev`):
- `dependencies`: `pi-mcp-adapter` (runtime glue we actually import).
- `peerDependencies` (`"*"`): `@earendil-works/pi-coding-agent`, `@earendil-works/pi-ai`, `@earendil-works/pi-tui`, `typebox` — provided by Pi at runtime.
- `devDependencies`: pi core packages **at latest (`^0.82.1`)** so typecheck runs against current types (`@earendil-works/pi-coding-agent`, `-ai`, `-tui`), `vitest`, `vite-tsconfig-paths`, `@biomejs/biome`, `typescript`, `@types/node`.

> **Why a fake API instead of a runtime harness (decided in M0).** Every published pi test-harness (`@marcfargas`, `@gaodes`) is hard-coupled to **pre-0.80 internals** — it imports the moved `getModel` *and* monkeypatches private fields (`session._modelRegistry`, `session.agent.streamFn/getApiKey`) to bypass auth; on pi `0.82` the auth preflight fires ("No API key found"). Rather than pin to old pi or fork the harness, we test the extension against pi's **public `ExtensionAPI`** with a small typed fake (`tests/support/fake-pi.ts`) plus pure unit tests. This tracks **latest pi** (typecheck catches API drift), has no fragile deps, and is fast. Trade-off: we don't simulate the LLM's tool-calling — which we don't need, since we test *our* glue, not model behavior. Revisit an end-to-end smoke layer (e.g. a local OpenAI-compatible endpoint via `registerProvider`/`models.json`) only if a real-runtime need appears.

---

## 3. Target repo layout

```
pi-render/
├── package.json              # pi manifest + scripts + deps split
├── tsconfig.json             # typecheck-only, ESM, strict
├── biome.json                # lint/format
├── vitest.config.ts          # globals + tsconfig-paths
├── src/
│   ├── index.ts              # extension entry: export default (pi) => { ... }
│   ├── mcp.ts                # buildRenderMcpConfig(env) + adapter wiring
│   ├── blueprint/
│   │   ├── detect.ts         # pure: is-blueprint-file, extract touched paths
│   │   ├── format.ts         # pure: format validate output → tool result
│   │   ├── runner.ts         # side-effect: execFile("render", ...) (injectable)
│   │   └── hook.ts           # wires detect+runner+format into tool_result + tool
│   ├── config.ts             # pure: read RENDER_API_KEY, CLI detection, settings
│   └── cli.ts                # pure: detect `render` on PATH, install hint
├── skills/                   # VENDORED from render-oss/skills (generated, committed)
├── prompts/
│   ├── deploy-to-render.md
│   ├── check-render-status.md
│   └── render.md             # @render subagent persona (see M3 decision)
├── scripts/
│   └── sync-skills.sh        # clone/pull render-oss/skills @ pinned SHA → skills/
├── tests/
│   ├── support/              # fake-pi.ts (typed ExtensionAPI double)
│   ├── unit/                 # pure-function tests
│   ├── extension/            # extension-wiring tests via the fake API
│   └── package/              # manifest + skills presence validation
└── PLAN.md / seed.md / README.md
```

**Design-for-test rule:** every component splits *pure logic* (unit-tested directly) from *side effects* (thin, injectable, covered by integration tests). E.g. blueprint filename detection and output formatting are pure; `execFile` lives behind an injectable `runner`.

---

## 4. The green light (`npm run verify`)

```jsonc
// package.json "scripts"
{
  "typecheck": "tsc --noEmit",
  "lint": "biome check .",
  "test": "vitest run",
  "verify": "npm run typecheck && npm run lint && npm run test",
  "sync-skills": "bash scripts/sync-skills.sh"
}
```

- **Local loop:** `vitest --watch` while coding a milestone; `npm run verify` before calling it done.
- **CI gate:** one GitHub Actions job runs `npm ci && npm run verify` on push/PR. Branch protection requires it green to merge. That green check *is* the clear green light.
- A milestone is complete **only** when its listed tests are written, were red first, and `npm run verify` passes.

---

## 5. Test strategy (what we test vs. mock)

| Layer | How | Example |
| --- | --- | --- |
| Pure logic | Vitest, direct | blueprint filename match, output formatting, MCP config builder, API-key/CLI detection |
| Extension behavior (tools, hooks, commands) | fake `ExtensionAPI`: call the factory, assert captured registrations, then invoke captured `tool.execute` / event handlers with synthetic events | `render_validate_blueprint` returns formatted result; the `tool_result` handler enriches on a synthetic `render.yaml` write event; commands are registered |
| `render` CLI | **injected runner** in unit tests; `createMockPi()`-style PATH shim / stub runner in integration | success, failure, and `ENOENT` (CLI missing → install hint) |
| Render MCP / `pi-mcp-adapter` | boundary: assert the **config we hand it**, never the network | `buildRenderMcpConfig` points at `https://mcp.render.com/mcp`, `lifecycle: "eager"`, auth from env |
| LLM | not in the loop | we assert registration + handler logic directly; no model, no provider keys |
| Skills content | package test asserts presence + valid frontmatter | not re-testing Render's skill prose |

We do **not** write tests that hit `mcp.render.com`, the real `render` CLI, or a real model. Live wiring is verified once, manually, in the M5/M7 smoke check.

---

## 6. Milestones (each ends on a green light)

Order follows `seed.md`'s build order. Each milestone: **write the red tests first**, implement the minimum to pass, refactor, then `npm run verify`.

### M0 — Scaffold + green light
**Red tests first:**
- `extension/loads.test.ts`: calling the extension factory with the fake `ExtensionAPI` does not throw and, as a scaffold, registers no tools/commands/handlers.
- `package/manifest.test.ts`: `package.json` has `keywords: ["pi-package"]`, a `pi` manifest, correct deps split.

**Implement:** repo layout, tooling configs, an empty `export default (pi) => {}`, the `verify` script, CI workflow.
**Green light:** `npm run verify` passes; the extension factory runs against pi's public `ExtensionAPI` cleanly.

### M1 — Skills sync (reuse, ~0 logic)
**Red tests first:**
- `package/skills.test.ts`: after sync, `skills/` contains the expected `render-*/SKILL.md` set; each has valid frontmatter (`name`, `description`, `license`).

**Implement:** `scripts/sync-skills.sh` clones `render-oss/skills` at a **pinned SHA**, copies `skills/render-*` (incl. `references/`, `assets/`), commits the vendored output. Document re-sync in README.
**Green light:** verify green with real vendored skills present.

### M2 — Prompt templates
**Red tests first:**
- `package/prompts.test.ts`: `prompts/deploy-to-render.md` and `prompts/check-render-status.md` exist with non-empty bodies (the filename becomes the `/command`). Prompt templates are static markdown auto-loaded by pi from `prompts/`, so this is a content assertion, not an API test.

**Implement:** port `prompts/deploy-to-render.md` and `prompts/check-render-status.md` ~1:1 from the Claude Code / opencode plugins.
**Green light:** verify green.

### M3 — `@render` subagent  *(decision point)*
Pi's manifest has no native `agents` type. **Default decision:** ship `@render` as a **prompt template persona** (`prompts/render.md`) that frames Render-specialist behavior — lightest parity path. (Alternative, deferred: a true sub-agent-spawning tool à la Pi's `subagent/` example — more code, out of P1 scope.)
**Red tests first:**
- `package/render-agent.test.ts`: `prompts/render.md` exists with the Render-specialist persona body.

**Implement:** author `prompts/render.md` from `agents/render-assistant.md`.
**Green light:** verify green. *(If we instead want true sub-agents, re-scope this milestone explicitly.)*

### M4 — Blueprint validate hook + `render_validate_blueprint` tool (the meat)
**Red tests first (unit):**
- `unit/detect.test.ts`: recognizes `render.yaml`/`render.yml` (root + nested), ignores others; extracts touched paths from `write`/`edit`/`bash`-ish inputs (`path`/`file_path` keys).
- `unit/format.test.ts`: success output → clean pass result; validation errors → surfaced inline; `ENOENT` → install hint (`brew install render`).

**Red tests first (integration):**
- `extension/blueprint-hook.test.ts`: after loading the extension, the fake captures a `tool_result` handler and a `render_validate_blueprint` tool. Invoking the captured handler with a synthetic `render.yaml` write event (stubbed runner) enriches the result with validation output; a non-blueprint file event does not.
- `extension/blueprint-tool.test.ts`: invoking the captured `render_validate_blueprint` `execute` (stubbed CLI runner) returns the formatted result; a missing CLI yields the install hint, not a crash.

**Implement:** `detect.ts`, `format.ts`, pure; `runner.ts` wrapping `execFile("render", ["blueprints","validate"], {cwd})` behind an injectable interface; `hook.ts` wiring into `pi.on("tool_result")` + `pi.registerTool(...)`. Port opencode's `tool.execute.after` logic.
**Green light:** verify green; hook + tool covered for success / failure / CLI-missing.

### M5 — MCP wiring via `pi-mcp-adapter`
**Red tests first (unit):**
- `unit/mcp.test.ts`: `buildRenderMcpConfig(env)` returns a config with server `render` → `https://mcp.render.com/mcp`. **Auth resolution (resolved — see box below):** `RENDER_API_KEY` set → `{ auth: "bearer", bearerTokenEnv: "RENDER_API_KEY", lifecycle: "eager" }`; otherwise → `{ auth: "oauth", lifecycle: "lazy" }`. Both paths build a valid config — no key is no longer an error.

> **Resolved gap — `pi-mcp-adapter` auth wiring.** The adapter's per-server schema documents both paths natively, so no custom auth code is needed:
> - **OAuth (interactive default):** `auth: "oauth"`. Dynamic client registration when `oauth.clientId` is omitted; optional `oauth.{grantType,clientId,clientSecret,scope,redirectUri}`. The `/mcp-auth render` flow (or `settings.autoAuth: true`) drives it; credentials are stored in the OS credential store (headless Linux needs an unlocked libsecret keyring).
> - **API-key fallback (CI/non-interactive):** `auth: "bearer"` + `bearerTokenEnv: "RENDER_API_KEY"` (preferred — no secret in config), or `headers: { Authorization: "Bearer ${RENDER_API_KEY}" }`. `url`/`headers`/`bearerToken`/`env` support `${VAR}` and `$env:VAR` interpolation.
> - **Lifecycle:** `eager` (connect at start) is safe with a stored key/token; for OAuth-without-creds it would prompt on every launch, so use `lazy` (connect + auth on first tool use) on the OAuth path.

**Implement:** `src/mcp.ts` = `buildRenderMcpConfig(env)` (pure, per above) + `createMcpAdapter({ config: { mcpServers: { render: ... } } })`; compose into `src/index.ts`. The supplied `config` is the isolated-snapshot form, so it never touches the user's ambient MCP servers.
**Green light:** verify green. Manual one-time smoke test: `pi -e .`, then either run `/mcp-auth render` (OAuth) or set `RENDER_API_KEY`, and confirm it lists Render services. (Not in CI.)

### M6 — Auth & config surface
**Red tests first (unit):**
- `unit/config.test.ts`: reads `RENDER_API_KEY` (optional — OAuth is the interactive default); exposes settings keys (MCP allowlist / `directTools`, CLI-missing behavior) with sane defaults.
- `unit/cli.test.ts`: `render`-on-PATH detection; absent → structured install hint.

**Implement:** `config.ts`, `cli.ts`; wire the CLI-missing hint into the blueprint paths.
**Green light:** verify green.

### M7 — Package & release gate
**Red tests first:**
- `package/pack.test.ts`: `npm pack` tarball includes `src/`, `skills/`, `prompts/`, manifest; excludes `tests/`, dev cruft (assert via `files` field).

**Implement:** finalize `files`, README (install, `RENDER_API_KEY`, CLI prereq, re-sync note), CHANGELOG.
**Green light:** verify green; `npm pack` produces a clean, installable tarball.

---

## 7. TDD loop (per behavior)

1. **Red:** add the failing test in the milestone's file; run `vitest --watch` and see it fail for the *right* reason.
2. **Green:** write the minimum code to pass.
3. **Refactor:** clean up; keep tests green.
4. **Gate:** `npm run verify` before marking the behavior done.

---

## 8. CI

Single workflow (`.github/workflows/verify.yml`):
- Trigger: push + PR.
- Steps: checkout → setup Node LTS → `npm ci` → `npm run verify`.
- Branch protection: this check required to merge. (Skills sync runs locally/manually or as a separate scheduled workflow that opens a PR — never blocks the verify gate.)

---

## 9. Risks & open decisions

1. **`@render` as prompt vs. true sub-agent (M3).** Defaulting to a prompt-template persona for parity; true sub-agent spawning is a deferred enhancement. Confirm this satisfies "parity."
2. ~~**`pi-mcp-adapter` auth wiring (M5).**~~ **Resolved** (see the box in M5): the adapter's per-server schema natively supports both `auth: "oauth"` (interactive default) and `auth: "bearer"` + `bearerTokenEnv: "RENDER_API_KEY"` (CI fallback), so no custom auth code is needed. Remaining note: it's a community dep pinned to pi core — keep the wiring thin so we can swap it or fall back to CLI (`seed.md` §6.2).
3. **`render` CLI in CI.** We never invoke the real CLI in tests (injected/stubbed runner), so CI needs no `render` binary. The one live check is manual.
4. **No official pi test SDK.** We test glue against the public `ExtensionAPI` via a typed fake (see §2 box), so we track **latest pi** with no runtime-harness dependency. peerDeps stay `"*"`; dev pi-core is pinned to a current `^0.82.1` for reproducible typecheck. If we later need true end-to-end coverage, add a smoke layer with a local OpenAI-compatible endpoint (`registerProvider`/`models.json`) rather than adopting a version-locked harness.
5. **Skills sync reproducibility.** Pin a `render-oss/skills` SHA; re-sync is an explicit, reviewable PR.

---

## 10. First actions

1. M0 scaffold: `package.json` (manifest + deps split + scripts), `tsconfig.json`, `biome.json`, `vitest.config.ts`, empty `src/index.ts`, CI workflow.
2. Write M0's two red tests; make `npm run verify` green.
3. Proceed M1 → M7, each gated on a green `npm run verify`.
