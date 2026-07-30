# `@render/pi-render` — Specification

| | |
| --- | --- |
| **Target release** | `0.1.0` ("v1") |
| **Artifact** | one Pi package, installable via `pi install npm:@render/pi-render` or `pi install git:github.com/render-oss/pi-render` |
| **Pi baseline** | `@earendil-works/pi-coding-agent` `0.82.1` — every seam in §6 was verified against this version |
| **Status** | skills complete; MCP access and the release gate outstanding (§10) |

This document specifies what `pi-render` is, what it must do, and the interfaces it integrates
through. It is the single source of truth for scope; earlier scope and planning notes were folded
into it and removed.

`MUST` / `MUST NOT` are binding requirements. `SHOULD` marks a strong default that may be
overridden with a recorded reason. `MAY` is optional.

---

## 1. Purpose

Bring Render into the Pi coding agent by supplying two things Pi cannot supply itself:

1. **Render knowledge** — how to write a Blueprint, choose a service type, debug a failed
   deploy, read metrics — as skills the model loads on demand.
2. **Render control plane access** — list and create services, trigger and inspect deploys,
   read logs, manage environment variables, query Postgres — via the hosted Render MCP server.

Everything is assembled from assets Render already maintains. This package contributes glue,
not capability: no forked skills, no re-wrapped REST API, no hand-rolled MCP client.

### 1.1 Non-goals

- **Parity with the sibling plugins is not claimed.** `render-plugin-claude-code`,
  `render-opencode-plugin`, `render-codex-plugin`, and `render-cursor-plugin` also ship slash
  commands, a Render subagent, and a Blueprint validation hook. v1 ships neither the commands
  nor the subagent (§9.1, §9.2) and defers the hook (§9.3). Release notes MUST describe v1 as a
  subset rather than implying parity.
- **Render Workflows tooling is out of scope**, and with it the `@renderinc/sdk` dependency.
- **Pi-native polish** (custom renderers, TUI panels, status widgets) is out of scope.

---

## 2. Scope

### 2.1 v1 deliverables

| Deliverable | Mechanism | Status |
| --- | --- | --- |
| Render skills, model-loadable | vendored from `render-oss/skills`, declared via `pi.skills` | complete — 21 skills |
| Hosted Render MCP access | `pi-mcp-adapter`, configured programmatically | outstanding |
| Installable package | npm manifest + `files` allowlist | outstanding |

The complete v1 TypeScript surface is `src/mcp.ts` and `src/index.ts`: build a config object,
hand it to `createMcpAdapter`, invoke the returned extension with `pi`. Anything larger than
that is a signal to re-read §2.2.

### 2.2 Why v1 is this small

Two properties of Pi make most of the obvious surface area redundant, and both were confirmed
against pi `0.82.1` rather than assumed:

1. **Pi already turns every skill into a slash command.** It scans skill locations at startup,
   keeps names and descriptions in context, loads the full `SKILL.md` on demand, and registers
   each skill as `/skill:<name>`. A prompt template whose body is "Follow the **render-deploy**
   skill" is therefore a second name for `/skill:render-deploy` — no new capability, and a
   second place for Render guidance to drift out of sync.
2. **The skills already carry their own CLI instructions.** `render blueprints validate` appears
   five times in the `render-blueprints` skill, including as a runnable bash block. Automation
   around it adds *enforcement*, not knowledge.

The governing rule: **if a vendored skill already covers a behavior, this package MUST NOT
restate it.** A sibling plugin shipping something is not on its own sufficient justification.

---

## 3. Package contract

### 3.1 Manifest

`package.json` MUST declare:

```jsonc
{
  "keywords": ["pi-package"],        // required for discovery
  "type": "module",
  "pi": {
    "extensions": ["./src/index.ts"],
    "skills": ["./skills"]
  },
  "files": ["src", "skills", "README.md"]
}
```

`pi.prompts` MUST NOT be present in v1 — there is no prompts directory (§9.1).

### 3.2 Dependency split

