import type { OpenClawPluginApi } from "openclaw/plugin-sdk/plugin-entry";
import {
  SgContentRegistry,
  type SgContentDraft,
  type SgContentNativeOperation,
} from "./content-registry.js";

type LifecycleApi = Pick<OpenClawPluginApi, "on"> & {
  logger?: { info(message: string): void; warn(message: string): void };
};

type PendingNativeAction = {
  sessionKey: string;
  actorGlobalId: string;
  operation: SgContentNativeOperation;
  toolName: "message" | "automations";
  params: Record<string, unknown>;
  requireApproval: boolean;
  target: Wsp5DeliveryTarget;
};

export type Wsp5DeliveryTarget = {
  platform: string;
  accountId?: string;
  resourceId: string;
  topicId?: string;
};

export type Wsp5LifecycleSnapshot = {
  pending: number;
  queued: number;
  blocked: number;
  succeeded: number;
  failed: number;
};

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonical);
  }
  if (!value || typeof value !== "object") {
    return value;
  }
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .toSorted(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, canonical(item)]),
  );
}

function sameParams(left: Record<string, unknown>, right: Record<string, unknown>): boolean {
  return JSON.stringify(canonical(left)) === JSON.stringify(canonical(right));
}

function canonicalToolName(toolName: string): "message" | "automations" | undefined {
  if (toolName === "message") {
    return "message";
  }
  if (toolName === "automations" || toolName === "cron") {
    return "automations";
  }
  return undefined;
}

function resultDetails(result: unknown): Record<string, unknown> | undefined {
  if (!result || typeof result !== "object") {
    return undefined;
  }
  const details = (result as { details?: unknown }).details;
  return details && typeof details === "object" ? (details as Record<string, unknown>) : undefined;
}

function resultSucceeded(result: unknown, error: string | undefined): boolean {
  if (error) {
    return false;
  }
  const details = resultDetails(result);
  if (!details) {
    return true;
  }
  if (details.ok === false || details.success === false) {
    return false;
  }
  return !["error", "failed", "denied"].includes(
    typeof details.status === "string" ? details.status.toLowerCase() : "",
  );
}

function nativeResultId(result: unknown): string | undefined {
  const details = resultDetails(result);
  if (!details) {
    return undefined;
  }
  const nested =
    details.job && typeof details.job === "object"
      ? (details.job as Record<string, unknown>)
      : undefined;
  for (const value of [
    details.messageId,
    details.message_id,
    details.id,
    details.jobId,
    nested?.id,
  ]) {
    if ((typeof value === "string" || typeof value === "number") && String(value).trim()) {
      return String(value).trim();
    }
  }
  return undefined;
}

export function buildWsp5MessageAction(
  draft: SgContentDraft,
  target: Wsp5DeliveryTarget,
): Record<string, unknown> {
  return {
    action: "send",
    channel: target.platform,
    target: target.resourceId,
    ...(target.accountId ? { accountId: target.accountId } : {}),
    ...(target.topicId ? { threadId: target.topicId } : {}),
    ...(draft.text ? { message: draft.text } : {}),
    ...(draft.media.length > 0
      ? {
          attachments: draft.media.map((item) => ({
            ...(item.type ? { type: item.type } : {}),
            media: item.media,
            ...(item.name ? { name: item.name } : {}),
            ...(item.mimeType ? { mimeType: item.mimeType } : {}),
          })),
        }
      : {}),
  };
}

export function buildWsp5ScheduleAdd(
  draft: SgContentDraft,
  dispatchToken: string,
): Record<string, unknown> {
  if (!draft.pendingScheduledAt) {
    throw new Error("sg-content-pending-schedule-missing");
  }
  return {
    action: "add",
    job: {
      name: `SG publication ${draft.draftId}`,
      schedule: { kind: "at", at: draft.pendingScheduledAt },
      payload: {
        kind: "agentTurn",
        message: [
          "Выполни запланированную публикацию SG без изменения текста или адреса.",
          `Сначала вызови sg_content_dispatch с draftId=${JSON.stringify(draft.draftId)} и dispatchToken=${JSON.stringify(dispatchToken)}.`,
          "Затем выполни ровно nextAction из результата через штатный message. Не публикуй ничего другого.",
        ].join(" "),
      },
      sessionTarget: "isolated",
      delivery: { mode: "none" },
      enabled: true,
    },
  };
}

