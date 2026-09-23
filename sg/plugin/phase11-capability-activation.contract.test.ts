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

  it("builds and smoke-tests the pinned low-footprint Phase 11 CLIs", async () => {
    const dockerfile = await readFile(path.join(repoRoot, "Dockerfile.sg22-overlay"), "utf8");
    const workflow = await readFile(
      path.join(repoRoot, ".github", "workflows", "sg22-render-image.yml"),
      "utf8",
    );

    expect(dockerfile).toContain("ARG BLOGWATCHER_VERSION=v0.0.4");
    expect(dockerfile).toContain("ARG SONGSEE_VERSION=v0.1.2");
    expect(dockerfile).toContain(
      "go install github.com/Hyaxia/blogwatcher/cmd/blogwatcher@${BLOGWATCHER_VERSION}",
    );
    expect(dockerfile).toContain(
      "go install github.com/steipete/songsee/cmd/songsee@${SONGSEE_VERSION}",
    );
    expect(dockerfile).toContain("ENV BLOGWATCHER_DB=/data/.openclaw/blogwatcher/blogwatcher.db");
    expect(dockerfile).toContain(
      "COPY --from=sg22-go-tools /out/blogwatcher /usr/local/bin/blogwatcher",
    );
    expect(dockerfile).toContain("COPY --from=sg22-go-tools /out/songsee /usr/local/bin/songsee");
    expect(workflow).toContain("command -v blogwatcher");
    expect(workflow).toContain("BLOGWATCHER_DB=/tmp/blogwatcher.db blogwatcher blogs");
    expect(workflow).toContain("command -v songsee");
    expect(workflow).toContain("songsee --version");
    expect(workflow).toContain("songsee --help");
  });

  it("exposes narrow Blogwatcher and Songsee tools to citizens without granting exec", async () => {
    const entrypoint = await readFile(
      path.join(repoRoot, "scripts", "sg22-render-entrypoint.sh"),
      "utf8",
    );
    const manifest = JSON.parse(
      await readFile(path.join(repoRoot, "sg", "plugin", "openclaw.plugin.json"), "utf8"),
    ) as { contracts: { tools: string[] } };

    expect(entrypoint).toContain('"sg_blogwatcher","sg_songsee"');
    expect(entrypoint).toContain('\\"exec\\",\\"process\\",\\"code_execution\\",\\"terminal\\"');
    expect(manifest.contracts.tools).toEqual(
      expect.arrayContaining(["sg_blogwatcher", "sg_songsee"]),
    );
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
      eligibleSkills: 54,
      missingRequirementSkills: 30,
      loadedPlugins: 39,
      disabledPlugins: 19,
      pairedNodes: 0,
    });
    expect(classifiedSkills.toSorted()).toEqual(expectedMissingSkills.toSorted());
    expect(new Set(classifiedSkills).size).toBe(classifiedSkills.length);
  });
});
