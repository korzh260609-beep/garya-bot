import type { OpenClawPluginApi } from "openclaw/plugin-sdk/plugin-entry";
import { registerSgActionPolicy } from "./action-policy.js";
import { registerSgBillingCommands } from "./billing-commands.js";
import { registerSgBillingHooks } from "./billing-hooks.js";
import { registerSgBillingReconciliation } from "./billing-reconciliation-lifecycle.js";
import { BILLING_TOOL_NAMES, createSgBillingTool } from "./billing-tools.js";
import { SgContentRegistry } from "./content-registry.js";
import { formatWorkspaceContext, resolveWorkspaceContext } from "./context.js";
import { buildSgCostDiagnostic, type SgCostDiagnosticConfig } from "./cost-diagnostics.js";
import {
  createSgDeviceTools,
  registerSgDeviceCommand,
  registerSgDeviceOwnershipPolicy,
  SG_DEVICE_TOOL_NAMES,
} from "./device-access.js";
import { SG_MANDATORY_EXECUTION_RULES } from "./mandatory-rules.js";
import { registerSgModelRouter } from "./model-router.js";
import { createPersonalMemoryTools } from "./personal-memory-tools.js";
import {
  createPhase11CapabilityTools,
  PHASE11_CAPABILITY_TOOL_NAMES,
} from "./phase11-capability-tools.js";
import { createSgRenderTool } from "./render-tools.js";
import { createResourceMemoryTools, RESOURCE_MEMORY_TOOL_NAMES } from "./resource-memory-tools.js";
import {
  canonicalWorkspaceResourceId,
  formatWorkspaceResolution,
  SgWorkspaceRegistry,
} from "./workspace-registry.js";
import { buildWsp5Diagnostic } from "./wsp5-diagnostics.js";
import { Wsp5NativeLifecycle } from "./wsp5-lifecycle.js";
import { createWsp5Tools } from "./wsp5-tools.js";
import { openSgAssessmentStores, SgAssessmentRegistry } from "./wsp6-assessments.js";
import { buildWsp6Diagnostic } from "./wsp6-diagnostics.js";
import { Wsp6InteractiveController } from "./wsp6-interactive.js";
import { Wsp6NativeLifecycle } from "./wsp6-lifecycle.js";
import { createWsp6Tools } from "./wsp6-tools.js";

type CommandContext = {
  channel: string;
  channelId?: string;
  accountId?: string;
  from?: string;
  to?: string;
  agentId?: string;
  sessionKey?: string;
  sessionId?: string;
  args?: string;
  threadParentId?: string;
  messageThreadId?: string | number;
  senderId?: string;
  config: SgCostDiagnosticConfig & {
    session?: { dmScope?: string; identityLinks?: Record<string, string[]> };
  };
};

type WorkspacePluginApi = {
  config?: OpenClawPluginApi["config"];
  runtime: {
    version?: string;
    state: {
      resolveStateDir(env?: NodeJS.ProcessEnv): string;
      openKeyedStore?: OpenClawPluginApi["runtime"]["state"]["openKeyedStore"];
    };
    nodes?: Pick<OpenClawPluginApi["runtime"]["nodes"], "list">;
    llm?: OpenClawPluginApi["runtime"]["llm"];
    channel?: Pick<OpenClawPluginApi["runtime"]["channel"], "outbound">;
  };
  registerInteractiveHandler?: OpenClawPluginApi["registerInteractiveHandler"];
  registerCommand: OpenClawPluginApi["registerCommand"];
  registerTool: OpenClawPluginApi["registerTool"];
  on: OpenClawPluginApi["on"];
  logger?: { info(message: string): void; warn(message: string): void };
};

const WSP5_TOOL_NAMES = [
  "sg_content_draft",
  "sg_content_review",
  "sg_content_publish",
  "sg_content_schedule",
  "sg_content_dispatch",
] as const;
const WSP6_TOOL_NAMES = ["sg_test_manage", "sg_test_attempt", "sg_test_stats"] as const;
const PERSONAL_MEMORY_TOOL_NAMES = [
  "sg_memory_remember",
  "sg_memory_search",
  "sg_memory_get",
  "sg_memory_correct",
  "sg_memory_forget",
  "sg_memory_export",
  "sg_memory_reindex",
] as const;

const RENDER_TOOL_NAMES = ["sg_render"] as const;

