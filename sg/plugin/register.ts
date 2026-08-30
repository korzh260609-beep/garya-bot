import { createHash } from "node:crypto";
import type { OpenClawPluginApi } from "openclaw/plugin-sdk/plugin-entry";
import { formatWorkspaceContext, resolveWorkspaceContext } from "./context.js";
import { formatWorkspaceResolution, SgWorkspaceRegistry } from "./workspace-registry.js";
import { SgWorkspaceRequestRegistry } from "./workspace-requests.js";
import { createWorkspaceTools, WSP3_AGENT_GUIDANCE } from "./workspace-tools.js";

type CommandContext = {
  channel: string;
  accountId?: string;
  to?: string;
  sessionKey?: string;
  threadParentId?: string;
  messageThreadId?: string | number;
  senderId?: string;
  config: { session?: { identityLinks?: Record<string, string[]> } };
};

type WorkspacePluginApi = {
  config?: { session?: { identityLinks?: Record<string, string[]> } };
  runtime: {
    state: {
      resolveStateDir(env?: NodeJS.ProcessEnv): string;
    };
  };
  registerCommand(command: {
    name: string;
    description: string;
    requireAuth: boolean;
    handler(ctx: CommandContext): Promise<{ text: string }>;
  }): void;
  registerTool(
    factory: (
      ctx: Parameters<typeof createWorkspaceTools>[0],
    ) => ReturnType<typeof createWorkspaceTools>,
    options: { names: string[] },
  ): void;
  on: OpenClawPluginApi["on"];
  logger?: { info(message: string): void; warn(message: string): void };
};

const ONBOARDING_NOTICE =
  "Я обнаружил новое сообщество и отправил запрос на подключение. Сообщу после подтверждения владельца.";
const PENDING_NOTICE =
  "Запрос на подключение этого сообщества уже ожидает подтверждения владельца.";
const PENDING_TOOL = "sg_workspace_pending";
const MAX_DIAGNOSTIC_SESSIONS = 100;

type Wsp3DiagnosticTrace = {
  runId?: string;
  promptHook: boolean;
  pendingToolAllowed?: boolean;
  modelCalls: number;
  pendingToolSelected: boolean;
  pendingToolCompleted: boolean;
  pendingToolResultReadable?: boolean;
  pendingToolResultStatus?: string;
  pendingToolResultCount?: number;
  toolError?: string;
  finalReply: boolean;
};

function newDiagnosticTrace(runId?: string): Wsp3DiagnosticTrace {
  return {
    runId,
    promptHook: false,
    modelCalls: 0,
    pendingToolSelected: false,
    pendingToolCompleted: false,
    finalReply: false,
  };
}

function diagnosticFailure(params: {
  trace?: Wsp3DiagnosticTrace;
  projectRole: string;
  pendingCount?: number;
  storeError?: string;
}): string {
  if (params.projectRole !== "monarch") {
    return "monarch_identity_not_resolved";
  }
  if (params.storeError) {
    return "pending_store_read_failed";
  }
  if (params.pendingCount === 0) {
    return "pending_store_empty";
  }
  if (!params.trace) {
    return "model_trace_missing";
  }
  if (!params.trace.promptHook) {
    return "prompt_hook_missing";
  }
  if (params.trace.pendingToolAllowed !== true) {
    return "pending_tool_not_in_model_surface";
  }
  if (params.trace.modelCalls === 0) {
    return "model_call_not_started";
  }
  if (!params.trace.pendingToolSelected) {
    return "model_did_not_select_pending_tool";
  }
  if (params.trace.toolError) {
    return "pending_tool_execution_failed";
  }
  if (!params.trace.pendingToolCompleted) {
    return "pending_tool_result_missing";
  }
  if (params.trace.pendingToolResultReadable !== true) {
    return "pending_tool_result_invalid";
  }
  if (params.trace.pendingToolResultStatus !== "ok") {
    return `pending_tool_result_${params.trace.pendingToolResultStatus ?? "unknown"}`;
  }
  if (params.trace.pendingToolResultCount !== params.pendingCount) {
    return "pending_tool_result_store_mismatch";
  }
  if (!params.trace.finalReply) {
    return "final_reply_not_observed";
  }
  return "none";
}