Pi installs packages with `npm install --omit=dev`, so misplacing a dependency breaks the
package at runtime rather than at build time.

| Bucket | Contents | Reason |
| --- | --- | --- |
| `dependencies` | `pi-mcp-adapter` | imported at runtime; must survive `--omit=dev` |
| `peerDependencies` (all `"*"`) | `@earendil-works/pi-coding-agent`, `-ai`, `-tui`, `typebox` | Pi provides these at runtime; pinning them risks a duplicate, mismatched copy |
| `devDependencies` | pi core at a current pin (`^0.82.1`), `vitest`, `vite-tsconfig-paths`, `@biomejs/biome`, `typescript`, `@types/node` | typecheck against current pi types; never shipped |

Pi core MUST NOT appear in `dependencies`.

### 3.3 No build step

Pi loads `.ts` directly via jiti, so the package ships TypeScript source. `tsc` is a
correctness gate only (`--noEmit`) and there MUST NOT be a compile artifact or `dist/`.

### 3.4 Layout

```
pi-render/
├── package.json              # pi manifest, deps split, scripts
├── tsconfig.json             # typecheck-only, ESM, strict
├── biome.json                # lint + format
├── vitest.config.ts          # globals + tsconfig-paths
├── src/
│   ├── index.ts              # extension entry: export default (pi) => { ... }
│   └── mcp.ts                # buildRenderMcpConfig(env) + adapter composition
├── skills/                   # VENDORED from render-oss/skills — generated, committed
├── scripts/
│   └── sync-skills.sh        # clone render-oss/skills @ pinned SHA → skills/
├── tests/
│   ├── support/              # fake-pi.ts (typed ExtensionAPI double)
│   ├── unit/                 # pure-function tests
│   ├── extension/            # wiring tests via the fake API
│   └── package/              # manifest + vendored-skill validation
└── docs/SPEC.md, README.md
```

---

## 4. Components

### 4.1 Vendored skills

**Requirement.** The package ships Render's OSS skills so the model can load them on demand.

**Source.** `render-oss/skills` is the single source of truth. Skills MUST NOT be forked or
edited in place; `skills/` is generated output that happens to be committed.

**Sync.** `scripts/sync-skills.sh` clones the upstream repo at a **pinned commit SHA**, copies
every `skills/render-*` directory including `references/` and `assets/`, and writes
`skills/.sync-source` recording the source repo, commit, and timestamp. Re-syncing is a
deliberate act: bump the pin in its own reviewable pull request. The sync script MUST NOT run
as part of the verify gate or block CI.

**Integration.** Declarative only, through the `pi.skills` manifest field. There is no code
path — Pi discovers `SKILL.md` files itself.

**Constraint.** Every vendored skill MUST have a `SKILL.md` whose frontmatter carries `name`
(matching its directory), `description`, and `license`. Pi silently skips skills with no
description, so a missing one is a shipping defect, not a cosmetic one.

**Required skills.** At minimum `render-deploy`, `render-blueprints`, `render-debug`,
`render-monitor`, `render-workflows`, `render-cli`.

### 4.2 Render MCP access

**Requirement.** Expose the hosted Render MCP server's tools as Pi tools — services, deploys,
logs, environment variables, Postgres queries, create and redeploy — with no REST re-wrapping
and no custom MCP client.

**Server.** `https://mcp.render.com/mcp`.

**Client.** `pi-mcp-adapter`, a mature community MCP client with a programmatic API intended
for "an integration that already owns its MCP config." Pi ships no MCP support by design, so
this package MUST depend on the adapter rather than implement transport, JSON-Schema→typebox
conversion, paginated discovery, cancellation, or reconnection itself.

**Configuration.** `src/mcp.ts` exports a pure `buildRenderMcpConfig(env)` returning a config
whose single server is `render`. `src/index.ts` passes it to `createMcpAdapter({ config })` and
invokes the returned extension function with `pi`.