export function registerWorkspaceManager(api: WorkspacePluginApi): void {
  api.logger?.info("[sg-workspace] stage=register-workspace-manager");
  const stateDir =
    process.env.OPENCLAW_STATE_DIR?.trim() || api.runtime.state.resolveStateDir(process.env);
  const registry = new SgWorkspaceRegistry(stateDir);
  const wsp5Lifecycle = new Wsp5NativeLifecycle(new SgContentRegistry(stateDir), api.logger);
  let assessments: SgAssessmentRegistry | undefined;
  const resolveAssessments = () => {
    if (assessments) {
      return assessments;
    }
    assessments = new SgAssessmentRegistry(openSgAssessmentStores(stateDir));
    return assessments;
  };
  const wsp6Lifecycle = new Wsp6NativeLifecycle(api.logger);
  const wsp6Interactive = api.registerInteractiveHandler
    ? new Wsp6InteractiveController(stateDir, resolveAssessments, {
        config: api.config,
        registerInteractiveHandler: api.registerInteractiveHandler,
        loadOutboundAdapter: (channelId) => {
          const channelRuntime = api.runtime.channel;
          if (!channelRuntime) {
            throw new Error("sg-test-channel-runtime-unavailable");
          }
          return channelRuntime.outbound.loadAdapter(channelId);
        },
        logger: api.logger,
      })
    : undefined;
  wsp6Interactive?.register();
  const resolveDiagnosticContext = async (ctx: CommandContext) => {
    const actor = await resolveWorkspaceContext(
      {
        channel: ctx.channel,
        accountId: ctx.accountId,
        to: ctx.to,
        threadParentId: ctx.threadParentId,
        messageThreadId: ctx.messageThreadId,
        senderId: ctx.senderId,
        identityLinks: ctx.config.session?.identityLinks,
      },
      stateDir,
    );
    const routeResourceId = ctx.threadParentId ?? ctx.to;
    const scope = routeResourceId
      ? await registry.resolve({
          platform: ctx.channel,
          accountId: ctx.accountId,
          resourceId: canonicalWorkspaceResourceId(ctx.channel, routeResourceId),
          ...(ctx.messageThreadId !== undefined ? { topicId: String(ctx.messageThreadId) } : {}),
        })
      : undefined;
    return {
      ...actor,
      ...(scope ? { resourceScopeId: scope.resourceScopeId } : {}),
      // Reaching the command handler proves native OpenClaw admission for this request.
      nativePolicyOutcome: "admitted" as const,
    };
  };

  api.registerTool((ctx) => createWsp5Tools(ctx, stateDir, wsp5Lifecycle), {
    names: [...WSP5_TOOL_NAMES],
  });
  api.registerTool((ctx) => createWsp6Tools(ctx, stateDir, resolveAssessments(), wsp6Lifecycle), {
    names: [...WSP6_TOOL_NAMES],
  });
  api.registerTool((ctx) => createPersonalMemoryTools(ctx, stateDir), {
    names: [...PERSONAL_MEMORY_TOOL_NAMES],
  });
  api.registerTool((ctx) => createResourceMemoryTools(ctx, stateDir), {
    names: [...RESOURCE_MEMORY_TOOL_NAMES],
  });
  api.registerTool((ctx) => createSgRenderTool(ctx, stateDir), { names: [...RENDER_TOOL_NAMES] });
  api.registerTool((ctx) => createSgBillingTool(ctx, stateDir, { logger: api.logger }), {
    names: [...BILLING_TOOL_NAMES],
  });
  api.registerTool((ctx) => createPhase11CapabilityTools(ctx, stateDir), {
    names: [...PHASE11_CAPABILITY_TOOL_NAMES],
  });
  api.registerTool((ctx) => createSgDeviceTools(ctx, stateDir, api), {
    names: [...SG_DEVICE_TOOL_NAMES],
  });
  wsp5Lifecycle.register(api);
  wsp6Lifecycle.register(api);
  registerSgActionPolicy({ api, stateDir });
  registerSgDeviceOwnershipPolicy({ api, stateDir });
  registerSgDeviceCommand(api, stateDir);
  registerSgBillingHooks({ api, stateDir });
  registerSgBillingCommands({ api, stateDir });
  registerSgModelRouter({ api, stateDir });
  registerSgBillingReconciliation({ api, stateDir });

  // Fallback diagnostics stay in OpenClaw state/logs; SG chat shows only the answer footer.
  api.on("reply_payload_sending", (event) =>
    event.payload.isFallbackNotice === true
      ? { cancel: true, reason: "sg-fallback-notice-hidden" }
      : undefined,
  );

  api.on("before_prompt_build", async (_event, ctx) => {
    let identityContext = [
      "SG — identity and scope",
      "Global ID: не найден",
      "Роль SG: не определена",
    ].join("\n");
    try {
      const identity = await resolveWorkspaceContext(
        {
          channel: ctx.channel ?? ctx.messageProvider ?? "",
          accountId: ctx.accountId,
          to: ctx.conversationId,
          senderId: ctx.senderId,
          identityLinks: api.config?.session?.identityLinks,
        },
        stateDir,
      );
      identityContext = formatWorkspaceContext(identity);
    } catch (error) {
      api.logger?.warn(
        `[sg-workspace] identity resolution failed safely: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    return {
      appendSystemContext: SG_MANDATORY_EXECUTION_RULES,
      prependSystemContext: identityContext,
    };
  });

  // OpenClaw invokes this hook only after native channel admission. SG records only
  // neutral route isolation and never claims or blocks the accepted message.
  api.on("before_dispatch", async (event, ctx) => {
    const slashLane = ctx.sessionKey?.includes(":slash:") === true;
    const slashText = (event.body ?? event.content)?.trimStart().startsWith("/") === true;
    if (event.isGroup !== true || slashLane || slashText) {
      return { handled: false };
    }
    const channel = ctx.channelId ?? event.channel;
    const conversationId = ctx.conversationId;
    if (!channel || !conversationId) {
      api.logger?.warn("SG resource scope registration skipped: trusted route is incomplete");
      return { handled: false };
    }
    try {
      await registry.register({
        platform: channel,
        ...(ctx.accountId ? { accountId: ctx.accountId } : {}),
        resourceId: canonicalWorkspaceResourceId(channel, conversationId),
        resourceKind: "group",
      });
    } catch (error) {
      api.logger?.warn(
        `SG resource scope registration failed safely: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    return { handled: false };
  });

  api.registerCommand({
    name: "sg_context",
    description: "Показать безопасный диагностический контекст SG",
    requireAuth: false,
    handler: async (ctx) => ({ text: formatWorkspaceContext(await resolveDiagnosticContext(ctx)) }),
  });
  api.registerCommand({
    name: "sg_workspace",
    description: "Показать текущий resource scope SG",
    requireAuth: false,
    handler: async (ctx) => {
      const resourceId = ctx.threadParentId ?? ctx.to;
      if (!resourceId) {
        return { text: formatWorkspaceResolution(undefined) };
      }
      const scope = await registry.resolve({
        platform: ctx.channel,
        accountId: ctx.accountId,
        resourceId,
        ...(ctx.messageThreadId !== undefined ? { topicId: String(ctx.messageThreadId) } : {}),
      });
      return { text: formatWorkspaceResolution(scope) };
    },
  });
  api.registerCommand({
    name: "sg_wsp5_diag",
    description: "Проверить полную цепочку WSP5",
    requireAuth: false,
    handler: async (ctx) => {
      const actor = await resolveWorkspaceContext(
        {
          channel: ctx.channel,
          accountId: ctx.accountId,
          to: ctx.to,
          threadParentId: ctx.threadParentId,
          messageThreadId: ctx.messageThreadId,
          senderId: ctx.senderId,
          identityLinks: ctx.config.session?.identityLinks,
        },
        stateDir,
      );
      if (actor.projectRole !== "monarch" || !actor.globalId) {
        return { text: "WSP5 DIAG — доступ разрешён только монарху" };
      }
      return {
        text: await buildWsp5Diagnostic({
          stateDir,
          actor,
          registeredToolNames: WSP5_TOOL_NAMES,
          lifecycle: wsp5Lifecycle.snapshot(),
        }),
      };
    },
  });
  api.registerCommand({
    name: "sg_wsp6_diag",
    description: "Проверить цепочку опросов и тестов WSP6",
    requireAuth: false,
    handler: async (ctx) => {
      const actor = await resolveWorkspaceContext(
        {
          channel: ctx.channel,
          accountId: ctx.accountId,
          to: ctx.to,
          threadParentId: ctx.threadParentId,
          messageThreadId: ctx.messageThreadId,
          senderId: ctx.senderId,
          identityLinks: ctx.config.session?.identityLinks,
        },
        stateDir,
      );
      if (actor.projectRole !== "monarch" || !actor.globalId) {
        return { text: "WSP6 DIAG — доступ разрешён только монарху" };
      }
      return {
        text: await buildWsp6Diagnostic({
          assessments: resolveAssessments(),
          lifecycle: wsp6Lifecycle.snapshot(),
          interactive: wsp6Interactive?.snapshot(),
          registeredToolNames: WSP6_TOOL_NAMES,
        }),
      };
    },
  });
  api.registerCommand({
    name: "sg_cost_diag",
    description: "Проверить изоляцию сессии и защиту стоимости SG",
    requireAuth: false,
    handler: async (ctx) => {
      const actor = await resolveWorkspaceContext(
        {
          channel: ctx.channel,
          accountId: ctx.accountId,
          to: ctx.to,
          senderId: ctx.senderId,
          identityLinks: ctx.config.session?.identityLinks,
        },
        stateDir,
      );
      if (actor.projectRole !== "monarch" || !actor.globalId) {
        return { text: "SG COST DIAG — доступ разрешён только монарху" };
      }
      return {
        text: buildSgCostDiagnostic({
          config: ctx.config,
          channel: ctx.channel,
          sessionKey: ctx.sessionKey,
        }),
      };
    },
  });
}
