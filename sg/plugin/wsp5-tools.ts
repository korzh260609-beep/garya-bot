import { jsonResult } from "openclaw/plugin-sdk/tool-results";
import {
  sameContentScope,
  SgContentRegistry,
  type SgContentDraft,
  type SgContentMediaReference,
  type SgContentNativeOperation,
  type SgContentScope,
} from "./content-registry.js";
import { resolveWorkspaceContext } from "./context.js";
import { SgWorkspaceRegistry, type SgResourceScope } from "./workspace-registry.js";
import {
  buildWsp5MessageAction,
  buildWsp5ScheduleAdd,
  buildWsp5ScheduleRemove,
  buildWsp5ScheduleUpdate,
  Wsp5NativeLifecycle,
  type Wsp5DeliveryTarget,
} from "./wsp5-lifecycle.js";

type ToolContext = {
  config?: { session?: { identityLinks?: Record<string, string[]> } };
  messageChannel?: string;
  agentAccountId?: string;
  nativeChannelId?: string;
  requesterSenderId?: string;
  sessionKey?: string;
  deliveryContext?: { threadId?: string | number };
};

type AgentTool = {
  name: string;
  label: string;
  description: string;
  parameters: Record<string, unknown>;
  execute(
    toolCallId: string,
    params: Record<string, unknown>,
  ): Promise<ReturnType<typeof jsonResult>>;
};

type Wsp5Actor = {
  globalId: string;
  scope: SgContentScope;
  target: Wsp5DeliveryTarget;
};

const mediaSchema = {
  type: "array",
  maxItems: 10,
  items: {
    type: "object",
    additionalProperties: false,
    properties: {
      media: { type: "string", minLength: 1 },
      type: { type: "string", enum: ["image", "audio", "video", "file"] },
      name: { type: "string", minLength: 1 },
      mimeType: { type: "string", minLength: 1 },
    },
    required: ["media"],
  },
} as const;

function textParam(params: Record<string, unknown>, key: string): string {
  const value = params[key];
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`sg-wsp5-tool-${key}-required`);
  }
  return value.trim();
}

function mediaParam(value: unknown): SgContentMediaReference[] | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!Array.isArray(value) || value.length > 10) {
    throw new Error("sg-content-media-invalid");
  }
  return value.map((raw) => {
    if (!raw || typeof raw !== "object") {
      throw new Error("sg-content-media-invalid");
    }
    const item = raw as Record<string, unknown>;
    const media = typeof item.media === "string" ? item.media.trim() : "";
    if (!media) {
      throw new Error("sg-content-media-invalid");
    }
    const type =
      typeof item.type === "string" && ["image", "audio", "video", "file"].includes(item.type)
        ? (item.type as "image" | "audio" | "video" | "file")
        : undefined;
    return {
      media,
      ...(type ? { type } : {}),
      ...(typeof item.name === "string" && item.name.trim() ? { name: item.name.trim() } : {}),
      ...(typeof item.mimeType === "string" && item.mimeType.trim()
        ? { mimeType: item.mimeType.trim() }
        : {}),
    };
  });
}

async function actorContext(ctx: ToolContext, stateDir: string) {
  return resolveWorkspaceContext(
    {
      channel: ctx.messageChannel ?? "",
      accountId: ctx.agentAccountId,
      to: ctx.nativeChannelId,
      messageThreadId: ctx.deliveryContext?.threadId,
      senderId: ctx.requesterSenderId,
      identityLinks: ctx.config?.session?.identityLinks,
    },
    stateDir,
  );
}

function normalizedRouteId(channel: string, value: string): string {
  const prefix = `${channel.trim().toLowerCase()}:`;
  const normalized = value.trim();
  return normalized.toLowerCase().startsWith(prefix) ? normalized.slice(prefix.length) : normalized;
}

function isPersonalRoute(actor: Awaited<ReturnType<typeof actorContext>>): boolean {
  return Boolean(
    actor.senderId &&
    actor.resourceId &&
    normalizedRouteId(actor.channel, actor.resourceId) ===
      normalizedRouteId(actor.channel, actor.senderId),
  );
}

