import { describe, expect, it } from "vitest";
import piRender from "../../src/index";
import { createFakePi } from "../support/fake-pi";

/**
 * M0 green light: the extension factory runs against pi's public ExtensionAPI
 * without throwing and, as a scaffold, registers nothing yet. Behavior lands in
 * M2–M6, each asserted through this same fake.
 */
describe("pi-render extension (M0 scaffold)", () => {
  it("loads without throwing", () => {
    const pi = createFakePi();
    expect(() => piRender(pi.api)).not.toThrow();
  });

  it("registers no tools, commands, or event handlers yet", () => {
    const pi = createFakePi();
    piRender(pi.api);
    expect(pi.tools.size).toBe(0);
    expect(pi.commands.size).toBe(0);
    expect(pi.handlers.size).toBe(0);
  });
});
