import { describe, expect, it } from "vitest";
import piRender from "../../src/index";
import { createFakePi } from "../support/fake-pi";

describe("pi-render extension", () => {
  it("default-exports a single factory, which is what `pi.extensions` loads", () => {
    expect(typeof piRender).toBe("function");
    expect(piRender.length).toBeLessThanOrEqual(1);
  });

  it("loads against pi's public ExtensionAPI without throwing", () => {
    const pi = createFakePi();
    expect(() => piRender(pi.api)).not.toThrow();
  });

  it("can be re-invoked, as pi does on /reload", () => {
    const pi = createFakePi();
    piRender(pi.api);
    // A second load must not double-register: the harness rejects duplicate tool and
    // command names the way pi would treat them as collisions.
    expect(() => piRender(pi.api)).not.toThrow();
  });

  it("registers nothing and touches no API until MCP wiring lands (SPEC.md §4.2)", () => {
    const pi = createFakePi();
    piRender(pi.api);
    expect([...pi.tools.keys()]).toEqual([]);
    expect([...pi.commands.keys()]).toEqual([]);
    expect([...pi.handlers.keys()]).toEqual([]);
    expect(pi.touched).toEqual([]);
  });
});
