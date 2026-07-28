import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const pkg = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8")) as {
  keywords?: string[];
  pi?: { extensions?: string[]; skills?: string[]; prompts?: string[] };
  files?: string[];
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
};

describe("package manifest", () => {
  it("is discoverable as a pi package", () => {
    expect(pkg.keywords).toContain("pi-package");
    expect(pkg.pi).toBeDefined();
    expect(pkg.pi?.extensions).toContain("./src/index.ts");
  });

  it("declares runtime deps in dependencies and pi core as peers", () => {
    expect(pkg.dependencies?.["pi-mcp-adapter"]).toBeDefined();
    expect(pkg.peerDependencies?.["@earendil-works/pi-coding-agent"]).toBeDefined();
    // Pi provides its own core at runtime — it must not be a hard dependency.
    expect(pkg.dependencies?.["@earendil-works/pi-coding-agent"]).toBeUndefined();
  });

  it("ships resource dirs and excludes tests via the files allowlist", () => {
    expect(pkg.files).toContain("src");
    expect(pkg.files).toContain("skills");
    expect(pkg.files).toContain("prompts");
    expect(pkg.files).not.toContain("tests");
  });
});
