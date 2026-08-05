const RENDER_MCP_URL = "https://mcp.render.com/mcp";
const RENDER_API_KEY_ENV = "RENDER_API_KEY";

/**
 * Render's authorization server publishes no `registration_endpoint`, so dynamic client
 * registration cannot work. The adapter only falls back to registration when `oauth.clientId`
 * is omitted, which is why this MUST stay set: without it every OAuth attempt fails at the
 * probe with a 401 and a misleading "does not appear to speak MCP" error.
 *
 * The value is a public, pre-registered client ID, matching the sibling plugins' `claude`,
 * `cursor`, and `codex`. It is not a secret and there is no client secret: Render registers
 * these as public PKCE clients.
 */
const RENDER_OAUTH_CLIENT_ID = "pi";

export type RenderMcpEnvironment = Readonly<Record<string, string | undefined>>;

type RenderMcpAuth =
  | { auth: "oauth"; oauth: { clientId: typeof RENDER_OAUTH_CLIENT_ID } }
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
    : { auth: "oauth" as const, oauth: { clientId: RENDER_OAUTH_CLIENT_ID } };

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