function resourceTarget(scope: SgResourceScope): Wsp5DeliveryTarget {
  return {
    platform: scope.platform,
    ...(scope.accountId ? { accountId: scope.accountId } : {}),
    resourceId: scope.resourceId,
    ...(scope.topicId ? { topicId: scope.topicId } : {}),
  };
}

async function resolveActor(
  actor: Awaited<ReturnType<typeof actorContext>>,
  scopes: SgWorkspaceRegistry,
): Promise<Wsp5Actor | undefined> {
  if (!actor.globalId) {
    throw new Error("sg-content-citizen-required");
  }
  if (!actor.channel || !actor.resourceId) {
    return undefined;
  }
  if (isPersonalRoute(actor)) {
    return {
      globalId: actor.globalId,
      scope: { kind: "personal", globalId: actor.globalId },
      target: {
        platform: actor.channel,
        ...(actor.accountId ? { accountId: actor.accountId } : {}),
        resourceId: actor.resourceId,
        ...(actor.topicId ? { topicId: actor.topicId } : {}),
      },
    };
  }
  const route = {
    platform: actor.channel,
    ...(actor.accountId ? { accountId: actor.accountId } : {}),
    resourceId: actor.resourceId,
    ...(actor.topicId ? { topicId: actor.topicId } : {}),
  };
  let scope = await scopes.resolve(route);
  if (!scope && actor.topicId) {
    scope = await scopes.register({
      ...route,
      resourceKind: "topic",
      parentResourceId: actor.resourceId,
    });
  }
  return scope
    ? {
        globalId: actor.globalId,
        scope: { kind: "resource", resourceScopeId: scope.resourceScopeId },
        target: resourceTarget(scope),
      }
    : undefined;
}

function draftResult(draft: SgContentDraft) {
  return {
    draftId: draft.draftId,
    scope: draft.scope,
    creatorGlobalId: draft.creatorGlobalId,
    text: draft.text,
    media: draft.media,
    highImpact: draft.highImpact,
    revision: draft.revision,
    editorialStatus: draft.editorialStatus,
    deliveryStatus: draft.deliveryStatus,
    scheduledAt: draft.scheduledAt,
    automationJobId: draft.automationJobId,
    lastError: draft.lastError,
  };
}

async function scopedDraft(
  draftId: string,
  scope: SgContentScope,
  contents: SgContentRegistry,
): Promise<SgContentDraft> {
  const draft = await contents.findDraft(draftId, scope);
  if (!draft) {
    throw new Error("sg-content-draft-not-found");
  }
  return draft;
}

async function dispatchTarget(
  scope: SgContentScope,
  scopes: SgWorkspaceRegistry,
): Promise<Wsp5DeliveryTarget> {
  if (scope.kind !== "resource") {
    throw new Error("sg-content-resource-scope-required");
  }
  const resource = await scopes.findScopeById(scope.resourceScopeId);
  if (!resource) {
    throw new Error("sg-content-resource-scope-not-found");
  }
  return resourceTarget(resource);
}

async function failQueuedOperation(
  contents: SgContentRegistry,
  operation: SgContentNativeOperation,
  actorGlobalId: string,
  target: Wsp5DeliveryTarget | undefined,
  error: unknown,
): Promise<void> {
  await contents.finishNative({
    operation,
    success: false,
    actorGlobalId,
    ...(target
      ? {
          platform: target.platform,
          target: target.resourceId,
          ...(target.topicId ? { topicId: target.topicId } : {}),
        }
      : {}),
    error: error instanceof Error ? error.message : String(error),
  });
}

