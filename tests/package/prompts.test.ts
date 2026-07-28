import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const promptsDir = fileURLToPath(new URL("../../prompts", import.meta.url));

// The filename (without .md) becomes the /command in Pi.
const EXPECTED = ["deploy-to-render", "check-render-status"];

function parse(md: string): { description?: string; body: string } {
  const m = md.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) return { body: md.trim() };
  const desc = m[1].split("\n").find((l) => l.startsWith("description:"));
  return {
    description: desc?.slice("description:".length).trim(),
    body: m[2].trim(),
  };
}

describe("prompt templates (M2)", () => {
  for (const name of EXPECTED) {
    it(`/${name} exists with a description and non-empty body`, () => {
      const file = `${promptsDir}/${name}.md`;
      expect(existsSync(file), `missing prompts/${name}.md`).toBe(true);
      const { description, body } = parse(readFileSync(file, "utf8"));
      expect(description, `${name} needs a frontmatter description`).toBeTruthy();
      expect(body.length, `${name} needs a non-empty body`).toBeGreaterThan(0);
    });
  }
});
