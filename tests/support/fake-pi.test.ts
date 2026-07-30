import type { ToolDefinition } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { describe, expect, it } from "vitest";
import { createFakePi } from "./fake-pi";

/**
 * The harness is load-bearing: every extension test trusts it to notice things. If its
 * strictness or its `ToolDefinition` validation regressed, those tests would keep passing while
 * checking nothing — so the double gets its own tests.
 */
function tool(overrides: Partial<ToolDefinition> = {}): ToolDefinition {
  return {
    name: "render_example",
    label: "Example",
    description: "An example tool.",
    parameters: Type.Object({}),
    execute: async () => ({ output: "" }),
    ...overrides,
  } as unknown as ToolDefinition;
}

describe("fake ExtensionAPI harness", () => {
  it("throws, naming the member, when the subject touches something unmodelled", () => {
    const pi = createFakePi();
    expect(() => pi.api.appendEntry("note")).toThrow(/unmodelled member `appendEntry`/);
  });

  it("permits every member it claims to model", () => {
    const pi = createFakePi();
    for (const member of ["on", "registerTool", "registerCommand", "exec"]) {
      expect(() => (pi.api as unknown as Record<string, unknown>)[member]).not.toThrow();
    }
  });

  it("records touched members in call order", () => {
    const pi = createFakePi();
    pi.api.registerTool(tool());
    pi.api.on("tool_result", () => undefined);
    expect(pi.touched).toEqual(["registerTool", "on"]);
  });

  describe("registerTool enforces pi's ToolDefinition contract", () => {
    for (const field of ["name", "label", "description"] as const) {
      it(`rejects a missing \`${field}\``, () => {
        const pi = createFakePi();
        expect(() => pi.api.registerTool(tool({ [field]: "" }))).toThrow(new RegExp(field));
      });
    }

    it("rejects a non-schema `parameters`", () => {
      const pi = createFakePi();
      expect(() => pi.api.registerTool(tool({ parameters: undefined }))).toThrow(/parameters/);
    });

    it("rejects a non-function `execute`", () => {
      const pi = createFakePi();
      expect(() => pi.api.registerTool(tool({ execute: undefined }))).toThrow(/execute/);
    });

    it("rejects a duplicate name, which pi would treat as a collision", () => {
      const pi = createFakePi();
      pi.api.registerTool(tool());
      expect(() => pi.api.registerTool(tool())).toThrow(/collide/);
    });

    it("accepts and captures a well-formed tool", () => {
      const pi = createFakePi();
      pi.api.registerTool(tool({ name: "render_validate_blueprint" }));
      expect(pi.tools.get("render_validate_blueprint")?.label).toBe("Example");
    });
  });

  describe("event dispatch", () => {
    it("drives every handler registered for an event and collects results", async () => {
      const pi = createFakePi();
      // Handlers must satisfy pi's real `ToolResultEventResult`, which typecheck enforces.
      pi.api.on("tool_result", (event) => ({ details: { first: event } }));
      pi.api.on("tool_result", (event) => ({ details: { second: event } }));
      const payload = { toolName: "write", input: { path: "render.yaml" } };
      await expect(pi.emit("tool_result", payload)).resolves.toEqual([
        { details: { first: payload } },
        { details: { second: payload } },
      ]);
    });

    it("refuses to emit an event nothing subscribed to, so tests cannot pass vacuously", async () => {
      const pi = createFakePi();
      await expect(pi.emit("tool_result", {})).rejects.toThrow(/nothing subscribed/);
    });

    it("hands handlers a strict ExtensionContext", async () => {
      const pi = createFakePi();
      pi.api.on("tool_result", (_event, ctx) => {
        const probe = (ctx as unknown as { nope: unknown }).nope;
        return { details: probe };
      });
      await expect(pi.emit("tool_result", {})).rejects.toThrow(/ExtensionContext/);
    });
  });

  describe("exec", () => {
    it("records calls and returns queued results in order", async () => {
      const pi = createFakePi();
      pi.stubExec({ stdout: "valid", code: 0 });
      pi.stubExec({ stderr: "boom", code: 1 });

      const first = await pi.api.exec("render", ["blueprints", "validate"], { cwd: "/repo" });
      const second = await pi.api.exec("render", ["whoami"]);

      expect(first).toMatchObject({ stdout: "valid", code: 0 });
      expect(second).toMatchObject({ stderr: "boom", code: 1 });
      expect(pi.execCalls).toEqual([
        { command: "render", args: ["blueprints", "validate"], options: { cwd: "/repo" } },
        { command: "render", args: ["whoami"], options: undefined },
      ]);
    });

    it("defaults to a clean exit when nothing is queued", async () => {
      const pi = createFakePi();
      await expect(pi.api.exec("render", ["--version"])).resolves.toEqual({
        stdout: "",
        stderr: "",
        code: 0,
        killed: false,
      });
    });
  });
});
