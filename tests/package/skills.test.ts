import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { formatSkillsForPrompt, loadSkillsFromDir } from "@earendil-works/pi-coding-agent";
import { describe, expect, it } from "vitest";

/**
 * These tests run the vendored skills through **pi's own loader** rather than re-implementing
 * frontmatter parsing. That matters: 16 of the 21 skills use folded YAML (`description: >-`),
 * which a line-based parser reads as the literal `">-"` — truthy, so a hand-rolled check passes
 * while asserting nothing. Pi's loader parses the real value, and its `diagnostics` are exactly
 * the complaints a user would hit at startup.
 */
const skillsDir = fileURLToPath(new URL("../../skills", import.meta.url));
const syncScript = fileURLToPath(new URL("../../scripts/sync-skills.sh", import.meta.url));

/** Core skills v1 must ship (SPEC.md §4.1). */
const REQUIRED = [
  "render-deploy",
  "render-blueprints",
  "render-debug",
  "render-monitor",
  "render-workflows",
  "render-cli",
];

/** Pi's documented cap on a skill description. */
const MAX_DESCRIPTION = 1024;

/**
 * Every skill description is concatenated into the system prompt on every request, so the
 * vendored set has a standing context cost. The ceiling is a regression guard, not a target —
 * it should only move deliberately, with the new cost noted.
 */
const MAX_PROMPT_BLOCK = 20_000;

const loaded = loadSkillsFromDir({ dir: skillsDir, source: "pi-render" });

function skillDirs(): string[] {
  return readdirSync(skillsDir)
    .filter((name) => !name.startsWith("."))
    .filter((name) => statSync(join(skillsDir, name)).isDirectory());
}

function markdownFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return markdownFiles(path);
    return entry.name.endsWith(".md") ? [path] : [];
  });
}

describe("vendored Render skills", () => {
  it("all load through pi's own loader with zero diagnostics", () => {
    const complaints = loaded.diagnostics.map((d) => `${d.type}: ${d.message} (${d.path ?? "?"})`);
    expect(complaints).toEqual([]);
    expect(loaded.skills.length).toBe(skillDirs().length);
  });

  it("ships the core skills v1 requires", () => {
    const names = loaded.skills.map((skill) => skill.name);
    for (const required of REQUIRED) {
      expect(names, `missing skill: ${required}`).toContain(required);
    }
  });

  it("names every skill after its directory, and namespaces them all under render-", () => {
    for (const skill of loaded.skills) {
      expect(skill.name, `${skill.filePath} name/directory mismatch`).toBe(basename(skill.baseDir));
      expect(skill.name).toMatch(/^render-[a-z0-9-]+$/);
    }
  });

  it("gives every skill a real description within pi's 1024-char budget", () => {
    for (const skill of loaded.skills) {
      // A folded-YAML parsing bug shows up here as ">-" or "|", and a stub as a very short body.
      expect(skill.description, `${skill.name} description looks unparsed`).not.toMatch(/^[>|]/);
      expect(skill.description.length, `${skill.name} description too short`).toBeGreaterThan(40);
      expect(skill.description.length, `${skill.name} description over cap`).toBeLessThanOrEqual(
        MAX_DESCRIPTION,
      );
    }
  });

  it("leaves every skill model-invocable", () => {
    // The whole point of bundling skills is that the model reaches for them unprompted;
    // `disable-model-invocation` would hide them from the system prompt.
    for (const skill of loaded.skills) {
      expect(skill.disableModelInvocation, `${skill.name} is hidden from the model`).toBe(false);
    }
  });

  it("resolves every reference and asset link the skills point at", () => {
    // The sync script copies references/ and assets/ wholesale; a partial copy leaves the model
    // reading paths that do not exist, which it cannot recover from.
    const broken: string[] = [];
    let checked = 0;

    for (const dir of skillDirs()) {
      const root = join(skillsDir, dir);
      for (const file of markdownFiles(root)) {
        const text = readFileSync(file, "utf8");
        const links = text.matchAll(
          /(?:\]\(|`)(?:\.\/)?((?:references|assets)\/[A-Za-z0-9._\-/]+\.(?:md|ya?ml|json))/g,
        );
        for (const [, target] of links) {
          checked++;
          // Links are written either from the skill root or relative to the containing file.
          if (!existsSync(join(root, target)) && !existsSync(join(dirname(file), target))) {
            broken.push(`${file.slice(skillsDir.length + 1)} -> ${target}`);
          }
        }
      }
    }

    expect(broken).toEqual([]);
    expect(
      checked,
      "reference scan matched nothing — the link pattern has drifted",
    ).toBeGreaterThan(100);
  });

  it("contains no empty vendored files", () => {
    const empty = skillDirs()
      .flatMap((dir) => markdownFiles(join(skillsDir, dir)))
      .filter((file) => readFileSync(file, "utf8").trim().length === 0);
    expect(empty).toEqual([]);
  });

  it("pins an upstream commit that matches the sync script", () => {
    // Drift between the script's PIN and what is vendored means `skills/` is not reproducible.
    const provenance = join(skillsDir, ".sync-source");
    expect(existsSync(provenance), "skills/.sync-source missing").toBe(true);

    const vendored = readFileSync(provenance, "utf8").match(/commit: ([0-9a-f]{40})/)?.[1];
    const pinned = readFileSync(syncScript, "utf8").match(/^PIN="([0-9a-f]{40})"/m)?.[1];

    expect(vendored, "no 40-char commit recorded in .sync-source").toBeDefined();
    expect(pinned, "no 40-char PIN in sync-skills.sh").toBeDefined();
    expect(vendored, "vendored skills do not match the pinned commit — re-run sync-skills").toBe(
      pinned,
    );
  });

  it("keeps the standing system-prompt cost bounded", () => {
    const block = formatSkillsForPrompt(loaded.skills);
    for (const required of REQUIRED) {
      expect(block).toContain(required);
    }
    expect(block.length).toBeLessThan(MAX_PROMPT_BLOCK);
  });
});