Supplying `config` programmatically yields an **isolated snapshot**: it is cloned, never merged
with the user's ambient MCP servers, and never mutated. That isolation is the point, and it has
a user-visible cost that the README MUST document — with programmatic config the adapter
disables `/mcp setup`, `/mcp enable`, and `/mcp disable`, and `/mcp status` reports only the
in-memory config.

**Tool surface.** The adapter proxies all discovered tools through one context-saving proxy
tool by default and accepts a `directTools` allowlist (`boolean | string[]`) to promote chosen
tools to first-class registrations. v1 SHOULD ship proxy-by-default plus a curated allowlist.

---

## 5. Authentication

Both paths are native to the adapter's per-server schema, so this package MUST NOT implement
auth logic of its own.

| Path | Config | Lifecycle | Use |
| --- | --- | --- | --- |
| OAuth | `auth: "oauth"` | `lazy` | interactive default |
| API key | `auth: "bearer"`, `bearerTokenEnv: "RENDER_API_KEY"` | `eager` | CI / non-interactive |

**OAuth** is the interactive default and needs no API key, matching the Claude Code plugin. The
adapter performs dynamic client registration when `oauth.clientId` is omitted; the user drives
it with `/mcp-auth render` (or `settings.autoAuth: true`), and credentials land in the OS
credential store. Headless Linux requires an unlocked libsecret keyring.

**Lifecycle is not a free choice.** `eager` connects at startup, which is fine once a token is
stored but would prompt on every launch when OAuth has no credentials yet — hence `lazy` on the
OAuth path, connecting and authenticating on first tool use.

`RENDER_API_KEY` MUST be passed by environment variable reference (`bearerTokenEnv`), never
inlined as a literal. This package never reads the variable itself, so the secret does not pass
through code we own.

Absence of a key is not an error: it selects the OAuth path.

---

## 6. Integration seams

Every seam below exists in pi `0.82.1` as described. Note how little they touch each other —
the components are independent paths into Pi and share no state, which is what keeps the glue
thin and the deferred work cheap to add later.

| Component | Seam | Kind |
| --- | --- | --- |
| Skills | `pi.skills` manifest field → Pi discovers `SKILL.md` | declarative |
| Extension code | `pi.extensions` → `export default (pi: ExtensionAPI) => void` | code |
| Render MCP | `createMcpAdapter({ config })` returns `(pi: ExtensionAPI) => …`, composed by calling it | code |
| Skills freshness | `git clone` at a pinned SHA | build-time |

Seams reserved for deferred work: `pi.on("tool_result", …)` for hooks, `pi.registerTool(…)` for
model-callable tools, and `pi.exec(command, args, options)` for subprocesses (§9.3).

---

## 7. Testing requirements

`npm run verify` — `tsc --noEmit && biome check . && vitest run` — is the single gate. CI runs
the identical command. Nothing is "done" until it passes.

Development is test-first: a failing test that fails for the *right* reason, then the minimum
code to pass, then refactor.

### 7.1 What is tested, and what is a boundary

This package tests **its own glue**. Render's MCP server, the `render` CLI, `pi-mcp-adapter`,
and the model are boundaries.

| Layer | Approach |
| --- | --- |
| Pure logic | Vitest, called directly — e.g. `buildRenderMcpConfig` |
| Extension wiring | strict fake `ExtensionAPI` (§7.2): invoke the factory, assert captured registrations, then drive captured handlers with synthetic events |
| `pi-mcp-adapter` / Render MCP | assert the **config handed to the adapter**; never the network |
| Vendored skills | **pi's own `loadSkillsFromDir`** (§7.3) |
| Shipped artifact | `npm pack --dry-run --json`, asserting on the real file list (§8.2) |
| LLM | not in the loop |

Tests MUST NOT reach `mcp.render.com`, invoke a real `render` binary, or call a model. Live
wiring is confirmed by a one-time manual smoke test (§8.2), never in CI.

**Design-for-test rule.** Split pure logic from side effects; keep the side-effecting part thin
and injectable.

