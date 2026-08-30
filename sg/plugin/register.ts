import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";
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
const MAX_DURABLE_EVENTS = 100;
const MAX_DURABLE_INSTANCES = 20;

type DurableDiagnosticStage =
  | "plugin-loaded"
  | "prompt-hook"
  | "model-call"
  | "pending-tool-selected"
  | "pending-tool-result"
  | "final-reply"
  | "diagnostic-command";

type DurableDiagnosticEvent = {
  version: 1;
  instanceId: string;
  pid: number;
  startedAt: string;
  recordedAt: string;
  stage: DurableDiagnosticStage;
  sessionHash: string;
  routeHash: string;
  runHash: string;
  result: string;
};

type DiagnosticHookCounts = {
  prompt: number;
  model: number;
  toolSelected: number;
  toolResult: number;
  reply: number;
};

type Wsp3DiagnosticTrace = {
  runId?: string;
  sessionKey?: string;
  routeKey?: string;
  sequence: number;
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

function newDiagnosticTrace(runId: string | undefined, sequence: number): Wsp3DiagnosticTrace {
  return {
    runId,
    sequence,
    promptHook: false,
    modelCalls: 0,
    pendingToolSelected: false,
    pendingToolCompleted: false,
    finalReply: false,
  };
}

function normalizedRouteKey(params: {
  channel?: string;
  accountId?: string;
  senderId?: string;
}): string | undefined {
  const channel = params.channel?.trim().toLowerCase();
  const senderId = params.senderId?.trim().toLowerCase();
  if (!channel || !senderId) {
    return undefined;
  }
  return `${channel}|${params.accountId?.trim().toLowerCase() || "default"}|${senderId}`;
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
  if (params.trace.pendingToolAllowed === false) {
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
  const diagnosticInstanceId = randomUUID();
  const diagnosticStartedAt = new Date().toISOString();
  const diagnosticDirectory = path.join(stateDir, "sg-workspace-diagnostics");
  const diagnosticFile = path.join(
    diagnosticDirectory,
    `wsp3-${Date.now()}-${process.pid}-${diagnosticInstanceId}.json`,
  );
  const durableEvents: DurableDiagnosticEvent[] = [];
  let durableWriteQueue: Promise<void> = Promise.resolve();
  const recordDurableDiagnostic = (params: {
    stage: DurableDiagnosticStage;
    sessionKey?: string;
    routeKey?: string;
    runId?: string;
    result: string;
  }): Promise<void> => {
    durableWriteQueue = durableWriteQueue
      .then(async () => {
        durableEvents.push({
          version: 1,
          instanceId: diagnosticInstanceId,
          pid: process.pid,
          startedAt: diagnosticStartedAt,
          recordedAt: new Date().toISOString(),
          stage: params.stage,
          sessionHash: traceIdFor(params.sessionKey),
          routeHash: traceIdFor(params.routeKey),
          runHash: traceIdFor(params.runId),
          result: params.result,
        });
        if (durableEvents.length > MAX_DURABLE_EVENTS) {
          durableEvents.shift();
        }
        await mkdir(diagnosticDirectory, { recursive: true });
        const temporaryFile = `${diagnosticFile}.tmp`;
        await writeFile(temporaryFile, JSON.stringify(durableEvents), "utf8");
        await rename(temporaryFile, diagnosticFile);
      })
      .catch((error: unknown) => {
        api.logger?.warn(`[sg-wsp3-diag] durable-write-failed error=${String(error)}`);
      });
    return durableWriteQueue;
  };
  const readDurableDiagnostics = async (): Promise<DurableDiagnosticEvent[]> => {
    await durableWriteQueue;
    try {
      const files = (await readdir(diagnosticDirectory))
        .filter((file) => file.startsWith("wsp3-") && file.endsWith(".json"))
        .toSorted()
        .toReversed()
        .slice(0, MAX_DURABLE_INSTANCES);
      const snapshots = await Promise.all(
        files.map(async (file) => {
          try {
            const parsed: unknown = JSON.parse(
              await readFile(path.join(diagnosticDirectory, file), "utf8"),
            );
            return Array.isArray(parsed)
              ? parsed.filter(
                  (event): event is DurableDiagnosticEvent =>
                    Boolean(event) &&
                    typeof event === "object" &&
                    (event as { version?: unknown }).version === 1 &&
                    typeof (event as { stage?: unknown }).stage === "string",
                )
              : [];
          } catch {
            return [];
          }
        }),
      );
      return snapshots.flat();
    } catch {
      return [];
    }
  };
  void recordDurableDiagnostic({ stage: "plugin-loaded", result: "ok" });
  const registry = new SgWorkspaceRegistry(stateDir);
  const requests = new SgWorkspaceRequestRegistry(stateDir);
  const diagnosticTraces: Wsp3DiagnosticTrace[] = [];
  const hookCounts: DiagnosticHookCounts = {
    prompt: 0,
    model: 0,
    toolSelected: 0,
    toolResult: 0,
    reply: 0,
  };
  let diagnosticSequence = 0;
  const updateDiagnostic = (
    identity: { sessionKey?: string; routeKey?: string },
    runId: string | undefined,
    update: (trace: Wsp3DiagnosticTrace) => void,
  ) => {
    if (!identity.sessionKey && !identity.routeKey && !runId) {
      return;
    }
    let current = diagnosticTraces
      .toReversed()
      .find(
        (candidate) =>
          (runId && candidate.runId === runId) ||
          (identity.sessionKey && candidate.sessionKey === identity.sessionKey) ||
          (identity.routeKey && candidate.routeKey === identity.routeKey),
      );
    if (!current || (runId && current.runId && current.runId !== runId)) {
      current = newDiagnosticTrace(runId, ++diagnosticSequence);
      diagnosticTraces.push(current);
      if (diagnosticTraces.length > MAX_DIAGNOSTIC_SESSIONS) {
        diagnosticTraces.shift();
      }
    }
    current.runId ??= runId;
    current.sessionKey ??= identity.sessionKey;
    current.routeKey ??= identity.routeKey;
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
  api.on("before_prompt_build", async (_event, ctx) => {
    hookCounts.prompt += 1;
    const routeKey = normalizedRouteKey({
      channel: ctx.channel ?? ctx.messageProvider,
      accountId: ctx.accountId,
      senderId: ctx.senderId,
    });
    updateDiagnostic(
      {
        sessionKey: ctx.sessionKey,
        routeKey,
      },
      ctx.runId,
      (current) => {
        current.promptHook = true;
        current.pendingToolAllowed = undefined;
      },
    );
    await recordDurableDiagnostic({
      stage: "prompt-hook",
      sessionKey: ctx.sessionKey,
      routeKey,
      runId: ctx.runId,
      result: "guidance-injected",
    });
    diagnosticLog(ctx.sessionKey, ctx.runId, "prompt-hook", "guidance-injected");
    return { prependSystemContext: WSP3_AGENT_GUIDANCE };
  });
  api.on("model_call_started", async (event, ctx) => {
    hookCounts.model += 1;
    const runId = ctx.runId ?? event.runId;
    const sessionKey = ctx.sessionKey ?? event.sessionKey;
    const routeKey = normalizedRouteKey({
      channel: ctx.channel ?? ctx.messageProvider,
      accountId: ctx.accountId,
      senderId: ctx.senderId,
    });
    updateDiagnostic(
      {
        sessionKey,
        routeKey,
      },
      runId,
      (current) => {
        current.modelCalls += 1;
      },
    );
    await recordDurableDiagnostic({
      stage: "model-call",
      sessionKey,
      routeKey,
      runId,
      result: "started",
    });
    diagnosticLog(sessionKey, runId, "model-call", "started");
  });
  api.on(
    "before_tool_call",
    async (event, ctx) => {
      hookCounts.toolSelected += 1;
      const runId = ctx.runId ?? event.runId;
      const routeKey = normalizedRouteKey(ctx.requester ?? {});
      updateDiagnostic(
        {
          sessionKey: ctx.sessionKey,
          routeKey,
        },
        runId,
        (current) => {
          current.pendingToolSelected = true;
        },
      );
      await recordDurableDiagnostic({
        stage: "pending-tool-selected",
        sessionKey: ctx.sessionKey,
        routeKey,
        runId,
        result: "selected",
      });
      diagnosticLog(ctx.sessionKey, runId, "pending-tool", "selected");
    },
    { matcher: [PENDING_TOOL] },
  );
  api.on(
    "after_tool_call",
    async (event, ctx) => {
      hookCounts.toolResult += 1;
      const runId = ctx.runId ?? event.runId;
      const routeKey = normalizedRouteKey(ctx.requester ?? {});
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
      updateDiagnostic(
        {
          sessionKey: ctx.sessionKey,
          routeKey,
        },
        runId,
        (current) => {
          current.pendingToolCompleted = !event.error;
          current.pendingToolResultReadable = resultReadable;
          current.pendingToolResultStatus =
            typeof details?.status === "string" ? details.status : undefined;
          current.pendingToolResultCount = Array.isArray(details?.requests)
            ? details.requests.length
            : undefined;
          current.toolError = event.error;
        },
      );
      await recordDurableDiagnostic({
        stage: "pending-tool-result",
        sessionKey: ctx.sessionKey,
        routeKey,
        runId,
        result: event.error
          ? "execution-error"
          : resultReadable
            ? `${String(details?.status)}:${Array.isArray(details?.requests) ? details.requests.length : 0}`
            : "invalid-payload",
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
  api.on("before_agent_reply", async (event, ctx) => {
    hookCounts.reply += 1;
    const routeKey = normalizedRouteKey({
      channel: ctx.channel ?? ctx.messageProvider,
      accountId: ctx.accountId,
      senderId: ctx.senderId,
    });
    updateDiagnostic(
      {
        sessionKey: ctx.sessionKey,
        routeKey,
      },
      ctx.runId,
      (current) => {
        current.finalReply = Boolean(event.cleanedBody.trim());
      },
    );
    await recordDurableDiagnostic({
      stage: "final-reply",
      sessionKey: ctx.sessionKey,
      routeKey,
      runId: ctx.runId,
      result: event.cleanedBody.trim() ? "present" : "empty",
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
      const commandRouteKey = normalizedRouteKey(ctx);
      await recordDurableDiagnostic({
        stage: "diagnostic-command",
        sessionKey: ctx.sessionKey,
        routeKey: commandRouteKey,
        result: "started",
      });
      const durableSnapshot = await readDurableDiagnostics();
      const durableWindowStart = Date.now() - 10 * 60 * 1000;
      const recentDurableEvents = durableSnapshot.filter(
        (event) => Date.parse(event.recordedAt) >= durableWindowStart,
      );
      const durableHookEvents = recentDurableEvents.filter(
        (event) => event.stage !== "plugin-loaded" && event.stage !== "diagnostic-command",
      );
      const durableHookCounts = {
        prompt: durableHookEvents.filter((event) => event.stage === "prompt-hook").length,
        model: durableHookEvents.filter((event) => event.stage === "model-call").length,
        toolSelected: durableHookEvents.filter((event) => event.stage === "pending-tool-selected")
          .length,
        toolResult: durableHookEvents.filter((event) => event.stage === "pending-tool-result")
          .length,
        reply: durableHookEvents.filter((event) => event.stage === "final-reply").length,
      };
      const durableInstances = new Set(recentDurableEvents.map((event) => event.instanceId));
      const durablePids = new Set(recentDurableEvents.map((event) => event.pid));
      const currentInstanceHookCount = durableHookEvents.filter(
        (event) => event.instanceId === diagnosticInstanceId,
      ).length;
      const otherInstanceHookCount = durableHookEvents.length - currentInstanceHookCount;
      const durableHookLocation =
        currentInstanceHookCount > 0 && otherInstanceHookCount > 0
          ? "mixed"
          : otherInstanceHookCount > 0
            ? "other-instance"
            : currentInstanceHookCount > 0
              ? "current-instance"
              : "none";
      const sessionTrace = ctx.sessionKey
        ? diagnosticTraces.toReversed().find((candidate) => candidate.sessionKey === ctx.sessionKey)
        : undefined;
      const routeTrace = commandRouteKey
        ? diagnosticTraces.toReversed().find((candidate) => candidate.routeKey === commandRouteKey)
        : undefined;
      const lastTrace = sessionTrace ?? routeTrace;
      const traceMatch = sessionTrace ? "session" : routeTrace ? "route" : "none";
      const latestObservedTrace = diagnosticTraces.at(-1);
      const pendingTitles = pending
        .map((request) => request.title.replace(/\s+/g, " ").trim())
        .slice(0, 5);
      let failure = diagnosticFailure({
        trace: lastTrace,
        projectRole: actor.projectRole,
        pendingCount: pending.length,
        storeError,
      });
      const observedHookCount = Object.values(hookCounts).reduce((sum, count) => sum + count, 0);
      if (!lastTrace && observedHookCount === 0) {
        failure =
          otherInstanceHookCount > 0
            ? "lifecycle_hooks_observed_other_instance"
            : currentInstanceHookCount > 0
              ? "lifecycle_memory_trace_lost"
              : "lifecycle_hooks_not_observed";
      } else if (!lastTrace && latestObservedTrace) {
        failure = "trace_identity_mismatch";
      }
      diagnosticLog(ctx.sessionKey, lastTrace?.runId, "summary", failure);
      const traceStatus = (value: boolean | undefined) =>
        value === undefined ? "UNKNOWN" : value ? "OK" : "FAIL";
      return {
        text: [
          "WSP3 DIAG",
          "plugin_loader: OK",
          `identity: OK (${actor.projectRole})`,
          `trace_match: ${traceMatch}`,
          `command_session: ${traceIdFor(ctx.sessionKey)}`,
          `command_route: ${traceIdFor(commandRouteKey)}`,
          `last_trace: ${latestObservedTrace ? `PRESENT (session=${traceIdFor(latestObservedTrace.sessionKey)}, route=${traceIdFor(latestObservedTrace.routeKey)}, run=${traceIdFor(latestObservedTrace.runId)})` : "NONE"}`,
          `hook_counts: prompt=${hookCounts.prompt}, model=${hookCounts.model}, tool_selected=${hookCounts.toolSelected}, tool_result=${hookCounts.toolResult}, reply=${hookCounts.reply}`,
          `durable_trace: ${recentDurableEvents.length > 0 ? "OK" : "FAIL"}`,
          `durable_instances: ${durableInstances.size}, pids=${durablePids.size}`,
          `durable_hook_location: ${durableHookLocation}`,
          `durable_hook_counts: prompt=${durableHookCounts.prompt}, model=${durableHookCounts.model}, tool_selected=${durableHookCounts.toolSelected}, tool_result=${durableHookCounts.toolResult}, reply=${durableHookCounts.reply}`,
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
