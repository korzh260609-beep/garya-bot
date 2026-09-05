import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveEmbeddedAttemptToolConstructionPlan } from "../../src/agents/embedded-agent-runner/run/attempt-tool-construction-plan.js";
import { createHookRunner } from "../../src/plugins/hooks.js";
import {
  loadOpenClawPlugins,
  useNoBundledPlugins,
} from "../../src/plugins/loader.test-fixtures.js";
import { resolvePluginTools } from "../../src/plugins/tools.js";
import { SgWorkspaceRegistry } from "./workspace-registry.js";

const stateDir = process.argv[2];
if (!stateDir) {
  throw new Error("state directory is required");
}
process.env.OPENCLAW_STATE_DIR = stateDir;
useNoBundledPlugins();

const pluginDir = path.dirname(fileURLToPath(import.meta.url));
const pluginConfig = {
  plugins: {
    load: { paths: [pluginDir] },
    allow: ["sg-workspace-manager"],
    entries: {
      "sg-workspace-manager": {
        enabled: true,
        hooks: { allowPromptInjection: true, allowConversationAccess: true },
      },
    },
  },
};
const registry = loadOpenClawPlugins({
  cache: false,
  workspaceDir: stateDir,
  config: pluginConfig,
});
const hookRunner = createHookRunner(registry);
const workspaceToolGrant = [
  "sg_content_draft",
  "sg_content_review",
  "sg_content_publish",
  "sg_content_schedule",
  "sg_content_dispatch",
  "sg_test_manage",
  "sg_test_attempt",
  "sg_test_stats",
];
const withoutWorkspaceGrant = resolveEmbeddedAttemptToolConstructionPlan({
  toolsEnabled: true,
  toolsAllow: ["read"],
});
const withWorkspaceGrant = resolveEmbeddedAttemptToolConstructionPlan({
  toolsEnabled: true,
  toolsAllow: ["read", ...workspaceToolGrant],
});
const pluginTools = resolvePluginTools({
  context: {
    config: pluginConfig,
    runtimeConfig: pluginConfig,
    workspaceDir: stateDir,
    messageChannel: "telegram",
    agentAccountId: "default",
    nativeChannelId: "telegram:100",
    requesterSenderId: "100",
  },
  toolAllowlist: withWorkspaceGrant.runtimeToolAllowlist,
  runtimeRegistry: registry,
});
const pluginToolsWithoutGrant = resolvePluginTools({
  context: {
    config: pluginConfig,
    runtimeConfig: pluginConfig,
    workspaceDir: stateDir,
    messageChannel: "telegram",
    agentAccountId: "default",
    nativeChannelId: "telegram:100",
    requesterSenderId: "100",
  },
  toolAllowlist: withoutWorkspaceGrant.runtimeToolAllowlist,
  runtimeRegistry: registry,
});

const promptBuildResult = await hookRunner.runBeforePromptBuild(
  {
    prompt: "Покажи текущий контекст",
    messages: [],
  },
  {
    runId: "run-context",
    sessionKey: "agent:main:telegram:direct:100",
    channel: "telegram",
    accountId: "default",
    senderId: "100",
  },
);

const dispatchResult = await hookRunner.runBeforeDispatch(
  {
    messageId: "telegram-message-42",
    content: "СГ, привет",
    channel: "telegram",
    senderId: "200",
    isGroup: true,
  },
  {
    messageId: "telegram-message-42",
    channelId: "telegram",
    accountId: "default",
    conversationId: "telegram:-100500",
    sessionKey: "agent:main:telegram:group:-100500",
    senderId: "200",
  },
);
const repeatDispatchResult = await hookRunner.runBeforeDispatch(
  {
    messageId: "telegram-message-43",
    content: "СГ, привет",
    channel: "telegram",
    senderId: "200",
    isGroup: true,
  },
  {
    messageId: "telegram-message-43",
    channelId: "telegram",
    accountId: "default",
    conversationId: "telegram:-100500",
    sessionKey: "agent:main:telegram:group:-100500",
    senderId: "200",
  },
);

console.log(
  `SG_LOADER_PROBE=${JSON.stringify({
    pluginLoaded: registry.plugins.some(
      (plugin) => plugin.id === "sg-workspace-manager" && plugin.status === "loaded",
    ),
    hookRegistered: registry.typedHooks.some(
      (hook) => hook.pluginId === "sg-workspace-manager" && hook.hookName === "before_dispatch",
    ),
    promptHookRegistered: registry.typedHooks.some(
      (hook) => hook.pluginId === "sg-workspace-manager" && hook.hookName === "before_prompt_build",
    ),
    lifecycleHooksRegistered: ["before_prompt_build", "before_tool_call", "after_tool_call"].every(
      (hookName) =>
        registry.typedHooks.some(
          (hook) => hook.pluginId === "sg-workspace-manager" && hook.hookName === hookName,
        ),
    ),
    onboardingToolsAbsent: !registry.tools.some(
      (tool) =>
        tool.pluginId === "sg-workspace-manager" &&
        tool.names.some((name) =>
          ["sg_workspace_onboard", "sg_workspace_pending", "sg_workspace_decide"].includes(name),
        ),
    ),
    wsp5ToolsRegistered: registry.tools.some(
      (tool) =>
        tool.pluginId === "sg-workspace-manager" &&
        [
          "sg_content_draft",
          "sg_content_review",
          "sg_content_publish",
          "sg_content_schedule",
          "sg_content_dispatch",
        ].every((name) => tool.names.includes(name)),
    ),
    wsp6ToolsRegistered: registry.tools.some(
      (tool) =>
        tool.pluginId === "sg-workspace-manager" &&
        ["sg_test_manage", "sg_test_attempt", "sg_test_stats"].every((name) =>
          tool.names.includes(name),
        ),
    ),
    onboardingGuidanceAbsent:
      !promptBuildResult?.prependSystemContext?.includes("sg_workspace_pending"),
    onboardingToolsAbsentInModelSurface: !pluginTools.some((tool) =>
      ["sg_workspace_onboard", "sg_workspace_pending", "sg_workspace_decide"].includes(tool.name),
    ),
    wsp5ToolsInModelSurface: [
      "sg_content_draft",
      "sg_content_review",
      "sg_content_publish",
      "sg_content_schedule",
      "sg_content_dispatch",
    ].every((name) => pluginTools.some((tool) => tool.name === name)),
    wsp6ToolsInModelSurface: ["sg_test_manage", "sg_test_attempt", "sg_test_stats"].every((name) =>
      pluginTools.some((tool) => tool.name === name),
    ),
    citizenshipToolsAbsentWithoutGrant: !pluginToolsWithoutGrant.some((tool) =>
      tool.name.startsWith("sg_citizen_"),
    ),
    wsp5ToolsAbsentWithoutGrant: !pluginToolsWithoutGrant.some((tool) =>
      tool.name.startsWith("sg_content_"),
    ),
    wsp6ToolsAbsentWithoutGrant: !pluginToolsWithoutGrant.some((tool) =>
      tool.name.startsWith("sg_test_"),
    ),
    pluginToolsExcludedWithoutGrant:
      !withoutWorkspaceGrant.codingToolConstructionPlan.includePluginTools,
    pluginToolsIncludedWithGrant: withWorkspaceGrant.codingToolConstructionPlan.includePluginTools,
    errorDiagnostics: registry.diagnostics.filter((item) => item.level === "error"),
    dispatchClaimed: dispatchResult?.handled === true,
    repeatDispatchClaimed: repeatDispatchResult?.handled === true,
    resourceScopeCount: (await new SgWorkspaceRegistry(stateDir).list()).length,
  })}`,
);
