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

  it("classifies every remaining deployed skill blocker exactly once before activation", async () => {
    const classification = JSON.parse(
      await readFile(
        path.join(repoRoot, "sg", "plugin", "phase11-capability-classification.json"),
        "utf8",
      ),
    ) as {
      auditedOpenClawVersion: string;
      observed: {
        totalSkills: number;
        eligibleSkills: number;
        missingRequirementSkills: number;
        loadedPlugins: number;
        disabledPlugins: number;
        pairedNodes: number;
      };
      categories: {
        linuxApplicable: string[];
        requiresCredentialOrAccount: string[];
        requiresDeviceOrNode: string[];
        platformIncompatible: string[];
      };
    };

    const expectedMissingSkills = [
      "1password",
      "apple-notes",
      "apple-reminders",
      "bear-notes",
      "blogwatcher",
      "blucli",
      "camsnap",
      "coding-agent",
      "eightctl",
      "gemini",
      "gifgrep",
      "gog",
      "goplaces",
      "himalaya",
      "mcporter",
      "model-usage",
      "nano-pdf",
      "obsidian",
      "openai-whisper",
      "openhue",
      "oracle",
      "ordercli",
      "peekaboo",
      "sag",
      "sherpa-onnx-tts",
      "songsee",
      "sonoscli",
      "spotify-player",
      "summarize",
      "things-mac",
      "trello",
      "xurl",
    ];
    const classifiedSkills = Object.values(classification.categories).flat();

    expect(classification.auditedOpenClawVersion).toBe("2026.8.1");
    expect(classification.observed).toEqual({
      totalSkills: 84,
      eligibleSkills: 52,
      missingRequirementSkills: 32,
      loadedPlugins: 39,
      disabledPlugins: 19,
      pairedNodes: 0,
    });
    expect([...classifiedSkills].sort()).toEqual([...expectedMissingSkills].sort());
    expect(new Set(classifiedSkills).size).toBe(classifiedSkills.length);
  });
});
