import { fileURLToPath } from "node:url";
import {
  calls,
  createTestSession,
  says,
  type TestSession,
  when,
} from "@marcfargas/pi-test-harness";
import { afterEach, describe, expect, it } from "vitest";

const EXT = fileURLToPath(new URL("../../src/index.ts", import.meta.url));

/**
 * M0 green light: the extension loads inside a real Pi runtime and a session
 * runs to completion. It registers no tools/commands yet, so we only assert a
 * clean load + turn.
 */
describe("pi-render extension", () => {
  let t: TestSession | undefined;

  afterEach(async () => {
    await t?.dispose();
  });

  it("loads in a Pi session without errors", async () => {
    t = await createTestSession({
      extensions: [EXT],
      mockTools: {
        bash: () => "",
        read: () => "",
        write: () => "",
        edit: () => "",
      },
    });

    await t.run(when("say hi", [says("hi")]));

    expect(t.events.toolResultsFor("bash")).toHaveLength(0);
  });

  it("does not register any custom tools yet", async () => {
    t = await createTestSession({ extensions: [EXT] });

    // A no-op scaffold must not hijack a normal turn.
    await t.run(when("list files", [calls("bash", { command: "ls" }), says("done")]));

    expect(t.events.toolResultsFor("bash")).toHaveLength(1);
  });
});
