import { spawnSync } from "node:child_process";
import { chmod, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { pickSandboxToolPolicy } from "../../src/agents/sandbox-tool-policy.js";
import { isToolAllowedByPolicyName } from "../../src/agents/tool-policy-match.js";
import { mergeAlsoAllowPolicy, resolveToolProfilePolicy } from "../../src/agents/tool-policy.js";
import { resolveToolsBySender } from "../../src/config/group-policy.js";
import type { GroupToolPolicyBySenderConfig } from "../../src/config/types.tools.js";
import { registerWorkspaceManager } from "./register.js";

type RuntimeConfig = {
  session?: { dmScope?: string };
  messages?: { groupChat?: { mentionPatterns?: string[] } };
  channels?: {
    telegram?: {
      enabled?: boolean;
      groups?: Record<string, { requireMention?: boolean }>;
      capabilities?: { inlineButtons?: string };
      actions?: {
        sendMessage?: boolean;
        deleteMessage?: boolean;
        reactions?: boolean;
        poll?: boolean;
      };
      replyToMode?: string;
    };
  };
  tts?: { provider?: string; auto?: string };
  tools?: {
    profile?: string;
    alsoAllow?: string[];
    toolsBySender?: GroupToolPolicyBySenderConfig;
  };
};

const repoRoot = path.resolve(".");
const entrypointPath = path.join(repoRoot, "scripts", "sg22-render-entrypoint.sh");
const workflowPath = path.join(repoRoot, ".github", "workflows", "sg22-render-image.yml");
const ownerId = "phase1-owner";

const toolCatalog = [
  "read",
  "write",
  "edit",
  "apply_patch",
  "exec",
  "process",
  "terminal",
  "browser",
  "web_search",
  "web_fetch",
  "memory_search",
  "memory_get",
  "sg_memory_remember",
  "sg_memory_search",
  "sg_memory_get",
  "sg_project_memory_record",
  "sg_project_memory_search",
  "sg_project_memory_get",
  "message",
  "file_fetch",
  "file_write",
  "view_image",
  "image_generate",
  "music_generate",
  "video_generate",
  "tts",
  "automations",
  "sessions",
  "sessions_list",
  "sessions_history",
  "sessions_search",
  "sessions_send",
  "sessions_spawn",
  "subagents",
  "github_identity_status",
  "github_publish",
  "sg_render",
  "gateway",
  "nodes",
  "openclaw",
  "skill_workshop",
  "secrets",
  "environment",
  "sg_content_draft",
  "sg_content_dispatch",
  "sg_test_attempt",
].map((name) => ({ name }));

async function writeHarnessFile(filePath: string, content = "phase1 fixture\n") {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, content, "utf8");
}

async function createEntrypointHarness() {
  const root = await mkdtemp(path.join(os.tmpdir(), "sg22-phase1-entrypoint-"));
  const appRoot = path.join(root, "app");
  const stateDir = path.join(root, "state");
  const workspaceDir = path.join(root, "workspace");
  const binDir = path.join(root, "bin");
  const nodeLog = path.join(root, "node.log");
  const rewrittenEntrypoint = path.join(root, "sg22-render-entrypoint.sh");

  for (const file of ["IDENTITY.md", "SOUL.md", "AGENTS.md"]) {
    await writeHarnessFile(path.join(appRoot, "sg", "workspace", file));
  }
  for (const file of [
    "index.ts",
    "register.ts",
    "personal-memory-tools.ts",
    "project-memory-tools.ts",
    "cost-diagnostics.ts",
    "render-tools.ts",
    "openclaw.plugin.json",
    "package.json",
  ]) {
    await writeHarnessFile(path.join(appRoot, "sg", "plugin", file));
  }

  await mkdir(binDir, { recursive: true });
  await writeFile(nodeLog, "", "utf8");
  await writeFile(
    path.join(binDir, "node"),
    `#!/bin/sh
set -eu
printf '%s\\n' "$*" >> "$SG22_NODE_LOG"
if [ "\${2:-}" = "onboard" ]; then
  "$SG22_REAL_NODE" -e '
    const fs = require("node:fs");
    const file = process.env.OPENCLAW_STATE_DIR + "/openclaw.json";
    const config = JSON.parse(fs.readFileSync(file, "utf8"));
    config.tools = config.tools || {};
    config.tools.profile = "coding";
    fs.writeFileSync(file, JSON.stringify(config));
  '
fi
if [ "\${2:-}" = "config" ] && [ "\${3:-}" = "set" ] && [ "\${4:-}" = "--batch-json" ]; then
  SG22_BATCH_JSON="\${5:-}" "$SG22_REAL_NODE" -e '
    const fs = require("node:fs");
    const file = process.env.OPENCLAW_STATE_DIR + "/openclaw.json";
    const config = JSON.parse(fs.readFileSync(file, "utf8"));
    for (const item of JSON.parse(process.env.SG22_BATCH_JSON)) {
      const parts = item.path.split(".");
      let target = config;
      for (const part of parts.slice(0, -1)) target = target[part] ||= {};
      target[parts.at(-1)] = item.value;
    }
    fs.writeFileSync(file, JSON.stringify(config));
  '
fi
exit 0
`,
    "utf8",
  );
  await chmod(path.join(binDir, "node"), 0o755);

  const source = await readFile(entrypointPath, "utf8");
  await writeFile(rewrittenEntrypoint, source.replaceAll("/app", appRoot), "utf8");

  const run = async () => {
    await writeFile(nodeLog, "", "utf8");
    const result = spawnSync("sh", [rewrittenEntrypoint], {
      cwd: repoRoot,
      encoding: "utf8",
      env: {
        ...process.env,
        PATH: `${binDir}:${process.env.PATH ?? ""}`,
        OPENCLAW_STATE_DIR: stateDir,
        OPENCLAW_WORKSPACE_DIR: workspaceDir,
        OPENCLAW_GATEWAY_TOKEN: "phase1-gateway-token",
        OPENAI_API_KEY: "phase1-openai-key",
        SG_MONARCH_TELEGRAM_USER_ID: ownerId,
        SG_MONARCH_GLOBAL_USER_ID: "usr_phase1_monarch",
        SG_WORKSPACE_PLUGIN_ENABLED: "true",
        SG22_NODE_LOG: nodeLog,
        SG22_REAL_NODE: process.execPath,
        PORT: "18789",
      },
    });
    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
    return JSON.parse(
      await readFile(path.join(stateDir, "openclaw.json"), "utf8"),
    ) as RuntimeConfig;
  };

  return { run, stateDir };
}

