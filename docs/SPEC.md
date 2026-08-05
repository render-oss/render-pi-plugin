# `@render/pi-render` — Specification

| | |
| --- | --- |
| **Target release** | `0.1.0` ("v1") |
| **Artifact** | one Pi package, installable via `pi install https://github.com/render-lab/render-pi-plugin` |
| **Pi baseline** | `@earendil-works/pi-coding-agent` `0.83.0` — automated checks and the extension load path are verified against this version |
| **Status** | implementation and automated release contents complete; clean-room auth smoke test and publication outstanding (§11) |

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
| Hosted Render MCP access | `pi-mcp-adapter`, configured programmatically | complete |
| Installable package | Pi manifest + GitHub source + `files` allowlist | complete locally; publication pending |

The complete v1 TypeScript surface is `src/mcp.ts` and `src/index.ts`: build a config object,
hand it to `createMcpAdapter`, invoke the returned extension with `pi`. Anything larger than
that is a signal to re-read §2.2.

### 2.2 Why v1 is this small

Two properties of Pi make most of the obvious surface area redundant, and both were confirmed
against pi `0.83.0` rather than assumed:

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
  "files": ["src", "skills", "README.md", "LICENSE", "CHANGELOG.md"]
}
```

`pi.prompts` MUST NOT be present in v1 — there is no prompts directory (§9.1).

### 3.2 Dependency split

Pi installs packages with `npm install --omit=dev`, so misplacing a dependency breaks the
package at runtime rather than at build time.

| Bucket | Contents | Reason |
| --- | --- | --- |
| `dependencies` | `pi-mcp-adapter` at the release-tested exact version (`2.19.0`) | imported at runtime; must survive `--omit=dev`; exact pin prevents an untested adapter feature default from changing the tool surface |
| `peerDependencies` (all `"*"`) | `@earendil-works/pi-coding-agent`, `-ai`, `-tui`, `typebox` | Pi provides these at runtime; pinning them risks a duplicate, mismatched copy |
| `devDependencies` | pi core at the release-tested pin (`0.83.0`), `vitest`, `@biomejs/biome`, `typescript`, `@types/node` | typecheck against current pi types; never shipped |

Pi core MUST NOT appear in `dependencies`.

### 3.3 No build step

Pi loads `.ts` directly via jiti, so the package ships TypeScript source. `tsc` is a
correctness gate only (`--noEmit`) and there MUST NOT be a compile artifact or `dist/`.

### 3.4 Layout

```
pi-render/
├── package.json              # pi manifest, deps split, scripts
├── package-lock.json         # reproducible Git-package dependency install
├── tsconfig.json             # base ESM + strict settings
├── tsconfig.typecheck.json   # typecheck-only adapter contract mapping
├── types/                    # narrow contract for adapter's source-only package export
├── .github/workflows/
│   ├── verify.yml            # package correctness gate
│   └── sync-skills.yml       # daily/manual verified skill-sync PR
├── biome.json                # lint + format
├── vitest.config.ts          # globals + tsconfig-paths
├── LICENSE, CHANGELOG.md
├── src/
│   ├── index.ts              # extension entry: export default (pi) => { ... }
│   └── mcp.ts                # buildRenderMcpConfig(env) + adapter composition
├── skills/                   # VENDORED from render-oss/skills — generated, committed
├── scripts/
│   └── sync-skills.sh        # configurable source/ref → distributable skills + provenance
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

**Source.** `renderinc/skills` is the source of truth. Its existing Copybara workflow publishes
the distributable subset to `render-oss/skills`, excluding source-only eval inputs and internal
documentation. Production `pi-render` syncs MUST read from that public mirror without private-repo
credentials. Skills MUST NOT be forked or edited in place; `skills/` is generated output that
happens to be committed.

**Sync.** `scripts/sync-skills.sh` accepts `--repo` and `--ref` (defaulting to the public mirror's
`main`), resolves the checkout to an exact commit, copies every `skills/render-*` directory with
its `references/` and `assets/`, applies the public mirror's eval-file exclusions, and writes a
deterministic `skills/.sync-source` containing source, ref, and commit. `--dest` exists for
isolated testing. No wall-clock timestamp is recorded, so an unchanged source produces no diff.

`.github/workflows/sync-skills.yml` runs daily at 06:00 UTC and via `workflow_dispatch`, runs the
sync followed by the full verify gate, then creates or updates a `skills-sync` pull request.
Squash auto-merge is gated behind `SKILLS_SYNC_AUTOMERGE=true` and MUST remain disabled until the
verify check is required. Local development MAY point `--repo` at the `renderinc/skills` clone;
the exclusion transform must produce the same distributable skill files as the public mirror.

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

**Tool surface.** v1 sets `directTools: false`, exposing discovered tools through the adapter's
context-saving `mcp` proxy rather than registering every Render operation directly. It also sets
`settings.scriptMode: false`: adapter `2.19.0` enables the separate `mcp_script` tool by default,
but that expands v1 beyond the deliberately minimal proxy surface. A curated direct-tool
allowlist MAY be added later with explicit context-cost and startup-bootstrap tests.

---

## 5. Authentication

Both paths are native to the adapter's per-server schema, so this package MUST NOT implement
auth logic of its own.

| Path | Config | Lifecycle | Use |
| --- | --- | --- | --- |
| OAuth | `auth: "oauth"`, `oauth.clientId: "pi"` | `lazy` | interactive default |
| API key | `auth: "bearer"`, `bearerTokenEnv: "RENDER_API_KEY"` | `lazy` | CI / non-interactive |

**OAuth** is the interactive default and needs no API key, matching the Claude Code plugin. The user
drives it with `/mcp-auth render` (or `settings.autoAuth: true`), and credentials land in the OS
credential store. Headless Linux requires an unlocked libsecret keyring.

