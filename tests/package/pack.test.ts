import { execFileSync } from "node:child_process";
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";

/**
 * The release gate from SPEC.md §8.2. `files` is an allowlist, so what actually ships is
 * whatever npm resolves it to — asserting on the manifest alone would not catch a skill tree
 * that fails to travel. This packs for real (dry run) and inspects the resulting file list.
 */
const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const skillsDir = join(repoRoot, "skills");

let packed: string[] = [];
let unpackedSize = 0;

beforeAll(() => {
  const stdout = execFileSync("npm", ["pack", "--dry-run", "--json"], {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
  const [result] = JSON.parse(stdout) as [{ files: { path: string }[]; unpackedSize: number }];
  packed = result.files.map((file) => file.path);
  unpackedSize = result.unpackedSize;
}, 60_000);

function skillNames(): string[] {
  return readdirSync(skillsDir)
    .filter((name) => !name.startsWith("."))
    .filter((name) => statSync(join(skillsDir, name)).isDirectory());
}

describe("npm pack tarball", () => {
  it("includes the extension entry point and the manifest", () => {
    expect(packed).toContain("package.json");
    expect(packed).toContain("README.md");
    expect(packed).toContain("LICENSE");
    expect(packed).toContain("CHANGELOG.md");
    expect(packed).toContain("src/index.ts");
    expect(packed).toContain("src/mcp.ts");
  });

  it("ships every skill's SKILL.md", () => {
    for (const name of skillNames()) {
      expect(packed, `${name}/SKILL.md missing from tarball`).toContain(`skills/${name}/SKILL.md`);
    }
  });

  it("ships the reference and asset files skills depend on", () => {
    // SKILL.md bodies point at references/ and assets/; without them the skills are broken
    // for installed users even though they load without diagnostics.
    const references = packed.filter((path) => path.includes("/references/"));
    const assets = packed.filter((path) => path.includes("/assets/"));
    expect(references.length).toBeGreaterThan(40);
    expect(assets.length).toBeGreaterThan(0);
  });

  it("records the vendored-skill provenance", () => {
    expect(packed).toContain("skills/.sync-source");
  });

  it("excludes tests, docs, and local tooling", () => {
    const leaked = packed.filter(
      (path) =>
        path.startsWith(".github/") ||
        path.startsWith("tests/") ||
        path.startsWith("docs/") ||
        path.startsWith("scripts/") ||
        path.startsWith("types/") ||
        path.startsWith("node_modules/") ||
        /^(biome\.json|tsconfig(?:\.[^.]+)?\.json|vitest\.config\.ts|package-lock\.json)$/.test(
          path,
        ),
    );
    expect(leaked).toEqual([]);
  });

  it("ships no build output", () => {
    expect(packed.filter((path) => path.startsWith("dist/"))).toEqual([]);
  });

  it("stays a reasonable size for a skills-and-config package", () => {
    // Guards against accidentally vendoring something large (a .git dir, node_modules, images).
    expect(unpackedSize).toBeGreaterThan(100_000);
    expect(unpackedSize).toBeLessThan(2_000_000);
  });
});