export function createWsp5Tools(
  ctx: ToolContext,
  stateDir: string,
  lifecycle: Wsp5NativeLifecycle,
): AgentTool[] {
  const contents = new SgContentRegistry(stateDir);
  const workspaces = new SgWorkspaceRegistry(stateDir);
  return [
    {
      name: "sg_content_draft",
      label: "Черновики публикаций SG",
      description:
        "Создаёт, редактирует, отправляет на согласование и показывает собственные черновики в текущем личном или общем контексте. Контекст определяется только текущим доверенным маршрутом.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          action: { type: "string", enum: ["create", "update", "submit", "get", "list"] },
          draftId: { type: "string", minLength: 1 },
          text: { type: "string" },
          media: mediaSchema,
          highImpact: { type: "boolean" },
        },
        required: ["action"],
      },
      async execute(_toolCallId, params) {
        try {
          const action = textParam(params, "action");
          const actorContextValue = await actorContext(ctx, stateDir);
          const actor = await resolveActor(actorContextValue, workspaces);
          if (!actor) {
            return jsonResult({ status: "unavailable", reason: "content-scope-not-found" });
          }
          if (action === "create" || action === "list") {
            if (action === "create") {
              const draft = await contents.create({
                scope: actor.scope,
                creatorGlobalId: actor.globalId,
                ...(typeof params.text === "string" ? { text: params.text } : {}),
                media: mediaParam(params.media) ?? [],
                highImpact: params.highImpact === true,
              });
              return jsonResult({ status: "created", draft: draftResult(draft) });
            }
            const snapshot = await contents.snapshot();
            const drafts = snapshot.drafts.filter(
              (draft) =>
                sameContentScope(draft.scope, actor.scope) &&
                draft.creatorGlobalId === actor.globalId,
            );
            return jsonResult({ status: "ok", drafts: drafts.map(draftResult) });
          }
          const draft = await scopedDraft(textParam(params, "draftId"), actor.scope, contents);
          if (action === "get") {
            if (draft.creatorGlobalId !== actor.globalId) {
              throw new Error("sg-content-own-draft-required");
            }
            return jsonResult({ status: "ok", draft: draftResult(draft) });
          }
          if (action === "submit") {
            const updated = await contents.submit(draft.draftId, actor.scope, actor.globalId);
            return jsonResult({ status: "pending", draft: draftResult(updated) });
          }
          if (action !== "update") {
            throw new Error("sg-content-draft-action-invalid");
          }
          const updated = await contents.update({
            draftId: draft.draftId,
            scope: actor.scope,
            actorGlobalId: actor.globalId,
            ...(typeof params.text === "string" ? { text: params.text } : {}),
            ...(params.media !== undefined ? { media: mediaParam(params.media) } : {}),
            ...(typeof params.highImpact === "boolean" ? { highImpact: params.highImpact } : {}),
          });
          return jsonResult({ status: "updated", draft: draftResult(updated) });
        } catch (error) {
          return jsonResult({
            status: "denied",
            reason: error instanceof Error ? error.message : String(error),
          });
        }
      },
    },
    {
      name: "sg_content_review",
      label: "Согласование публикации SG",
      description: "Одобряет или отклоняет ожидающий черновик. Доступно монарху.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          draftId: { type: "string", minLength: 1 },
          decision: { type: "string", enum: ["approve", "reject"] },
        },
        required: ["draftId", "decision"],
      },
      async execute(_toolCallId, params) {
        try {
          const actor = await resolveActor(await actorContext(ctx, stateDir), workspaces);
          if (!actor) {
            throw new Error("sg-content-scope-not-found");
          }
          const draft = await scopedDraft(textParam(params, "draftId"), actor.scope, contents);
          const decision = textParam(params, "decision");
          if (decision !== "approve" && decision !== "reject") {
            throw new Error("sg-content-review-decision-invalid");
          }
          const updated = await contents.review({
            draftId: draft.draftId,
            scope: actor.scope,
            actorGlobalId: actor.globalId,
            decision,
          });
          return jsonResult({ status: updated.editorialStatus, draft: draftResult(updated) });
        } catch (error) {
          return jsonResult({
            status: "denied",
            reason: error instanceof Error ? error.message : String(error),
          });
        }
      },
    },
    {
      name: "sg_content_publish",
      label: "Опубликовать материал SG сейчас",
      description:
        "Проверяет Global ID внутри инструмента и готовит черновик к немедленной публикации. Прямая команда монарха одновременно означает редакционное одобрение: вызывай инструмент сразу и не проси повторного согласования. Никогда не сравнивай транспортный sender ID с Global ID самостоятельно. После успешного результата обязательно выполни nextAction штатным message без любых изменений.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: { draftId: { type: "string", minLength: 1 } },
        required: ["draftId"],
      },
      async execute(_toolCallId, params) {
        let operation: SgContentNativeOperation | undefined;
        let actor: Wsp5Actor | undefined;
        try {
          lifecycle.assertSessionAvailable(ctx.sessionKey);
          actor = await resolveActor(await actorContext(ctx, stateDir), workspaces);
          if (!actor) {
            throw new Error("sg-content-scope-not-found");
          }
          const current = await scopedDraft(textParam(params, "draftId"), actor.scope, contents);
          operation = await contents.beginPublish(
            current.draftId,
            actor.scope,
            actor.globalId,
            true,
          );
          const draft = await contents.findDraft(current.draftId, actor.scope);
          if (!draft) {
            throw new Error("sg-content-draft-not-found");
          }
          const nextAction = buildWsp5MessageAction(draft, actor.target);
          lifecycle.queue({
            sessionKey: ctx.sessionKey,
            actorGlobalId: actor.globalId,
            operation,
            toolName: "message",
            params: nextAction,
            requireApproval: draft.highImpact,
            target: actor.target,
          });
          return jsonResult({
            status: "native_action_required",
            draftId: draft.draftId,
            nextTool: "message",
            nextAction,
          });
        } catch (error) {
          if (operation && actor) {
            await failQueuedOperation(contents, operation, actor.globalId, actor.target, error);
          }
          return jsonResult({
            status: "denied",
            reason: error instanceof Error ? error.message : String(error),
          });
        }
      },
    },
    {
      name: "sg_content_schedule",
      label: "Расписание публикации SG",
      description:
        "Создаёт, переносит или отменяет расписание одобренного черновика. После успешного результата обязательно выполни nextAction штатным automations без изменений.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          action: { type: "string", enum: ["schedule", "reschedule", "cancel"] },
          draftId: { type: "string", minLength: 1 },
          at: { type: "string", minLength: 1 },
        },
        required: ["action", "draftId"],
      },
      async execute(_toolCallId, params) {
        let operation: SgContentNativeOperation | undefined;
        let actor: Wsp5Actor | undefined;
        try {
          lifecycle.assertSessionAvailable(ctx.sessionKey);
          actor = await resolveActor(await actorContext(ctx, stateDir), workspaces);
          if (!actor) {
            throw new Error("sg-content-scope-not-found");
          }
          if (actor.scope.kind !== "resource") {
            throw new Error("sg-content-resource-scope-required");
          }
          const draft = await scopedDraft(textParam(params, "draftId"), actor.scope, contents);
          const action = textParam(params, "action");
          let nextAction: Record<string, unknown>;
          if (action === "schedule") {
            const begun = await contents.beginSchedule({
              draftId: draft.draftId,
              scope: actor.scope,
              actorGlobalId: actor.globalId,
              at: textParam(params, "at"),
            });
            operation = begun.operation;
            const scheduling = await contents.findDraft(draft.draftId, actor.scope);
            if (!scheduling) {
              throw new Error("sg-content-draft-not-found");
            }
            nextAction = buildWsp5ScheduleAdd(scheduling, begun.dispatchToken);
          } else if (action === "reschedule") {
            const begun = await contents.beginReschedule({
              draftId: draft.draftId,
              scope: actor.scope,
              actorGlobalId: actor.globalId,
              at: textParam(params, "at"),
            });
            operation = begun.operation;
            const scheduling = await contents.findDraft(draft.draftId, actor.scope);
            if (!scheduling?.pendingScheduledAt) {
              throw new Error("sg-content-pending-schedule-missing");
            }
            nextAction = buildWsp5ScheduleUpdate(begun.jobId, scheduling.pendingScheduledAt);
          } else if (action === "cancel") {
            const begun = await contents.beginCancel(draft.draftId, actor.scope, actor.globalId);
            operation = begun.operation;
            nextAction = buildWsp5ScheduleRemove(begun.jobId);
          } else {
            throw new Error("sg-content-schedule-action-invalid");
          }
          lifecycle.queue({
            sessionKey: ctx.sessionKey,
            actorGlobalId: actor.globalId,
            operation,
            toolName: "automations",
            params: nextAction,
            requireApproval: action !== "cancel" && draft.highImpact,
            target: actor.target,
          });
          return jsonResult({
            status: "native_action_required",
            draftId: draft.draftId,
            nextTool: "automations",
            nextAction,
          });
        } catch (error) {
          if (operation && actor) {
            await failQueuedOperation(contents, operation, actor.globalId, actor.target, error);
          }
          return jsonResult({
            status: "denied",
            reason: error instanceof Error ? error.message : String(error),
          });
        }
      },
    },
    {
      name: "sg_content_dispatch",
      label: "Выполнение запланированной публикации SG",
      description:
        "Внутренний одноразовый шаг штатной automation. Используй только из запланированного задания с выданными draftId и dispatchToken; затем выполни nextAction штатным message без изменений.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          draftId: { type: "string", minLength: 1 },
          dispatchToken: { type: "string", minLength: 1 },
        },
        required: ["draftId", "dispatchToken"],
      },
      async execute(_toolCallId, params) {
        let operation: SgContentNativeOperation | undefined;
        let target: Wsp5DeliveryTarget | undefined;
        try {
          if (ctx.requesterSenderId) {
            throw new Error("sg-content-dispatch-automation-only");
          }
          lifecycle.assertSessionAvailable(ctx.sessionKey);
          const begun = await contents.beginScheduledDispatch(
            textParam(params, "draftId"),
            textParam(params, "dispatchToken"),
          );
          operation = begun.operation;
          target = await dispatchTarget(begun.draft.scope, workspaces);
          const nextAction = buildWsp5MessageAction(begun.draft, target);
          lifecycle.queue({
            sessionKey: ctx.sessionKey,
            actorGlobalId: "system:automation",
            operation,
            toolName: "message",
            params: nextAction,
            requireApproval: false,
            target,
          });
          return jsonResult({
            status: "native_action_required",
            draftId: begun.draft.draftId,
            nextTool: "message",
            nextAction,
          });
        } catch (error) {
          if (operation) {
            await failQueuedOperation(contents, operation, "system:automation", target, error);
          }
          return jsonResult({
            status: "denied",
            reason: error instanceof Error ? error.message : String(error),
          });
        }
      },
    },
  ];
}

export const WSP5_AGENT_GUIDANCE = [
  "WSP5 хранит черновики и редакционные статусы, но не отправляет сообщения и не запускает собственный планировщик.",
  "Citizen создаёт, редактирует и отправляет на согласование только свои черновики через sg_content_draft.",
  "Прямая команда монарха опубликовать черновик уже является редакционным одобрением: сразу вызывай sg_content_publish и не спрашивай дополнительного согласия.",
  "Текущий личный или общий scope SG определяет только из доверенного маршрута; не запрашивай и не передавай идентификатор scope.",
  "Доступ к управляющим WSP5-инструментам задаёт штатная sender-specific policy OpenClaw; не сравнивай sender ID канала с Global ID самостоятельно.",
  "Для отдельного согласования без публикации монарх использует sg_content_review; расписание создаётся через sg_content_schedule после одобрения.",
  "После статуса native_action_required обязательно вызови указанный nextTool с nextAction без единого изменения.",
  "Немедленная и запланированная отправка выполняется только штатным message; расписание, перенос и отмена — только штатным automations.",
  "Не сообщай об успехе до успешного результата штатного действия. Ошибка штатного инструмента означает ошибку публикации.",
].join("\n");
