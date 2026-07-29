import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const file = fileURLToPath(new URL("../../prompts/render.md", import.meta.url));

describe("@render subagent persona (M3)", () => {
  it("ships prompts/render.md with a description and a Render-specialist body", () => {
    expect(existsSync(file), "missing prompts/render.md").toBe(true);
    const md = readFileSync(file, "utf8");
    expect(md, "needs frontmatter with a description").toMatch(/^---\n[\s\S]*description:/);
    const body = md.replace(/^---\n[\s\S]*?\n---\n?/, "").trim();
    expect(body.length, "needs a non-empty persona body").toBeGreaterThan(0);
    expect(body.toLowerCase()).toContain("render");
    expect(body.toLowerCase()).toMatch(/specialist|deploy/);
  });
});
