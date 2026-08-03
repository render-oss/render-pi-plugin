const RENDER_MCP_URL = "https://mcp.render.com/mcp";
const RENDER_API_KEY_ENV = "RENDER_API_KEY";

export type RenderMcpEnvironment = Readonly<Record<string, string | undefined>>;

type RenderMcpAuth =
  | { auth: "oauth" }
  | { auth: "bearer"; bearerTokenEnv: typeof RENDER_API_KEY_ENV };

export interface RenderMcpConfig {
  mcpServers: {
    render: {
      url: typeof RENDER_MCP_URL;
      lifecycle: "lazy";
      directTools: false;
    } & RenderMcpAuth;
  };
  settings: {
    scriptMode: false;
  };
}

/**
 * Build the isolated MCP configuration owned by pi-render.
 *
 * The API key value is deliberately never copied into this object. The adapter
 * resolves it from the environment only when the lazy Render server connects.
 */
export function buildRenderMcpConfig(env: RenderMcpEnvironment): RenderMcpConfig {
  const auth: RenderMcpAuth = env[RENDER_API_KEY_ENV]
    ? { auth: "bearer" as const, bearerTokenEnv: RENDER_API_KEY_ENV }
    : { auth: "oauth" as const };

  return {
    mcpServers: {
      render: {
        url: RENDER_MCP_URL,
        lifecycle: "lazy",
        directTools: false,
        ...auth,
      },
    },
    settings: {
      scriptMode: false,
    },
  };
}
