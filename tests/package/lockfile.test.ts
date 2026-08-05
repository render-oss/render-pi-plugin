import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * v0.1.0 shipped a lockfile that `npm install` accepted but `npm ci` rejected, so every CI run
 * failed while local development stayed green. `npm ci` is stricter than `npm install`: it refuses
 * a lockfile that does not already satisfy package.json instead of resolving the difference.
 *
 * The npm major matters too. A lockfile written by npm 11 can be unusable by the npm 10 bundled
 * with the `engines` floor, so `.nvmrc` pins the floor and both workflows read it — that is what
 * makes CI exercise the oldest supported npm. The dry run below only covers whatever npm is
 * running it, which is why the pin is asserted rather than assumed.
 */
const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const pkg = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8")) as {
  engines?: { node?: string };
};
const nvmrc = readFileSync(join(repoRoot, ".nvmrc"), "utf8").trim();
const workflows = ["verify.yml", "sync-skills.yml"].map((name) => ({
  name,
  body: readFileSync(join(repoRoot, ".github/workflows", name), "utf8"),
}));

describe("dependency lockfile", () => {
  it("is installable by npm ci, not just npm install", () => {
    expect(() =>
      execFileSync("npm", ["ci", "--dry-run"], {
        cwd: repoRoot,
        encoding: "utf8",
        stdio: ["ignore", "ignore", "pipe"],
      }),
    ).not.toThrow();
  }, 120_000);

  it("pins the toolchain to the engines floor so CI installs on the oldest supported npm", () => {
    expect(pkg.engines?.node).toBe(`>=${nvmrc}`);
  });

  it("makes every workflow resolve Node from the single .nvmrc pin", () => {
    for (const { name, body } of workflows) {
      expect(body, `${name} must read node-version-file`).toContain("node-version-file: .nvmrc");
      expect(body, `${name} must not pin node-version separately`).not.toMatch(
        /node-version:\s*\d/,
      );
    }
  });
});