`oauth.clientId` is **required, not optional**. Render's authorization server
(`https://api.render.com`, discovered through the MCP server's protected-resource metadata)
publishes `authorization_code` and `refresh_token` grants with S256 PKCE and no
`registration_endpoint`. Dynamic client registration is therefore impossible. The adapter attempts
registration precisely when `oauth.clientId` is omitted, and that attempt fails with a 401 and a
misleading "does not appear to speak MCP" error, breaking the default auth path for every user.

Render pre-registers one public PKCE client per integration — `claude`, `cursor`, `codex`, and `pi`
for this package. These IDs are public and carry no client secret. This is why the Claude Code
plugin ships `oauth.clientId: "claude"` rather than relying on registration.

**Lifecycle is not a free choice.** Both paths are `lazy`, so the adapter does not launch OAuth or
keep a Render connection open at startup. The adapter has one documented exception: when its
metadata cache does not exist, the first session makes a best-effort connection to populate it.
Failure is contained to MCP and MUST NOT prevent Pi or the Render skills from loading. Authenticated
operations connect on demand after that bootstrap.

`RENDER_API_KEY` MUST be passed by environment variable reference (`bearerTokenEnv`), never
inlined as a literal. This package checks only whether a non-empty value is present to select the
auth mode; the adapter resolves the value when connecting, so the secret never enters the config
object or logs.

Absence of a key is not an error: it selects the OAuth path.

---

## 6. Integration seams

Every seam below exists in pi `0.83.0` as described. Note how little they touch each other —
the components are independent paths into Pi and share no state, which is what keeps the glue
thin and the deferred work cheap to add later.

| Component | Seam | Kind |
| --- | --- | --- |
| Skills | `pi.skills` manifest field → Pi discovers `SKILL.md` | declarative |
| Extension code | `pi.extensions` → `export default (pi: ExtensionAPI) => void` | code |
| Render MCP | `createMcpAdapter({ config })` returns `(pi: ExtensionAPI) => …`, composed by calling it | code |
| Skills freshness | Copybara public mirror → configurable clone → resolved SHA → daily verified PR | build-time |

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

A second workflow, `.github/workflows/sync-skills.yml`, runs on a daily schedule and manual
dispatch. It uses only `render-oss/skills`, verifies the synchronized tree before creating a PR,
and creates the `skills-sync` label if needed. `peter-evans/create-pull-request@v7` owns a stable
`sync-skills` branch so repeated runs update one PR rather than creating duplicates.
Public-origin changes travel back through the existing reverse-Copybara PR workflow and can
temporarily lead `renderinc/skills` until that PR merges; therefore the public mirror remains the
release input, and local-clone output MUST be compared before release use.

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
3. Manual smoke test, once, outside CI:
   `pi -e https://github.com/render-lab/render-pi-plugin`, then `/mcp-auth render` (or
   `RENDER_API_KEY`), and confirm it lists Render services.
4. Version `0.1.0`, with release notes stating v1 is a subset of the sibling plugins (§1.1).

Distribution for v0.1.0 is the public Git repository
`https://github.com/render-lab/render-pi-plugin`; npm publication is out of scope for this release.

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

Two corrections from auditing the seams against pi `0.83.0`, both of which would otherwise
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

An earlier plan called for `config.ts` and `cli.ts`. Neither is needed: this package checks only
for the presence of `RENDER_API_KEY`, while the adapter resolves its value via `bearerTokenEnv`;
`directTools` is one field in the §4.2 config object; and `render`-on-PATH detection existed only
to serve §9.3.

---

## 10. Risks and constraints

1. **`pi-mcp-adapter` is a community dependency tested against older pi core.** At `2.19.0` it
   dev-pins pi `0.79.10` while this package targets `0.83.0`. It is the right call for v1 —
   hand-rolling an MCP client is far more risk — but the wiring MUST stay thin enough to swap the
   adapter, or fall back to the `render` CLI, if it goes stale.
2. **v1 is not at parity with the sibling plugins.** Accepted and deliberate (§1.1). The risk is
   communication, not engineering: do not let release notes or docs imply otherwise.
3. **No official pi test SDK.** Mitigated by the public-API fake (§7.2). Peer dependencies stay
   `"*"`; dev pi core stays pinned to a current version for reproducible typechecking.
4. **Skills can drift from upstream.** Deterministic provenance makes drift explicit, while the
   daily workflow bounds detection to one day and opens a verified reviewable PR. A disabled or
   failing schedule remains visible as GitHub Actions health and can be retried through manual
   dispatch.
5. **OAuth needs a working credential store.** Headless Linux requires an unlocked libsecret
   keyring; `RENDER_API_KEY` is the documented escape hatch.
6. **The current Pi development package has development-only audit findings.** Pi `0.83.0`'s
   nested dependency tree currently reports advisories for `brace-expansion` and `undici`. They
   are absent from `npm ci --omit=dev` and the shipped dependency audit is clean; recheck when a
   newer Pi release updates its shrinkwrap.

---

## 11. Outstanding work

1. **Clean-room live auth smoke test (§8.2).** Exercise OAuth and `RENDER_API_KEY` from the
   published Git source and confirm a Render service listing.
2. **Publication.** Push the verified commit to the public `render-lab/render-pi-plugin` repository,
   enable required CI, tag `v0.1.0`, and verify the guide's exact installation command.
3. **Hosted sync validation.** Run `sync-skills.yml` manually after publication, confirm the
   current upstream produces no PR, then validate one controlled source change opens a verified
   PR with updated provenance.
4. **Source/public reconciliation.** Merge the reverse-sync of public OAuth skill change
   `render-oss/skills@4e4a00a` into `renderinc/skills`, then re-run the local/public parity check.