**Assertions MUST be shown to fail.** A test that cannot fail is worse than no test, because it
reads as coverage. New assertions SHOULD be checked by mutating the thing they guard — break a
reference link, desync the pin, shorten a description — and confirming the suite goes red for the
stated reason. Watch for mutations that silently no-op; a passing suite under a mutation that was
never applied proves nothing.

### 7.2 Why a fake `ExtensionAPI` instead of a test harness

Every published pi test harness is hard-coupled to pre-`0.80` internals: they import the moved
`getModel` and monkeypatch private fields (`session._modelRegistry`,
`session.agent.streamFn`/`getApiKey`) to bypass auth. On pi `0.82` the auth preflight fires
("No API key found"). Rather than pin to old pi or fork a harness, `tests/support/fake-pi.ts`
implements a small typed double over pi's **public** `ExtensionAPI`, capturing what the
extension registers.

This tracks latest pi — typecheck catches API drift — with no fragile dependencies. The
trade-off is that model tool-calling is not simulated, which is acceptable because the subject
under test is the glue, not model behavior. An end-to-end layer (a local OpenAI-compatible
endpoint via `registerProvider`) SHOULD be added only if a real-runtime need appears.

Two properties keep the double from degenerating into a bag of no-ops, which is the usual way a
fake stops testing anything:

- **It is strict.** Reading any `ExtensionAPI` member the double does not model throws, naming the
  member. Adding one MUST be deliberate and MUST come with an assertion about its behavior.
- **It validates registrations** against pi's real `ToolDefinition` contract — `name`, `label`,
  `description`, `parameters`, `execute`, and no duplicate names — so a tool pi would reject at
  load time fails in tests instead.

Because every extension test depends on those properties holding, the double has its own tests.

### 7.3 Validate skills with pi's loader, not our own parser

Skill checks MUST go through pi's exported `loadSkillsFromDir`, asserting that `diagnostics` is
empty. Its diagnostics are precisely the complaints a user would hit at startup, and pi silently
skips a skill whose description is missing — a failure that is invisible from the outside.

Hand-rolled frontmatter parsing is specifically prohibited here. Most of the vendored skills use
folded YAML (`description: >-`), which a line-based parser reads as the literal `">-"`. That value
is truthy, so a naive "description is present" check passes while verifying nothing.

Skill descriptions are concatenated into the system prompt on every request, so the suite also
bounds the total size of that block as a regression guard.

---

## 8. CI and release

### 8.1 CI

One workflow, `.github/workflows/verify.yml`: on push to `main` and on pull requests, check out,
set up Node, `npm ci`, `npm run verify`. This check SHOULD be required by branch protection.

Biome's lint rules MUST stay on a real preset (`recommended`). A `"preset": "none"` configuration
leaves `biome check` validating formatting only, which makes the gate's lint step decorative.

Because v1 depends on no external binary, CI needs no `render` CLI and no credentials.

### 8.2 Release gate

Before publishing:

1. `npm pack` includes `src/`, the manifest, and every skill's `SKILL.md` *together with its
   `references/` and `assets/`* — a skill that ships without the files its body points at loads
   without diagnostics but is broken for installed users. Excludes `tests/`, `docs/`, and dev
   configuration. This is asserted automatically against the real pack manifest, not just the
   `files` allowlist.
2. README covers installation, OAuth via `/mcp-auth render`, `RENDER_API_KEY` for CI, the
   `/mcp` subcommand limitation from §4.2, and how to re-sync skills.
3. Manual smoke test, once, outside CI: `pi -e .`, then `/mcp-auth render` (or
   `RENDER_API_KEY`), and confirm it lists Render services.
4. Version `0.1.0`, with release notes stating v1 is a subset of the sibling plugins (§1.1).

Distribution is npm as `@render/pi-render` and/or git under `render-oss`.

---

## 9. Deferred work

Recorded so these decisions are not silently re-litigated. Each entry states what would justify
revisiting it.

### 9.1 Prompt templates — cut

