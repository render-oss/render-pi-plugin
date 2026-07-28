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
| Extension test harness | **`@marcfargas/pi-test-harness`** | In-process real Pi runtime + playbook-mocked LLM (`when/calls/says`), `mockTools`, `mockUI`, `createMockPi()` |
| Path resolution in tests | `vite-tsconfig-paths` | Resolves pi core type paths during transpile |
| Lint/format | **Biome** | Single fast tool; matches pi-extensions convention |
| Typecheck | `tsc --noEmit` | Correctness gate only |
| Package manager | **npm** | Pi installs packages with `npm install --omit=dev` |

**Dependencies split** (critical — Pi installs with `--omit=dev`):
- `dependencies`: `pi-mcp-adapter` (runtime glue we actually import).
- `peerDependencies` (`"*"`): `@earendil-works/pi-coding-agent`, `@earendil-works/pi-ai`, `@earendil-works/pi-tui`, `typebox` — provided by Pi at runtime.
- `devDependencies`: the same pi core packages (so tests/typecheck resolve) **pinned to `0.79.10`**, `@earendil-works/pi-agent-core` (harness peer), `@marcfargas/pi-test-harness`, `vitest`, `vite-tsconfig-paths`, `@biomejs/biome`, `typescript`, `@types/node`.

> **Known constraint — harness ↔ pi-core version pin (found in M0).** Every published pi test-harness (`@marcfargas`, `@gaodes`) imports `getModel` from `@earendil-works/pi-ai`, which was **removed in pi-ai `0.80.0`** (now `createModels`). So the *test runtime* is pinned to the last compatible pi-core, **`0.79.10`**. This is dev-only: our `peerDependencies` stay `*`, so the package still runs against whatever current pi the user has installed. Extension code must therefore stick to API surface present in **both** 0.79.x and current pi (the stable `registerTool`/`on`/`registerCommand`/`ctx.ui` surface — safe). Revisit when a harness targeting pi ≥0.80 ships.

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
│   ├── unit/                 # pure-function tests (no harness)
│   ├── integration/          # pi-test-harness session tests
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
| Pure logic | Vitest, no harness | blueprint filename match, output formatting, MCP config builder, API-key/CLI detection |
| Extension behavior (tools, hooks, commands) | pi-test-harness in-process session | `render_validate_blueprint` returns formatted result; auto-validate fires on `render.yaml` write; commands are registered/expand |
| `render` CLI | **injected runner** in unit tests; `createMockPi()`-style PATH shim / stub runner in integration | success, failure, and `ENOENT` (CLI missing → install hint) |
| Render MCP / `pi-mcp-adapter` | boundary: assert the **config we hand it**, never the network | `buildRenderMcpConfig` points at `https://mcp.render.com/mcp`, `lifecycle: "eager"`, auth from env |
| LLM | harness playbook (`when/calls/says`) | deterministic; never a live model |
| Skills content | package test asserts presence + valid frontmatter | not re-testing Render's skill prose |

We do **not** write tests that hit `mcp.render.com`, the real `render` CLI, or a real model. Live wiring is verified once, manually, in the M5/M7 smoke check.

---

## 6. Milestones (each ends on a green light)

Order follows `seed.md`'s build order. Each milestone: **write the red tests first**, implement the minimum to pass, refactor, then `npm run verify`.

### M0 — Scaffold + green harness
**Red tests first:**
- `integration/loads.test.ts`: `createTestSession({ extensions: ["./src/index.ts"] })` loads, and `t.run(when("hi", [says("hi")]))` completes without error.
- `package/manifest.test.ts`: `package.json` has `keywords: ["pi-package"]`, a `pi` manifest, correct deps split.

**Implement:** repo layout, tooling configs, an empty `export default (pi) => {}`, the `verify` script, CI workflow.
**Green light:** `npm run verify` passes; empty extension loads in a real Pi session.

### M1 — Skills sync (reuse, ~0 logic)
**Red tests first:**
- `package/skills.test.ts`: after sync, `skills/` contains the expected `render-*/SKILL.md` set; each has valid frontmatter (`name`, `description`, `license`).

**Implement:** `scripts/sync-skills.sh` clones `render-oss/skills` at a **pinned SHA**, copies `skills/render-*` (incl. `references/`, `assets/`), commits the vendored output. Document re-sync in README.
**Green light:** verify green with real vendored skills present.

### M2 — Prompt templates
**Red tests first:**
- `integration/commands.test.ts`: `/deploy-to-render` and `/check-render-status` appear in `pi.getCommands()` (source = template) and expand to their markdown body.

**Implement:** port `prompts/deploy-to-render.md` and `prompts/check-render-status.md` ~1:1 from the Claude Code / opencode plugins.
**Green light:** verify green.

### M3 — `@render` subagent  *(decision point)*
Pi's manifest has no native `agents` type. **Default decision:** ship `@render` as a **prompt template persona** (`prompts/render.md`) that frames Render-specialist behavior — lightest parity path. (Alternative, deferred: a true sub-agent-spawning tool à la Pi's `subagent/` example — more code, out of P1 scope.)
**Red tests first:**
- `integration/render-agent.test.ts`: the `/render` command is registered and expands to the persona prompt.

**Implement:** author `prompts/render.md` from `agents/render-assistant.md`.
**Green light:** verify green. *(If we instead want true sub-agents, re-scope this milestone explicitly.)*

### M4 — Blueprint validate hook + `render_validate_blueprint` tool (the meat)
**Red tests first (unit):**
- `unit/detect.test.ts`: recognizes `render.yaml`/`render.yml` (root + nested), ignores others; extracts touched paths from `write`/`edit`/`bash`-ish inputs (`path`/`file_path` keys).
- `unit/format.test.ts`: success output → clean pass result; validation errors → surfaced inline; `ENOENT` → install hint (`brew install render`).

**Red tests first (integration):**
- `integration/blueprint-hook.test.ts`: with an injected/stubbed runner, editing `render.yaml` triggers `tool_result` enrichment carrying validation output; editing a non-blueprint file does not.
- `integration/blueprint-tool.test.ts`: `render_validate_blueprint` tool runs the (stubbed) CLI and returns the formatted result; missing CLI yields the install hint, not a crash.

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

**Implement:** finalize `files`, README (install, `RENDER_API_KEY`, CLI prereq, re-sync note), CHANGELOG. Optional: an install-verification test using the harness's sandbox-install feature.
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
4. **pi core version drift / harness lag.** peerDeps are `"*"`; the test runtime is pinned to pi-core `0.79.10` because the harness predates the pi-ai `getModel`→`createModels` rename (see the box in §2). CI is reproducible via that pin; bump deliberately once a harness targeting pi ≥0.80 exists. Keep extension code within the API common to 0.79.x and current pi.
5. **Skills sync reproducibility.** Pin a `render-oss/skills` SHA; re-sync is an explicit, reviewable PR.

---

## 10. First actions

1. M0 scaffold: `package.json` (manifest + deps split + scripts), `tsconfig.json`, `biome.json`, `vitest.config.ts`, empty `src/index.ts`, CI workflow.
2. Write M0's two red tests; make `npm run verify` green.
3. Proceed M1 → M7, each gated on a green `npm run verify`.