function canonicalResourceId(channel: string, conversationId: string): string {
  const normalizedChannel = channel.trim().toLowerCase();
  const normalizedConversationId = conversationId.trim();
  return normalizedConversationId.toLowerCase().startsWith(`${normalizedChannel}:`)
    ? normalizedConversationId
    : `${normalizedChannel}:${normalizedConversationId}`;
}

function traceIdFor(messageId: string | undefined): string {
  return createHash("sha256")
    .update(messageId ?? "missing-message-id")
    .digest("hex")
    .slice(0, 12);
}

function trace(api: WorkspacePluginApi, traceId: string, stage: string, result?: string): void {
  api.logger?.info(
    `[sg-workspace] trace=${traceId} stage=${stage}${result ? ` result=${result}` : ""}`,
  );
}

export function registerWorkspaceManager(api: WorkspacePluginApi): void {
  api.logger?.info("[sg-workspace] stage=register-workspace-manager");
  const stateDir =
    process.env.OPENCLAW_STATE_DIR?.trim() || api.runtime.state.resolveStateDir(process.env);
  api.logger?.info("[sg-workspace] stage=resolve-state-dir");
  const registry = new SgWorkspaceRegistry(stateDir);
  const requests = new SgWorkspaceRequestRegistry(stateDir);
  const diagnosticTraces = new Map<string, Wsp3DiagnosticTrace>();
  const updateDiagnostic = (
    sessionKey: string | undefined,
    runId: string | undefined,
    update: (trace: Wsp3DiagnosticTrace) => void,
  ) => {
    if (!sessionKey) {
      return;
    }
    let current = diagnosticTraces.get(sessionKey);
    if (!current || (runId && current.runId !== runId)) {
      current = newDiagnosticTrace(runId);
      if (!diagnosticTraces.has(sessionKey) && diagnosticTraces.size >= MAX_DIAGNOSTIC_SESSIONS) {
        diagnosticTraces.delete(diagnosticTraces.keys().next().value as string);
      }
      diagnosticTraces.set(sessionKey, current);
    }
    update(current);
  };
  const diagnosticLog = (
    sessionKey: string | undefined,
    runId: string | undefined,
    stage: string,
    result: string,
  ) => {
    api.logger?.info(
      `[sg-wsp3-diag] session=${traceIdFor(sessionKey)} run=${traceIdFor(runId)} stage=${stage} result=${result}`,
    );
  };
  api.logger?.info("[sg-workspace] stage=register-tools");
  api.registerTool((ctx) => createWorkspaceTools(ctx, stateDir), {
    names: ["sg_workspace_onboard", "sg_workspace_pending", "sg_workspace_decide"],
  });
  api.logger?.info("[sg-workspace] stage=register-tools-complete");
  api.on(
    "before_prompt_build",
    async (_event, ctx) => {
      const pendingToolAllowed = ctx.toolAuthority?.allows(PENDING_TOOL) === true;
      updateDiagnostic(ctx.sessionKey, ctx.runId, (current) => {
        current.promptHook = true;
        current.pendingToolAllowed = pendingToolAllowed;
      });
      diagnosticLog(
        ctx.sessionKey,
        ctx.runId,
        "prompt-hook",
        pendingToolAllowed ? "pending-tool-allowed" : "pending-tool-blocked",
      );
      return { prependSystemContext: WSP3_AGENT_GUIDANCE };
    },
    { requiresToolAuthority: true },
  );
  api.on("model_call_started", (event, ctx) => {
    const runId = ctx.runId ?? event.runId;
    const sessionKey = ctx.sessionKey ?? event.sessionKey;
    updateDiagnostic(sessionKey, runId, (current) => {
      current.modelCalls += 1;
    });
    diagnosticLog(sessionKey, runId, "model-call", "started");
  });
  api.on(
    "before_tool_call",
    (event, ctx) => {
      const runId = ctx.runId ?? event.runId;
      updateDiagnostic(ctx.sessionKey, runId, (current) => {
        current.pendingToolSelected = true;
      });
      diagnosticLog(ctx.sessionKey, runId, "pending-tool", "selected");
    },
    { matcher: [PENDING_TOOL] },
  );
  api.on(
    "after_tool_call",
    (event, ctx) => {
      const runId = ctx.runId ?? event.runId;
      const result =
        event.result && typeof event.result === "object"
          ? (event.result as { details?: unknown })
          : undefined;
      const details =
        result?.details && typeof result.details === "object"
          ? (result.details as { status?: unknown; requests?: unknown })
          : undefined;
      const resultReadable =
        typeof details?.status === "string" &&
        (details.status !== "ok" || Array.isArray(details.requests));
      updateDiagnostic(ctx.sessionKey, runId, (current) => {
        current.pendingToolCompleted = !event.error;
        current.pendingToolResultReadable = resultReadable;
        current.pendingToolResultStatus =
          typeof details?.status === "string" ? details.status : undefined;
        current.pendingToolResultCount = Array.isArray(details?.requests)
          ? details.requests.length
          : undefined;
        current.toolError = event.error;
      });
      diagnosticLog(
        ctx.sessionKey,
        runId,
        "pending-tool-result",
        event.error
          ? "execution-error"
          : resultReadable
            ? `${String(details?.status)}:${Array.isArray(details?.requests) ? details.requests.length : 0}`
            : "invalid-payload",
      );
    },
    { matcher: [PENDING_TOOL] },
  );
  api.on("before_agent_reply", (event, ctx) => {
    updateDiagnostic(ctx.sessionKey, ctx.runId, (current) => {
      current.finalReply = Boolean(event.cleanedBody.trim());
    });
    diagnosticLog(
      ctx.sessionKey,
      ctx.runId,
      "final-reply",
      event.cleanedBody.trim() ? "present" : "empty",
    );
  });
  api.logger?.info("[sg-workspace] stage=register-before-dispatch");
  api.on("before_dispatch", async (event, ctx) => {
    const traceId = traceIdFor(ctx.messageId);
    trace(api, traceId, "hook-enter");
    if (event.isGroup !== true) {
      trace(api, traceId, "context-check", "direct-chat");
      trace(api, traceId, "dispatch-handle", "false");
      return { handled: false };
    }
    const channel = ctx.channelId ?? event.channel;
    const senderId = ctx.senderId ?? event.senderId;
    const missingContext = [
      !channel ? "channelId" : undefined,
      !ctx.conversationId ? "conversationId" : undefined,
      !senderId ? "senderId" : undefined,
    ].filter((field): field is string => field !== undefined);
    if (missingContext.length > 0) {
      trace(api, traceId, "context-check", `missing-${missingContext.join("-")}`);
      api.logger?.warn(
        `SG workspace automatic onboarding skipped: missing ${missingContext.join(",")}`,
      );
      return { handled: false };
    }
    trace(api, traceId, "context-check", "valid");
    try {
      const resourceId = canonicalResourceId(channel, ctx.conversationId);
      const resource = {
        platform: channel,
        accountId: ctx.accountId,
        resourceId,
      };
      const workspace = await registry.resolve(resource);
      trace(api, traceId, "workspace-lookup", workspace ? "found" : "missing");
      const request = workspace ? undefined : await requests.resolve(resource);
      trace(api, traceId, "request-lookup", request ? "found" : "missing");
      if (!workspace && request) {
        trace(api, traceId, "pending-create", "existing");
        trace(api, traceId, "dispatch-handle", "true");
        return { handled: true, text: PENDING_NOTICE };
      }
      if (!workspace && !request) {
        const actor = await resolveWorkspaceContext(
          {
            channel,
            accountId: ctx.accountId,
            to: resourceId,
            senderId,
            identityLinks: api.config?.session?.identityLinks,
          },
          stateDir,
        );
        trace(api, traceId, "actor-resolve", actor.canonicalIdentity ? "resolved" : "missing");
        if (actor.canonicalIdentity) {
          await requests.create({
            ...resource,
            resourceKind: "group",
            title: `Сообщество ${ctx.conversationId}`,
            initiatorCanonicalIdentity: actor.canonicalIdentity,
            ...(actor.globalId ? { initiatorGlobalId: actor.globalId } : {}),
          });
          trace(api, traceId, "pending-create", "created");
          trace(api, traceId, "dispatch-handle", "true");
          return { handled: true, text: ONBOARDING_NOTICE };
        }
      }
    } catch (error) {
      api.logger?.warn(
        `SG workspace automatic onboarding failed safely: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    trace(api, traceId, "dispatch-handle", "false");
    return { handled: false };
  });
  api.registerCommand({
    name: "sg_context",
    description: "Показать безопасный диагностический контекст SG",
    requireAuth: false,
    handler: async (ctx) => ({
      text: formatWorkspaceContext(
        await resolveWorkspaceContext({
          channel: ctx.channel,
          accountId: ctx.accountId,
          to: ctx.to,
          threadParentId: ctx.threadParentId,
          messageThreadId: ctx.messageThreadId,
          senderId: ctx.senderId,
          identityLinks: ctx.config.session?.identityLinks,
        }),
      ),
    }),
  });
  api.registerCommand({
    name: "sg_workspace",
    description: "Показать зарегистрированный workspace SG",
    requireAuth: false,
    handler: async (ctx) => {
      const resourceId = ctx.threadParentId ?? ctx.to;
      if (!resourceId) {
        return { text: formatWorkspaceResolution(undefined) };
      }
      const workspace = await registry.resolve({
        platform: ctx.channel,
        accountId: ctx.accountId,
        resourceId,
        ...(ctx.messageThreadId !== undefined ? { topicId: String(ctx.messageThreadId) } : {}),
      });
      return { text: formatWorkspaceResolution(workspace) };
    },
  });
  api.registerCommand({
    name: "sg_wsp3_diag",
    description: "Проверить полную цепочку WSP3",
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
      if (actor.projectRole !== "monarch") {
        return { text: "WSP3 DIAG — доступ разрешён только монарху" };
      }
      let pending: Awaited<ReturnType<SgWorkspaceRequestRegistry["listPending"]>> = [];
      let storeError: string | undefined;
      try {
        pending = await requests.listPending();
      } catch (error) {
        storeError = error instanceof Error ? error.message : String(error);
      }
      const lastTrace = ctx.sessionKey ? diagnosticTraces.get(ctx.sessionKey) : undefined;
      const pendingTitles = pending
        .map((request) => request.title.replace(/\s+/g, " ").trim())
        .slice(0, 5);
      const failure = diagnosticFailure({
        trace: lastTrace,
        projectRole: actor.projectRole,
        pendingCount: pending.length,
        storeError,
      });
      diagnosticLog(ctx.sessionKey, lastTrace?.runId, "summary", failure);
      const traceStatus = (value: boolean | undefined) =>
        value === undefined ? "UNKNOWN" : value ? "OK" : "FAIL";
      return {
        text: [
          "WSP3 DIAG",
          "plugin_loader: OK",
          `identity: OK (${actor.projectRole})`,
          `prompt_hook: ${traceStatus(lastTrace?.promptHook)}`,
          `pending_tool_surface: ${traceStatus(lastTrace?.pendingToolAllowed)}`,
          `model_call: ${lastTrace ? `OK (${lastTrace.modelCalls})` : "UNKNOWN"}`,
          `pending_tool_selected: ${traceStatus(lastTrace?.pendingToolSelected)}`,
          `pending_store: ${storeError ? `FAIL (${storeError})` : `OK (${pending.length}: ${pendingTitles.join(", ") || "empty"})`}`,
          `pending_tool_result: ${traceStatus(lastTrace?.pendingToolCompleted)}`,
          `pending_tool_payload: ${
            !lastTrace?.pendingToolCompleted
              ? "UNKNOWN"
              : lastTrace.pendingToolResultReadable !== true
                ? "FAIL (invalid)"
                : `${lastTrace.pendingToolResultStatus === "ok" ? "OK" : "FAIL"} (${lastTrace.pendingToolResultStatus}: ${lastTrace.pendingToolResultCount ?? "n/a"})`
          }`,
          `reply_path: ${traceStatus(lastTrace?.finalReply)}`,
          `failure: ${failure}`,
        ].join("\n"),
      };
    },
  });
}
