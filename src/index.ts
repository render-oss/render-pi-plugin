import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

/**
 * pi-render — Render integration for the Pi coding agent.
 *
 * Phase 1 scaffold (M0): registers nothing yet. Subsequent milestones wire in:
 *   M2 prompt templates, M3 the @render subagent, M4 the blueprint-validate
 *   hook + `render_validate_blueprint` tool, M5 Render MCP access, M6 config.
 * See PLAN.md.
 */
export default function piRender(_pi: ExtensionAPI): void {
  // Intentionally empty for M0. Behavior lands in M2–M6.
}
