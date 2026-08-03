import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import piRender from "../../src/index";
import { createFakePi } from "../support/fake-pi";

const adapter = vi.hoisted(() => ({
  createMcpAdapter: vi.fn(),
  extension: vi.fn(),
}));

vi.mock("pi-mcp-adapter", () => ({
  createMcpAdapter: adapter.createMcpAdapter,
}));

describe("pi-render extension", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("RENDER_API_KEY", "");
    adapter.createMcpAdapter.mockReturnValue(adapter.extension);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("default-exports a single factory, which is what `pi.extensions` loads", () => {
    expect(typeof piRender).toBe("function");
    expect(piRender.length).toBeLessThanOrEqual(1);
  });

  it("hands the isolated Render config to the MCP adapter and invokes it with pi", () => {
    const pi = createFakePi();

    piRender(pi.api);

    expect(adapter.createMcpAdapter).toHaveBeenCalledOnce();
    expect(adapter.createMcpAdapter).toHaveBeenCalledWith({
      config: {
        mcpServers: {
          render: {
            url: "https://mcp.render.com/mcp",
            auth: "oauth",
            lifecycle: "lazy",
            directTools: false,
          },
        },
        settings: {
          scriptMode: false,
        },
      },
    });
    expect(adapter.extension).toHaveBeenCalledOnce();
    expect(adapter.extension).toHaveBeenCalledWith(pi.api);
  });

  it("creates a fresh adapter extension when pi re-invokes it on reload", () => {
    const pi = createFakePi();
    const firstLoad = vi.fn();
    const secondLoad = vi.fn();
    adapter.createMcpAdapter.mockReturnValueOnce(firstLoad).mockReturnValueOnce(secondLoad);

    piRender(pi.api);
    piRender(pi.api);

    expect(adapter.createMcpAdapter).toHaveBeenCalledTimes(2);
    expect(firstLoad).toHaveBeenCalledOnce();
    expect(firstLoad).toHaveBeenCalledWith(pi.api);
    expect(secondLoad).toHaveBeenCalledOnce();
    expect(secondLoad).toHaveBeenCalledWith(pi.api);
  });
});
