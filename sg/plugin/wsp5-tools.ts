import { jsonResult } from "openclaw/plugin-sdk/tool-results";
import {
  SgContentRegistry,
  type SgContentDraft,
  type SgContentMediaReference,
  type SgContentNativeOperation,
} from "./content-registry.js";
import { resolveWorkspaceContext } from "./context.js";
import { SgWorkspaceRegistry, type SgWorkspace } from "./workspace-registry.js";
import {
  buildWsp5MessageAction,
  buildWsp5ScheduleAdd,
  buildWsp5ScheduleRemove,
  buildWsp5ScheduleUpdate,
  Wsp5NativeLifecycle,
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
  canManage: boolean;
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

async function resolveWorkspace(
  params: Record<string, unknown>,
  actor: Awaited<ReturnType<typeof actorContext>>,
  workspaces: SgWorkspaceRegistry,
): Promise<SgWorkspace | undefined> {
  if (typeof params.workspaceId === "string" && params.workspaceId.trim()) {
    return workspaces.findById(params.workspaceId.trim());
  }
  if (!actor.channel || !actor.resourceId) {
    return undefined;
  }
  return workspaces.resolve({
    platform: actor.channel,
    ...(actor.accountId ? { accountId: actor.accountId } : {}),
    resourceId: actor.resourceId,
    ...(actor.topicId ? { topicId: actor.topicId } : {}),
  });
}

async function authorizedActor(
  actor: Awaited<ReturnType<typeof actorContext>>,
  workspace: SgWorkspace,
): Promise<Wsp5Actor> {
  if (!actor.globalId) {
    throw new Error("sg-content-citizen-required");
  }
  if (workspace.status !== "active") {
    throw new Error("sg-content-workspace-not-active");
  }
  return { globalId: actor.globalId, canManage: actor.projectRole === "monarch" };
}

function requireEditor(actor: Wsp5Actor): void {
  if (!actor.canManage) {
    throw new Error("sg-content-editor-required");
  }
}

function canManage(actor: Wsp5Actor): boolean {
  return actor.canManage;
}

function draftResult(draft: SgContentDraft) {
  return {
    draftId: draft.draftId,
    workspaceId: draft.workspaceId,
    topicId: draft.topicId,
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

async function draftWorkspace(
  draftId: string,
  contents: SgContentRegistry,
  workspaces: SgWorkspaceRegistry,
): Promise<{ draft: SgContentDraft; workspace: SgWorkspace }> {
  const draft = await contents.findDraft(draftId);
  if (!draft) {
    throw new Error("sg-content-draft-not-found");
  }
  const workspace = await workspaces.findById(draft.workspaceId);
  if (!workspace) {
    throw new Error("sg-content-workspace-not-found");
  }
  return { draft, workspace };
}

async function failQueuedOperation(
  contents: SgContentRegistry,
  operation: SgContentNativeOperation,
  actorGlobalId: string,
  workspace: SgWorkspace,
  error: unknown,
): Promise<void> {
  await contents.finishNative({
    operation,
    success: false,
    actorGlobalId,
    platform: workspace.platform,
    target: workspace.resourceId,
    ...(workspace.topicId ? { topicId: workspace.topicId } : {}),
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
        "Создаёт, редактирует, отправляет на согласование и показывает черновики выбранного сообщества. Citizen работает только со своими черновиками; управляющие действия доступны монарху до переноса на штатную sender policy.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          action: { type: "string", enum: ["create", "update", "submit", "get", "list"] },
          workspaceId: { type: "string", minLength: 1 },
          draftId: { type: "string", minLength: 1 },
          text: { type: "string" },
          media: mediaSchema,
          topicId: { type: ["string", "null"] },
          highImpact: { type: "boolean" },
        },
        required: ["action"],
      },
      async execute(_toolCallId, params) {
        try {
          const action = textParam(params, "action");
          const actorContextValue = await actorContext(ctx, stateDir);
          if (action === "create" || action === "list") {
            const workspace = await resolveWorkspace(params, actorContextValue, workspaces);
            if (!workspace) {
              return jsonResult({ status: "unavailable", reason: "workspace-not-found" });
            }
            const actor = await authorizedActor(actorContextValue, workspace);
            if (action === "create") {
              const draft = await contents.create({
                workspaceId: workspace.workspaceId,
                topicId:
                  typeof params.topicId === "string" && params.topicId.trim()
                    ? params.topicId.trim()
                    : workspace.topicId,
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
                draft.workspaceId === workspace.workspaceId &&
                (canManage(actor) || draft.creatorGlobalId === actor.globalId),
            );
            return jsonResult({ status: "ok", drafts: drafts.map(draftResult) });
          }
          const { draft, workspace } = await draftWorkspace(
            textParam(params, "draftId"),
            contents,
            workspaces,
          );
          const actor = await authorizedActor(actorContextValue, workspace);
          if (action === "get") {
            if (!canManage(actor) && draft.creatorGlobalId !== actor.globalId) {
              throw new Error("sg-content-own-draft-required");
            }
            return jsonResult({ status: "ok", draft: draftResult(draft) });
          }
          if (action === "submit") {
            const updated = await contents.submit(draft.draftId, actor.globalId, canManage(actor));
            return jsonResult({ status: "pending", draft: draftResult(updated) });
          }
          if (action !== "update") {
            throw new Error("sg-content-draft-action-invalid");
          }
          const updated = await contents.update({
            draftId: draft.draftId,
            actorGlobalId: actor.globalId,
            canManage: canManage(actor),
            ...(typeof params.text === "string" ? { text: params.text } : {}),
            ...(params.media !== undefined ? { media: mediaParam(params.media) } : {}),
            ...(params.topicId === null || typeof params.topicId === "string"
              ? { topicId: params.topicId }
              : {}),
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
          const { draft, workspace } = await draftWorkspace(
            textParam(params, "draftId"),
            contents,
            workspaces,
          );
          const actor = await authorizedActor(await actorContext(ctx, stateDir), workspace);
          requireEditor(actor);
          const decision = textParam(params, "decision");
          if (decision !== "approve" && decision !== "reject") {
            throw new Error("sg-content-review-decision-invalid");
          }
          const updated = await contents.review({
            draftId: draft.draftId,
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
        let workspace: SgWorkspace | undefined;
        try {
          lifecycle.assertSessionAvailable(ctx.sessionKey);
          const resolved = await draftWorkspace(textParam(params, "draftId"), contents, workspaces);
          workspace = resolved.workspace;
          actor = await authorizedActor(await actorContext(ctx, stateDir), workspace);
          requireEditor(actor);
          operation = await contents.beginPublish(resolved.draft.draftId, actor.globalId, true);
          const draft = await contents.findDraft(resolved.draft.draftId);
          if (!draft) {
            throw new Error("sg-content-draft-not-found");
          }
          const nextAction = buildWsp5MessageAction(draft, workspace);
          lifecycle.queue({
            sessionKey: ctx.sessionKey,
            actorGlobalId: actor.globalId,
            operation,
            toolName: "message",
            params: nextAction,
            requireApproval: draft.highImpact || workspace.settings.protectedPublication === true,
            workspace,
          });
          return jsonResult({
            status: "native_action_required",
            draftId: draft.draftId,
            nextTool: "message",
            nextAction,
          });
        } catch (error) {
          if (operation && actor && workspace) {
            await failQueuedOperation(contents, operation, actor.globalId, workspace, error);
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
        let workspace: SgWorkspace | undefined;
        try {
          lifecycle.assertSessionAvailable(ctx.sessionKey);
          const resolved = await draftWorkspace(textParam(params, "draftId"), contents, workspaces);
          workspace = resolved.workspace;
          actor = await authorizedActor(await actorContext(ctx, stateDir), workspace);
          requireEditor(actor);
          const action = textParam(params, "action");
          let nextAction: Record<string, unknown>;
          if (action === "schedule") {
            const begun = await contents.beginSchedule({
              draftId: resolved.draft.draftId,
              actorGlobalId: actor.globalId,
              at: textParam(params, "at"),
            });
            operation = begun.operation;
            const draft = await contents.findDraft(resolved.draft.draftId);
            if (!draft) {
              throw new Error("sg-content-draft-not-found");
            }
            nextAction = buildWsp5ScheduleAdd(draft, begun.dispatchToken);
          } else if (action === "reschedule") {
            const begun = await contents.beginReschedule({
              draftId: resolved.draft.draftId,
              actorGlobalId: actor.globalId,
              at: textParam(params, "at"),
            });
            operation = begun.operation;
            const draft = await contents.findDraft(resolved.draft.draftId);
            if (!draft?.pendingScheduledAt) {
              throw new Error("sg-content-pending-schedule-missing");
            }
            nextAction = buildWsp5ScheduleUpdate(begun.jobId, draft.pendingScheduledAt);
          } else if (action === "cancel") {
            const begun = await contents.beginCancel(resolved.draft.draftId, actor.globalId);
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
            requireApproval:
              action !== "cancel" &&
              (resolved.draft.highImpact || workspace.settings.protectedPublication === true),
            workspace,
          });
          return jsonResult({
            status: "native_action_required",
            draftId: resolved.draft.draftId,
            nextTool: "automations",
            nextAction,
          });
        } catch (error) {
          if (operation && actor && workspace) {
            await failQueuedOperation(contents, operation, actor.globalId, workspace, error);
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
        let workspace: SgWorkspace | undefined;
        try {
          if (ctx.requesterSenderId) {
            throw new Error("sg-content-dispatch-automation-only");
          }
          lifecycle.assertSessionAvailable(ctx.sessionKey);
          const resolved = await draftWorkspace(textParam(params, "draftId"), contents, workspaces);
          workspace = resolved.workspace;
          operation = await contents.beginScheduledDispatch(
            resolved.draft.draftId,
            textParam(params, "dispatchToken"),
          );
          const draft = await contents.findDraft(resolved.draft.draftId);
          if (!draft) {
            throw new Error("sg-content-draft-not-found");
          }
          const nextAction = buildWsp5MessageAction(draft, workspace);
          lifecycle.queue({
            sessionKey: ctx.sessionKey,
            actorGlobalId: "system:automation",
            operation,
            toolName: "message",
            params: nextAction,
            requireApproval: false,
            workspace,
          });
          return jsonResult({
            status: "native_action_required",
            draftId: draft.draftId,
            nextTool: "message",
            nextAction,
          });
        } catch (error) {
          if (operation && workspace) {
            await failQueuedOperation(contents, operation, "system:automation", workspace, error);
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
  "Global ID и разрешённый управляющий контекст проверяет сам SG-инструмент. Никогда не сравнивай sender ID канала с Global ID и не делай вывод о полномочиях самостоятельно.",
  "Для отдельного согласования без публикации монарх использует sg_content_review; расписание создаётся через sg_content_schedule после одобрения.",
  "После статуса native_action_required обязательно вызови указанный nextTool с nextAction без единого изменения.",
  "Немедленная и запланированная отправка выполняется только штатным message; расписание, перенос и отмена — только штатным automations.",
  "Не сообщай об успехе до успешного результата штатного действия. Ошибка штатного инструмента означает ошибку публикации.",
].join("\n");
