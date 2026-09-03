import type { OpenClawPluginApi } from "openclaw/plugin-sdk/plugin-entry";

type LifecycleApi = Pick<OpenClawPluginApi, "on"> & {
  logger?: { info(message: string): void; warn(message: string): void };
};

type Wsp6NativeTool = "message";

type PendingWsp6Action = {
  sessionKey: string;
  toolName: Wsp6NativeTool;
  params: Record<string, unknown>;
  purpose: "first-question" | "next-question" | "private-result";
  successReply?: string;
};

export type Wsp6LifecycleSnapshot = {
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

function toolSucceeded(result: unknown, error: string | undefined): boolean {
  if (error) {
    return false;
  }
  if (!result || typeof result !== "object") {
    return true;
  }
  const details = (result as { details?: unknown }).details;
  if (!details || typeof details !== "object") {
    return true;
  }
  const record = details as Record<string, unknown>;
  if (record.ok === false || record.success === false) {
    return false;
  }
  if (record.pollAnswerRouting === "unavailable") {
    return false;
  }
  return !["error", "failed", "denied", "no_answer"].includes(
    typeof record.status === "string" ? record.status.toLowerCase() : "",
  );
}

export class Wsp6NativeLifecycle {
  private readonly pending = new Map<string, PendingWsp6Action>();
  private readonly safeReplies = new Map<string, string>();
  private readonly counters = { queued: 0, blocked: 0, succeeded: 0, failed: 0 };

  constructor(private readonly logger?: LifecycleApi["logger"]) {}

  assertSessionAvailable(sessionKey: string | undefined): asserts sessionKey is string {
    if (!sessionKey?.trim()) {
      throw new Error("sg-test-session-context-required");
    }
    if (this.pending.has(sessionKey.trim())) {
      throw new Error("sg-test-native-action-pending");
    }
  }

  queue(input: PendingWsp6Action): void {
    this.assertSessionAvailable(input.sessionKey);
    this.pending.set(input.sessionKey.trim(), input);
    this.counters.queued += 1;
    this.logger?.info(
      `[sg-wsp6] stage=native-queued tool=${input.toolName} purpose=${input.purpose}`,
    );
  }

  snapshot(): Wsp6LifecycleSnapshot {
    return { pending: this.pending.size, ...this.counters };
  }

  register(api: LifecycleApi): void {
    api.on(
      "before_tool_call",
      (event, ctx) => {
        const sessionKey = ctx.sessionKey?.trim();
        const pending = sessionKey ? this.pending.get(sessionKey) : undefined;
        if (!pending || event.toolName !== pending.toolName) {
          return;
        }
        if (sameParams(event.params, pending.params)) {
          return;
        }
        this.counters.blocked += 1;
        return {
          block: true,
          blockReason:
            "WSP6 заблокировал изменённый вопрос или адрес. Используй nextAction без изменений.",
        };
      },
      { matcher: ["message"] },
    );
    api.on(
      "after_tool_call",
      (event, ctx) => {
        const sessionKey = ctx.sessionKey?.trim();
        const pending = sessionKey ? this.pending.get(sessionKey) : undefined;
        if (!pending || event.toolName !== pending.toolName) {
          return;
        }
        this.pending.delete(sessionKey as string);
        const success = toolSucceeded(event.result, event.error);
        this.counters[success ? "succeeded" : "failed"] += 1;
        this.safeReplies.set(
          sessionKey as string,
          success
            ? (pending.successReply ?? "Готово.")
            : "Не удалось отправить личный вопрос или результат. Откройте личный чат с SG и продолжите тест там.",
        );
      },
      { matcher: ["message"] },
    );
    api.on("before_agent_reply", (_event, ctx) => {
      const sessionKey = ctx.sessionKey?.trim();
      if (!sessionKey) {
        return;
      }
      const pending = this.pending.get(sessionKey);
      if (pending) {
        this.pending.delete(sessionKey);
        this.counters.failed += 1;
        return {
          handled: true,
          reply: {
            text: "Не удалось открыть следующий шаг теста. Попробуйте продолжить тест ещё раз.",
          },
          reason: "sg-wsp6-native-action-not-executed",
        };
      }
      const safeReply = this.safeReplies.get(sessionKey);
      if (!safeReply) {
        return;
      }
      this.safeReplies.delete(sessionKey);
      return {
        handled: true,
        reply: { text: safeReply },
        reason: "sg-wsp6-private-delivery-protected",
      };
    });
  }
}
