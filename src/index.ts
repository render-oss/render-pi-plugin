import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { createMcpAdapter } from "pi-mcp-adapter";
import { buildRenderMcpConfig } from "./mcp";

/**
 * pi-render — Render integration for the Pi coding agent.
 *
 * v1 ships two things: the vendored Render skills (declared via `pi.skills` in
 * package.json — no code path here) and hosted Render MCP access via
 * `createMcpAdapter(...)(pi)`. See docs/SPEC.md.
 */
export default function piRender(pi: ExtensionAPI): void {
  createMcpAdapter({ config: buildRenderMcpConfig(process.env) })(pi);
}