export function buildWsp5ScheduleUpdate(jobId: string, at: string): Record<string, unknown> {
  return { action: "update", jobId, job: { schedule: { kind: "at", at } } };
}

export function buildWsp5ScheduleRemove(jobId: string): Record<string, unknown> {
  return { action: "remove", jobId };
}

export class Wsp5NativeLifecycle {
  private readonly pending = new Map<string, PendingNativeAction>();
  private readonly counters = { queued: 0, blocked: 0, succeeded: 0, failed: 0 };

  constructor(
    private readonly registry: SgContentRegistry,
    private readonly logger?: LifecycleApi["logger"],
  ) {}

  assertSessionAvailable(sessionKey: string | undefined): asserts sessionKey is string {
    if (!sessionKey?.trim()) {
      throw new Error("sg-content-session-context-required");
    }
    if (this.pending.has(sessionKey.trim())) {
      throw new Error("sg-content-native-action-pending");
    }
  }

  queue(input: PendingNativeAction): void {
    this.assertSessionAvailable(input.sessionKey);
    this.pending.set(input.sessionKey, input);
    this.counters.queued += 1;
    this.logger?.info(
      `[sg-wsp5] stage=native-queued kind=${input.operation.kind} draft=${input.operation.draftId}`,
    );
  }

  snapshot(): Wsp5LifecycleSnapshot {
    return { pending: this.pending.size, ...this.counters };
  }

  private async finish(
    pending: PendingNativeAction,
    input: { success: boolean; result?: unknown; error?: string },
  ): Promise<void> {
    const resultId = nativeResultId(input.result);
    const success =
      pending.operation.kind === "schedule" ? input.success && Boolean(resultId) : input.success;
    try {
      await this.registry.finishNative({
        operation: pending.operation,
        success,
        actorGlobalId: pending.actorGlobalId,
        platform: pending.target.platform,
        target: pending.target.resourceId,
        topicId: pending.target.topicId,
        ...(pending.operation.kind === "schedule" ? { automationJobId: resultId } : {}),
        ...(pending.operation.kind === "publish" ? { nativeResultId: resultId } : {}),
        ...(!success ? { error: input.error ?? "native-action-failed" } : {}),
      });
      this.counters[success ? "succeeded" : "failed"] += 1;
    } catch (error) {
      this.counters.failed += 1;
      this.logger?.warn(`[sg-wsp5] stage=native-record-failed error=${String(error)}`);
    }
  }

  register(api: LifecycleApi): void {
    api.on(
      "before_tool_call",
      (event, ctx) => {
        const sessionKey = ctx.sessionKey?.trim();
        const pending = sessionKey ? this.pending.get(sessionKey) : undefined;
        if (!pending || canonicalToolName(event.toolName) !== pending.toolName) {
          return undefined;
        }
        if (!sameParams(event.params, pending.params)) {
          this.counters.blocked += 1;
          return {
            block: true,
            blockReason:
              "WSP5 заблокировал несовпадающее нативное действие. Используй без изменений nextAction из результата SG.",
          };
        }
        if (!pending.requireApproval) {
          return undefined;
        }
        return {
          requireApproval: {
            title: "Подтвердить публикацию SG",
            description: `Публикация ${pending.operation.draftId} в ${pending.target.resourceId}`,
            severity: "warning",
            allowedDecisions: ["allow-once", "deny"],
            pluginId: "sg-workspace-manager",
          },
        };
      },
      { matcher: ["message", "automations", "cron"] },
    );
    api.on(
      "after_tool_call",
      async (event, ctx) => {
        const sessionKey = ctx.sessionKey?.trim();
        const pending = sessionKey ? this.pending.get(sessionKey) : undefined;
        if (!pending || canonicalToolName(event.toolName) !== pending.toolName) {
          return;
        }
        this.pending.delete(sessionKey as string);
        const success = resultSucceeded(event.result, event.error);
        await this.finish(pending, {
          success,
          result: event.result,
          ...(event.error ? { error: event.error } : {}),
        });
      },
      { matcher: ["message", "automations", "cron"] },
    );
    api.on("before_agent_reply", async (_event, ctx) => {
      const sessionKey = ctx.sessionKey?.trim();
      const pending = sessionKey ? this.pending.get(sessionKey) : undefined;
      if (!pending) {
        return;
      }
      this.pending.delete(sessionKey as string);
      await this.finish(pending, { success: false, error: "native-action-not-executed" });
    });
  }
}
