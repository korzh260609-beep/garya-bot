import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(".");

describe("SG 2.2 Phase 11 capability activation contracts", () => {
  it("uses the supported plugin inventory command during startup", async () => {
    const entrypoint = await readFile(
      path.join(repoRoot, "scripts", "sg22-render-entrypoint.sh"),
      "utf8",
    );

    expect(entrypoint).toContain("node /app/openclaw.mjs plugins list --json");
    expect(entrypoint).not.toContain("node /app/openclaw.mjs plugins status");
  });

  it("installs the compatible free CLI dependencies found missing by the Phase 11 audit", async () => {
    const workflow = await readFile(
      path.join(repoRoot, ".github", "workflows", "sg22-render-image.yml"),
      "utf8",
    );
    const packageLine = workflow
      .split("\n")
      .find((line) => line.includes("OPENCLAW_IMAGE_APT_PACKAGES="));
    const packageArgument = packageLine?.match(/OPENCLAW_IMAGE_APT_PACKAGES=([^"\\]+)/u)?.[1] ?? "";
    const packages = packageArgument.trim().split(/\s+/u);

    expect(packages).toEqual(expect.arrayContaining(["gh", "jq", "ripgrep", "ffmpeg", "tmux"]));
  });
});
