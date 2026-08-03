import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const readme = readFileSync(join(repoRoot, "README.md"), "utf8");
const spec = readFileSync(join(repoRoot, "docs/SPEC.md"), "utf8");
const changelog = readFileSync(join(repoRoot, "CHANGELOG.md"), "utf8");
const installCommand = "pi install https://github.com/render-lab/render-pi-plugin";

describe("release documentation", () => {
  it("uses the GitHub installation source consistently", () => {
    expect(readme).toContain(installCommand);
    expect(spec).toContain(installCommand);
    expect(readme).not.toContain("pi install npm:");
    expect(spec).not.toContain("pi install npm:");
    expect(spec).not.toContain("github.com/render-oss/pi-render");
  });

  it("documents lazy included MCP support and both authentication paths", () => {
    expect(readme).toMatch(/no separate\s+MCP/i);
    expect(readme).toMatch(/lazy/i);
    expect(readme).toMatch(/clean first run.*metadata/is);
    expect(readme).toMatch(/Pi and the Render skills continue to work/i);
    expect(readme).toContain("/mcp-auth render");
    expect(readme).toContain("RENDER_API_KEY");
  });

  it("explains how to keep the skills while disabling MCP", () => {
    expect(readme).toContain("pi config");
    expect(readme).toMatch(/skills-only/i);
  });

  it("states the deliberately limited v1 scope in release notes", () => {
    expect(changelog).toContain("## 0.1.0");
    expect(changelog).toMatch(/does not include.*slash commands/is);
    expect(changelog).toMatch(/subagent/i);
    expect(changelog).toMatch(/Blueprint validation hook/i);
  });
});
