import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));

interface Manifest {
  name?: string;
  version?: string;
  description?: string;
  license?: string;
  type?: string;
  keywords?: string[];
  pi?: { extensions?: string[]; skills?: string[]; prompts?: string[] };
  files?: string[];
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

const pkg = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8")) as Manifest;

const PI_CORE = [
  "@earendil-works/pi-coding-agent",
  "@earendil-works/pi-ai",
  "@earendil-works/pi-tui",
];

describe("package manifest", () => {
  it("is discoverable and loadable as a pi package", () => {
    expect(pkg.keywords).toContain("pi-package");
    expect(pkg.type, "pi loads ESM").toBe("module");
    expect(pkg.pi?.extensions).toContain("./src/index.ts");
    expect(pkg.pi?.skills).toContain("./skills");
  });

  it("points every declared pi resource path at something that exists", () => {
    // A typo here ships a package that installs cleanly and silently contributes nothing.
    const declared = [...(pkg.pi?.extensions ?? []), ...(pkg.pi?.skills ?? [])];
    expect(declared.length).toBeGreaterThan(0);
    for (const rel of declared) {
      expect(existsSync(join(repoRoot, rel)), `pi manifest path missing: ${rel}`).toBe(true);
    }
  });

  it("declares no prompts (SPEC.md §3.1 — cut in v1)", () => {
    expect(pkg.pi?.prompts).toBeUndefined();
    expect(existsSync(join(repoRoot, "prompts"))).toBe(false);
  });

  it("keeps runtime deps installable under --omit=dev", () => {
    // Pi installs packages with --omit=dev, so anything imported at runtime must be a
    // real dependency and pi core must NOT be, or the install duplicates pi.
    expect(pkg.dependencies?.["pi-mcp-adapter"]).toBeDefined();
    for (const core of PI_CORE) {
      expect(pkg.dependencies?.[core], `${core} must not be a hard dependency`).toBeUndefined();
    }
  });

  it("declares pi core as open-ended peers so pi supplies it at runtime", () => {
    for (const core of [...PI_CORE, "typebox"]) {
      expect(pkg.peerDependencies?.[core], `${core} missing from peerDependencies`).toBe("*");
    }
  });

  it("dev-depends on pi core so typecheck runs against current pi types", () => {
    for (const core of PI_CORE) {
      expect(pkg.devDependencies?.[core], `${core} missing from devDependencies`).toBeDefined();
    }
  });

  it("has no build step (SPEC.md §3.3 — pi loads TypeScript directly)", () => {
    expect(pkg.scripts?.build).toBeUndefined();
    expect(pkg.scripts?.typecheck).toContain("--noEmit");
    expect(pkg.files).not.toContain("dist");
    expect(existsSync(join(repoRoot, "dist"))).toBe(false);
  });

  it("ships source and skills while excluding tests and tooling", () => {
    expect(pkg.files).toContain("src");
    expect(pkg.files).toContain("skills");
    for (const excluded of ["tests", "docs", "biome.json", "tsconfig.json", "vitest.config.ts"]) {
      expect(pkg.files, `${excluded} must not be in files`).not.toContain(excluded);
    }
    for (const rel of pkg.files ?? []) {
      expect(existsSync(join(repoRoot, rel)), `files entry missing: ${rel}`).toBe(true);
    }
  });

  it("exposes one verify gate that runs typecheck, lint, and tests", () => {
    const verify = pkg.scripts?.verify ?? "";
    for (const step of ["typecheck", "lint", "test"]) {
      expect(verify, `verify must run ${step}`).toContain(step);
    }
  });

  it("carries the metadata npm needs to publish", () => {
    expect(pkg.name).toBe("@render/pi-render");
    expect(pkg.version).toBeDefined();
    expect(pkg.license).toBeDefined();
    expect(pkg.description?.length ?? 0).toBeGreaterThan(20);
  });
});
