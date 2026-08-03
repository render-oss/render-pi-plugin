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

  it("treats an empty API key as absent", () => {
    expect(buildRenderMcpConfig({ RENDER_API_KEY: "" }).mcpServers.render.auth).toBe("oauth");
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
