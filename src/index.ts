import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

/**
 * pi-render — Render integration for the Pi coding agent.
 *
 * v1 ships two things: the vendored Render skills (declared via `pi.skills` in
 * package.json — no code path here) and hosted Render MCP access via
 * `createMcpAdapter(...)(pi)`. See docs/SPEC.md.
 */
export default function piRender(_pi: ExtensionAPI): void {
  // Intentionally empty until the Render MCP adapter is wired in (SPEC.md §4.2).
}
