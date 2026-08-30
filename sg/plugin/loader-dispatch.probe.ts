import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHookRunner } from "../../src/plugins/hooks.js";
import {
  loadOpenClawPlugins,
  useNoBundledPlugins,
} from "../../src/plugins/loader.test-fixtures.js";
import { resolvePluginTools } from "../../src/plugins/tools.js";
import { SgWorkspaceRequestRegistry } from "./workspace-requests.js";

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
  runtimeRegistry: registry,
});

const promptBuildResult = await hookRunner.runBeforePromptBuild(
  {
    prompt: "Покажи ожидающие заявки на подключение сообществ",
    messages: [],
  },
  {
    runId: "run-pending",
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
    diagnosticHooksRegistered: [
      "before_prompt_build",
      "llm_input",
      "model_call_started",
      "before_tool_call",
      "after_tool_call",
      "before_agent_reply",
    ].every((hookName) =>
      registry.typedHooks.some(
        (hook) => hook.pluginId === "sg-workspace-manager" && hook.hookName === hookName,
      ),
    ),
    toolsRegistered: registry.tools.some(
      (tool) =>
        tool.pluginId === "sg-workspace-manager" &&
        tool.names.includes("sg_workspace_onboard") &&
        tool.names.includes("sg_workspace_pending") &&
        tool.names.includes("sg_workspace_decide"),
    ),
    promptGuidanceInjected:
      promptBuildResult?.prependSystemContext?.includes(
        "обязательно используй sg_workspace_pending",
      ) === true,
    pendingToolInModelSurface: pluginTools.some((tool) => tool.name === "sg_workspace_pending"),
    errorDiagnostics: registry.diagnostics.filter((item) => item.level === "error"),
    dispatchResult,
    repeatDispatchResult,
    pendingCount: (await new SgWorkspaceRequestRegistry(stateDir).listPending()).length,
  })}`,
);
