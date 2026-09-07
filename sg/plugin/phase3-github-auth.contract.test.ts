import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { isToolAllowedByPolicyName } from "../../src/agents/tool-policy-match.js";

const repoRoot = path.resolve(".");

function readSenderPolicies(source: string) {
  const match = source.match(/^\s*workspace_sender_tools="(.+)"$/mu);
  expect(match, "workspace_sender_tools must be literal JSON").not.toBeNull();
  return JSON.parse(
    (match?.[1] ?? "{}").replaceAll('\\"', '"').replaceAll("${telegram_owner_id}", "100"),
  ) as Record<string, { deny?: string[] }>;
}

describe("SG 2.2 Phase 3 GitHub authentication contracts", () => {
  it("keeps GitHub CLI authentication on the persistent Render disk", async () => {
    const entrypoint = await readFile(
      path.join(repoRoot, "scripts", "sg22-render-entrypoint.sh"),
      "utf8",
    );

    expect(entrypoint).toContain('export GH_CONFIG_DIR="${GH_CONFIG_DIR:-$state_dir/github-cli}"');
    expect(entrypoint).toMatch(/mkdir -p [^\n]*"\$GH_CONFIG_DIR"/u);
    expect(entrypoint).toContain('chmod 700 "$GH_CONFIG_DIR"');
  });

  it("ships GitHub CLI in every SG Render image", async () => {
    const workflow = await readFile(
      path.join(repoRoot, ".github", "workflows", "sg22-render-image.yml"),
      "utf8",
    );

    expect(workflow).toContain("--build-arg OPENCLAW_IMAGE_APT_PACKAGES=gh");
  });

  it("reports the authenticated GitHub identity without exposing a token", async () => {
    const entrypoint = await readFile(
      path.join(repoRoot, "scripts", "sg22-render-entrypoint.sh"),
      "utf8",
    );

    expect(entrypoint).toContain("gh api user --jq .login");
    expect(entrypoint).toContain("SG GitHub diagnostic: authenticated=true");
    expect(entrypoint).toContain("SG GitHub diagnostic: authenticated=false");
    expect(entrypoint).not.toContain("gh auth token");
  });

  it("blocks every GitHub-named tool for citizens while leaving it available to the Monarch", async () => {
    const entrypoint = await readFile(
      path.join(repoRoot, "scripts", "sg22-render-entrypoint.sh"),
      "utf8",
    );
    const policies = readSenderPolicies(entrypoint);
    const citizen = policies["*"];
    const monarch = policies["channel:telegram:100"];
    const githubTools = [
      "github_identity_status",
      "github_publish",
      "mcp__github__get_repo",
      "mcp__codex_apps__github_update_file",
    ];

    for (const tool of githubTools) {
      expect(isToolAllowedByPolicyName(tool, citizen), tool).toBe(false);
      expect(isToolAllowedByPolicyName(tool, monarch), tool).toBe(true);
    }
  });
});