`/deploy-to-render` and `/check-render-status` were four-line files delegating to a skill,
duplicating the `/skill:render-*` commands Pi generates for free (§2.2). Removed along with the
`pi.prompts` manifest entry.

**Revisit when** a template does something a skill cannot: take arguments, or compose several
skills into one flow.

### 9.2 `@render` subagent — cut

Pi has no `agents` manifest field, so this was implemented as a `/render` prompt persona — which
made it a third copy of guidance already in the skills, competing with them as a source of
Render instruction. A true subagent means `registerTool` plus a spawned `pi` subprocess; pi's own
bundled `subagent/` example runs past 1,100 lines.

**Revisit when** context isolation for long Render operations is worth that cost.

### 9.3 Blueprint validate hook and `render_validate_blueprint` tool — deferred to v1.1

Auto-run `render blueprints validate` when the agent writes `render.yaml`/`render.yml`, surface
failures inline, and expose a standalone tool. Ported from the opencode plugin's
`tool.execute.after` logic onto `pi.on("tool_result")`.

Deferred because the `render-blueprints` skill already documents the command (§2.2), making this
enforcement rather than capability — while being the largest code surface in the original plan and
adding the `render` CLI as a second install prerequisite.

**Shape when picked up.** Pure `detect` (blueprint filename match, touched-path extraction from
`path`/`file_path` inputs) and `format` (pass, validation failure, CLI missing) modules; an
injectable runner for the subprocess; a `hook` module wiring `pi.on("tool_result")` and
`pi.registerTool`. Cover success, validation failure, and `ENOENT` → install hint
(`brew install render`).

Two corrections from auditing the seams against pi `0.82.1`, both of which would otherwise
produce a quietly broken hook:

- **`ToolResultEventResult.content` replaces the tool's content — it does not append.**
  Enriching a result means returning `[...event.content, validationText]`; returning only the
  validation text swallows the write tool's own output.
- **Prefer `pi.exec(...)` to node's `execFile`.** `ExtensionAPI` exposes
  `exec(command, args, options)` directly. Keep the injectable-runner seam for testability, but
  put `pi.exec` behind it.

This work also requires relaxing the current assertion in `tests/extension/loads.test.ts` that
the extension registers nothing.

### 9.4 Auth and config module — dissolved

An earlier plan called for `config.ts` and `cli.ts`. Neither is needed: the adapter resolves
`RENDER_API_KEY` via `bearerTokenEnv` so this package never reads it, a `directTools` allowlist
is one field in the §4.2 config object, and `render`-on-PATH detection existed only to serve
§9.3.

---

## 10. Risks and constraints

1. **`pi-mcp-adapter` is a community dependency pinned to pi core.** At `2.15.0` it dev-pins pi
   `0.79.10` while this package targets `0.82.1`. It is the right call for v1 — hand-rolling an
   MCP client is far more risk — but the wiring MUST stay thin enough to swap the adapter, or
   fall back to the `render` CLI, if it goes stale.
2. **v1 is not at parity with the sibling plugins.** Accepted and deliberate (§1.1). The risk is
   communication, not engineering: do not let release notes or docs imply otherwise.
3. **No official pi test SDK.** Mitigated by the public-API fake (§7.2). Peer dependencies stay
   `"*"`; dev pi core stays pinned to a current version for reproducible typechecking.
4. **Skills can drift from upstream.** The pinned SHA makes drift explicit and reviewable rather
   than silent. The cost is that re-syncing is a deliberate task someone must remember to do.
5. **OAuth needs a working credential store.** Headless Linux requires an unlocked libsecret
   keyring; `RENDER_API_KEY` is the documented escape hatch.

---

## 11. Outstanding work

1. **MCP access (§4.2, §5).** `buildRenderMcpConfig(env)` with unit tests first, then the
   `createMcpAdapter(...)(pi)` composition in `src/index.ts`. Relax `loads.test.ts`, which
   asserts the extension registers nothing.
2. **Manual smoke test (§8.2).**
3. **Release gate (§8.2).** `files` allowlist, README, CHANGELOG, `0.1.0`.
