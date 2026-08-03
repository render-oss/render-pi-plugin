/**
 * Consumer-facing contract used by pi-render's typecheck.
 *
 * pi-mcp-adapter publishes raw TypeScript as its `types` entry, which makes
 * TypeScript check the dependency's implementation with this project's compiler
 * settings. The typecheck-only tsconfig maps the package to this narrow public
 * factory seam; Pi still loads the real package at runtime.
 */
declare module "pi-mcp-adapter" {
  type ExtensionAPI = import("@earendil-works/pi-coding-agent").ExtensionAPI;
  type RenderMcpConfig = import("../src/mcp").RenderMcpConfig;

  export interface McpAdapterOptions {
    config?: RenderMcpConfig;
    configPath?: string;
  }

  export function createMcpAdapter(
    options?: McpAdapterOptions,
  ): (pi: ExtensionAPI) => void;
}
