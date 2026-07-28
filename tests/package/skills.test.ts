import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const skillsDir = fileURLToPath(new URL("../../skills", import.meta.url));

// Core skills we must ship for parity with the sibling Render plugins.
const REQUIRED = [
  "render-deploy",
  "render-blueprints",
  "render-debug",
  "render-monitor",
  "render-workflows",
  "render-cli",
];

function skillDirs(): string[] {
  if (!existsSync(skillsDir)) return [];
  return readdirSync(skillsDir).filter(
    (n) => !n.startsWith(".") && statSync(`${skillsDir}/${n}`).isDirectory(),
  );
}

function frontmatter(md: string): Record<string, string> {
  const block = md.match(/^---\n([\s\S]*?)\n---/);
  if (!block) return {};
  const out: Record<string, string> = {};
  for (const line of block[1].split("\n")) {
    const kv = line.match(/^([A-Za-z][\w-]*):\s*(.*)$/);
    if (kv) out[kv[1]] = kv[2];
  }
  return out;
}

describe("bundled Render skills (M1)", () => {
  it("vendors the core render-* skills", () => {
    const dirs = skillDirs();
    for (const req of REQUIRED) {
      expect(dirs, `missing skill: ${req}`).toContain(req);
    }
  });

  it("every vendored skill has a SKILL.md with valid frontmatter", () => {
    const dirs = skillDirs();
    expect(dirs.length).toBeGreaterThan(0);
    for (const dir of dirs) {
      const md = `${skillsDir}/${dir}/SKILL.md`;
      expect(existsSync(md), `${dir} missing SKILL.md`).toBe(true);
      const fm = frontmatter(readFileSync(md, "utf8"));
      expect(fm.name, `${dir} frontmatter name`).toBe(dir);
      expect(fm.description, `${dir} frontmatter description`).toBeTruthy();
      expect(fm.license, `${dir} frontmatter license`).toBeTruthy();
    }
  });

  it("records the pinned render-oss/skills commit for reproducibility", () => {
    const provenance = `${skillsDir}/.sync-source`;
    expect(existsSync(provenance), "skills/.sync-source missing").toBe(true);
    expect(readFileSync(provenance, "utf8")).toMatch(/commit: [0-9a-f]{40}/);
  });
});
