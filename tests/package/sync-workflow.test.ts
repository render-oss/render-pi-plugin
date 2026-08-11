import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const workflowPath = fileURLToPath(
  new URL("../../.github/workflows/sync-skills.yml", import.meta.url),
);
const workflow = readFileSync(workflowPath, "utf8");

describe("skills sync workflow", () => {
  it("runs daily and supports manual dispatch", () => {
    expect(workflow).toContain('cron: "0 6 * * *"');
    expect(workflow).toContain("workflow_dispatch:");
    expect(workflow).toContain("github.repository == 'render-oss/render-pi-plugin'");
  });

  it("syncs only from the public skills mirror", () => {
    expect(workflow).toContain("https://github.com/render-oss/skills");
    expect(workflow).not.toContain("https://github.com/renderinc/skills");
  });

  it("installs and verifies before creating a pull request", () => {
    const install = workflow.indexOf("run: npm ci");
    const sync = workflow.indexOf("run: ./scripts/sync-skills.sh");
    const verify = workflow.indexOf("run: npm run verify");
    const label = workflow.indexOf("gh label create skills-sync");
    const createPullRequest = workflow.indexOf("uses: peter-evans/create-pull-request@v7");

    expect(install).toBeGreaterThan(-1);
    expect(sync).toBeGreaterThan(install);
    expect(verify).toBeGreaterThan(sync);
    expect(label).toBeGreaterThan(verify);
    expect(createPullRequest).toBeGreaterThan(label);
  });

  it("gates auto-merge behind an explicit repository variable", () => {
    expect(workflow).toContain("vars.SKILLS_SYNC_AUTOMERGE == 'true'");
    expect(workflow).toContain("uses: peter-evans/enable-pull-request-automerge@v3");
    expect(workflow).toContain("merge-method: squash");
  });
});
