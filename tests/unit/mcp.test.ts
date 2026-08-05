import { describe, expect, it } from "vitest";
import { buildRenderMcpConfig } from "../../src/mcp";

const RENDER_MCP_URL = "https://mcp.render.com/mcp";

describe("buildRenderMcpConfig", () => {
  it("configures OAuth without requiring credentials", () => {
    const config = buildRenderMcpConfig({});

    expect(config.mcpServers.render).toMatchObject({
      url: RENDER_MCP_URL,
      auth: "oauth",
      lifecycle: "lazy",
      directTools: false,
    });
    expect(config.mcpServers.render).not.toHaveProperty("bearerToken");
    expect(config.mcpServers.render).not.toHaveProperty("bearerTokenEnv");
  });

  it("sends the pre-registered OAuth client ID so the adapter never attempts registration", () => {
    // Render's authorization server publishes no registration_endpoint. The adapter only tries
    // dynamic client registration when oauth.clientId is missing, and that attempt fails the
    // probe with a 401 and a misleading "does not appear to speak MCP" error. Dropping this
    // field silently breaks the default auth path for every user, so assert it explicitly.
    const config = buildRenderMcpConfig({});

    expect(config.mcpServers.render.auth).toBe("oauth");
    expect(config.mcpServers.render).toHaveProperty("oauth.clientId", "pi");
  });

  it("registers a public client, so it carries no client secret", () => {
    expect(JSON.stringify(buildRenderMcpConfig({}))).not.toMatch(/clientSecret|client_secret/i);
  });

  it("treats an empty API key as absent", () => {
    const config = buildRenderMcpConfig({ RENDER_API_KEY: "" });

    expect(config.mcpServers.render.auth).toBe("oauth");
    expect(config.mcpServers.render).toHaveProperty("oauth.clientId", "pi");
  });

  it("references RENDER_API_KEY without copying its value into config", () => {
    const secret = "rnd_secret_that_must_not_be_serialized";
    const config = buildRenderMcpConfig({ RENDER_API_KEY: secret });

    expect(config.mcpServers.render).toMatchObject({
      auth: "bearer",
      bearerTokenEnv: "RENDER_API_KEY",
      lifecycle: "lazy",
      directTools: false,
    });
    expect(config.mcpServers.render).not.toHaveProperty("bearerToken");
    expect(JSON.stringify(config)).not.toContain(secret);
  });

  it("omits the OAuth client ID on the bearer path, which never runs an OAuth flow", () => {
    const config = buildRenderMcpConfig({ RENDER_API_KEY: "present" });

    expect(config.mcpServers.render).not.toHaveProperty("oauth");
  });

  it.each([
    ["OAuth", {}],
    ["bearer", { RENDER_API_KEY: "present" }],
  ])("keeps the %s path lazy and proxy-only", (_name, env) => {
    const config = buildRenderMcpConfig(env);
    const server = config.mcpServers.render;

    expect(server.lifecycle).toBe("lazy");
    expect(server.directTools).toBe(false);
    expect(config.settings).toEqual({ scriptMode: false });
  });

  it("isolates the adapter to the hosted Render server", () => {
    const config = buildRenderMcpConfig({});

    expect(Object.keys(config.mcpServers)).toEqual(["render"]);
    expect(config.mcpServers.render.url).toBe(RENDER_MCP_URL);
    expect(config).not.toHaveProperty("imports");
  });
});
