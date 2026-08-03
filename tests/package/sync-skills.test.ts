import { execFileSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const syncScript = fileURLToPath(new URL("../../scripts/sync-skills.sh", import.meta.url));
const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

function run(
  command: string,
  args: string[],
  cwd?: string,
  extraEnv: Record<string, string | undefined> = {},
): string {
  return execFileSync(command, args, {
    cwd,
    encoding: "utf8",
    env: {
      ...process.env,
      TMPDIR: join(repoRoot, "node_modules/.cache"),
      ...extraEnv,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function write(path: string, contents: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents);
}

describe("sync-skills.sh", () => {
  it("documents configurable source, ref, and destination options", () => {
    const help = run("bash", [syncScript, "--help"]);

    expect(help).toContain("--repo");
    expect(help).toContain("--ref");
    expect(help).toContain("--dest");
  });

  it("copies only distributable Render skills and records stable provenance", () => {
    const cache = join(repoRoot, "node_modules/.cache");
    mkdirSync(cache, { recursive: true });
    const root = mkdtempSync(join(cache, "pi-render-sync-"));
    temporaryDirectories.push(root);
    const source = join(root, "source");
    const destination = join(root, "destination");
    const fakeBin = join(root, "bin");
    const commit = "0123456789abcdef0123456789abcdef01234567";

    write(
      join(source, "skills/render-example/SKILL.md"),
      [
        "---",
        "name: render-example",
        "description: Example Render skill used to test deterministic synchronization.",
        "license: MIT",
        "---",
        "",
        "# Example",
      ].join("\n"),
    );
    write(join(source, "skills/render-example/references/details.md"), "# Distributable reference");
    write(join(source, "skills/render-example/evals.json"), '{"sourceOnly":true}');
    write(join(source, "skills/render-example/EVALS.md"), "# Source-only eval docs");
    write(
      join(source, "skills/not-render/SKILL.md"),
      "---\nname: not-render\ndescription: Must not be copied.\nlicense: MIT\n---\n",
    );
    const fakeGit = join(fakeBin, "git");
    write(
      fakeGit,
      [
        "#!/usr/bin/env bash",
        "set -euo pipefail",
        'if [[ "$1" == "clone" ]]; then',
        '  cp -R "$3" "$4"',
        'elif [[ "$1" == "-C" && "$3" == "checkout" ]]; then',
        "  exit 0",
        'elif [[ "$1" == "-C" && "$3" == "rev-parse" ]]; then',
        `  echo "${commit}"`,
        "else",
        '  echo "Unexpected git invocation: $*" >&2',
        "  exit 1",
        "fi",
      ].join("\n"),
    );
    chmodSync(fakeGit, 0o755);

    const args = [syncScript, "--repo", source, "--ref", "main", "--dest", destination];
    const env = { PATH: `${fakeBin}:${process.env.PATH ?? ""}` };
    run("bash", args, undefined, env);

    expect(existsSync(join(destination, "render-example/SKILL.md"))).toBe(true);
    expect(existsSync(join(destination, "render-example/references/details.md"))).toBe(true);
    expect(existsSync(join(destination, "render-example/evals.json"))).toBe(false);
    expect(existsSync(join(destination, "render-example/EVALS.md"))).toBe(false);
    expect(existsSync(join(destination, "not-render/SKILL.md"))).toBe(false);

    const provenance = readFileSync(join(destination, ".sync-source"), "utf8");
    expect(provenance).toContain(`source: ${source}`);
    expect(provenance).toContain("ref: main");
    expect(provenance).toContain(`commit: ${commit}`);
    expect(provenance).not.toMatch(/^synced:/m);

    run("bash", args, undefined, env);
    expect(readFileSync(join(destination, ".sync-source"), "utf8")).toBe(provenance);
  });
});