function effectiveTools(config: RuntimeConfig, senderId: string) {
  const fullProfileConfig: RuntimeConfig = {
    ...config,
    tools: { ...config.tools, profile: "full" },
  };
  const profilePolicy = mergeAlsoAllowPolicy(
    resolveToolProfilePolicy(fullProfileConfig.tools?.profile),
    fullProfileConfig.tools?.alsoAllow,
  );
  const afterProfile = toolCatalog.filter((tool) =>
    isToolAllowedByPolicyName(tool.name, profilePolicy),
  );
  const senderPolicy = resolveToolsBySender({
    toolsBySender: fullProfileConfig.tools?.toolsBySender,
    messageProvider: "telegram",
    senderId,
  });
  const senderToolPolicy = pickSandboxToolPolicy(senderPolicy);
  return afterProfile
    .filter((tool) => isToolAllowedByPolicyName(tool.name, senderToolPolicy))
    .map((tool) => tool.name);
}

describe("SG 2.2 Phase 1 full capability contracts", () => {
  it("makes the effective startup profile full after native onboarding", async () => {
    const harness = await createEntrypointHarness();
    const config = await harness.run();

    expect(config.tools?.profile).toBe("full");
  });

  it("builds the Render image with the standard Playwright Chromium runtime", async () => {
    const [dockerfile, workflow] = await Promise.all([
      readFile(path.join(repoRoot, "Dockerfile"), "utf8"),
      readFile(workflowPath, "utf8"),
    ]);

    expect(dockerfile).toContain("playwright-core/cli.js install --with-deps chromium");
    expect(workflow).toContain("--build-arg OPENCLAW_INSTALL_BROWSER=1");
  });

  it("registers a thin external SG Render tool surface", async () => {
    const stateDir = await mkdtemp(path.join(os.tmpdir(), "sg22-phase1-plugin-"));
    const registerTool = vi.fn();

    registerWorkspaceManager({
      config: {},
      registerCommand: vi.fn(),
      registerInteractiveHandler: vi.fn(),
      registerTool,
      on: vi.fn(),
      runtime: {
        state: { resolveStateDir: () => stateDir },
        channel: { outbound: { loadAdapter: vi.fn(async () => undefined) } },
      },
    });

    const registeredNames = registerTool.mock.calls.flatMap((call) => call[1]?.names ?? []);
    expect(registeredNames.some((name) => /^sg_render(?:_|$)/u.test(name))).toBe(true);
  });

  it("gives the Monarch GitHub, Render and development tools under the full profile", async () => {
    const harness = await createEntrypointHarness();
    const config = await harness.run();
    const names = effectiveTools(config, ownerId);

    for (const required of [
      "exec",
      "process",
      "write",
      "edit",
      "apply_patch",
      "github_identity_status",
      "github_publish",
      "sg_render",
      "sg_project_memory_record",
      "sg_project_memory_search",
      "sg_project_memory_get",
      "gateway",
    ]) {
      expect(names, required).toContain(required);
    }
  });

  it("keeps infrastructure, secrets and administration unavailable to citizens", async () => {
    const harness = await createEntrypointHarness();
    const config = await harness.run();
    const names = effectiveTools(config, "citizen-1");

    for (const denied of [
      "read",
      "write",
      "edit",
      "apply_patch",
      "exec",
      "process",
      "terminal",
      "github_identity_status",
      "github_publish",
      "sg_render",
      "sg_project_memory_record",
      "sg_project_memory_search",
      "sg_project_memory_get",
      "gateway",
      "nodes",
      "openclaw",
      "skill_workshop",
      "sessions_spawn",
      "subagents",
      "secrets",
      "environment",
    ]) {
      expect(names, denied).not.toContain(denied);
    }
  });

  it("keeps ordinary browser, search, isolated memory, message, file and media tools for citizens", async () => {
    const harness = await createEntrypointHarness();
    const config = await harness.run();
    const names = effectiveTools(config, "citizen-1");

    for (const required of [
      "browser",
      "web_search",
      "web_fetch",
      "sg_memory_remember",
      "sg_memory_search",
      "sg_memory_get",
      "message",
      "file_fetch",
      "file_write",
      "view_image",
      "image_generate",
      "music_generate",
      "video_generate",
      "tts",
      "automations",
      "sg_content_draft",
      "sg_content_dispatch",
      "sg_test_attempt",
    ]) {
      expect(names, required).toContain(required);
    }
  });

  it("exposes Phase 5 Telegram delivery through native OpenClaw capabilities", async () => {
    const harness = await createEntrypointHarness();
    const config = await harness.run();
    const monarchTools = effectiveTools(config, ownerId);
    const citizenTools = effectiveTools(config, "citizen-1");

    expect(config.session?.dmScope).toBe("per-channel-peer");
    expect(config.channels?.telegram?.enabled).toBe(true);
    expect(config.channels?.telegram?.groups?.["*"]?.requireMention).toBe(true);
    expect(config.messages?.groupChat?.mentionPatterns).toEqual(
      expect.arrayContaining([expect.stringContaining("сг"), expect.stringContaining("sg")]),
    );
    expect(config.channels?.telegram?.capabilities?.inlineButtons).toBe("all");
    expect(config.channels?.telegram?.actions).toMatchObject({
      sendMessage: true,
      deleteMessage: true,
      reactions: true,
      poll: true,
    });
    expect(config.channels?.telegram?.replyToMode).toBe("first");
    expect(config.tts).toMatchObject({ provider: "openai", auto: "off" });

    for (const tool of ["message", "tts", "automations", "browser", "web_search", "web_fetch"]) {
      expect(monarchTools, tool).toContain(tool);
      expect(citizenTools, tool).toContain(tool);
    }
  });

  it("blocks citizen access to another direct session or private files", async () => {
    const harness = await createEntrypointHarness();
    const config = await harness.run();
    const names = effectiveTools(config, "citizen-1");

    expect(config.session?.dmScope).toBe("per-channel-peer");
    for (const crossSessionReader of [
      "read",
      "sessions",
      "sessions_list",
      "sessions_history",
      "sessions_search",
    ]) {
      expect(names, crossSessionReader).not.toContain(crossSessionReader);
    }
    expect(names).not.toContain("memory_search");
    expect(names).not.toContain("memory_get");
    expect(names).toContain("sg_memory_search");
    expect(names).toContain("sg_memory_get");
  });

  it("keeps cross-session send available only to the Monarch", async () => {
    const harness = await createEntrypointHarness();
    const config = await harness.run();

    expect(effectiveTools(config, ownerId)).toContain("sessions_send");
    expect(effectiveTools(config, "citizen-1")).not.toContain("sessions_send");
  });

  it("restores the same full capability policy after a stale-state restart", async () => {
    const harness = await createEntrypointHarness();
    const first = await harness.run();
    const stale = structuredClone(first);
    stale.tools = {
      ...stale.tools,
      profile: "coding",
      alsoAllow: [],
      toolsBySender: { "*": { deny: ["*"] } },
    };
    await writeFile(path.join(harness.stateDir, "openclaw.json"), JSON.stringify(stale), "utf8");

    const restarted = await harness.run();

    expect(restarted.tools?.profile).toBe("full");
    expect(restarted.tools).toEqual(first.tools);
    expect(restarted.session?.dmScope).toBe("per-channel-peer");
  });
});
