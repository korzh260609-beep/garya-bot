import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHookRunner } from "../../src/plugins/hooks.js";
import {
  loadOpenClawPlugins,
  useNoBundledPlugins,
} from "../../src/plugins/loader.test-fixtures.js";
import { SgWorkspaceRequestRegistry } from "./workspace-requests.js";

const stateDir = process.argv[2];
if (!stateDir) {
  throw new Error("state directory is required");
}
process.env.OPENCLAW_STATE_DIR = stateDir;
useNoBundledPlugins();

const pluginDir = path.dirname(fileURLToPath(import.meta.url));
const registry = loadOpenClawPlugins({
  cache: false,
  workspaceDir: stateDir,
  config: {
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
  },
});

const dispatchResult = await createHookRunner(registry).runBeforeDispatch(
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
const repeatDispatchResult = await createHookRunner(registry).runBeforeDispatch(
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
    toolsRegistered: registry.tools.some(
      (tool) =>
        tool.pluginId === "sg-workspace-manager" &&
        tool.names.includes("sg_workspace_onboard") &&
        tool.names.includes("sg_workspace_pending") &&
        tool.names.includes("sg_workspace_decide"),
    ),
    errorDiagnostics: registry.diagnostics.filter((item) => item.level === "error"),
    dispatchResult,
    repeatDispatchResult,
    pendingCount: (await new SgWorkspaceRequestRegistry(stateDir).listPending()).length,
  })}`,
);
