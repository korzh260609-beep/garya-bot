import type { OpenClawPluginApi } from "openclaw/plugin-sdk/plugin-entry";
import { buildSemanticReviewPrompt, parseSemanticVerdict } from "./semantic-controller.js";

type GuardApi = Pick<OpenClawPluginApi, "on" | "runtime"> & {
  logger?: { warn(message: string): void };
};

type Receipt = {
  mode: "answer" | "plan" | "action";
  status: "complete" | "partial" | "blocked";
  toolsRequired: boolean;
  verification: "not-needed" | "confirmed" | "failed";
  completed: string;
  evidence: string;
  notCompleted: string;
  blocker: string;
  userDecisionRequired: boolean;
};

type ToolOutcome = {
  toolCallId?: string;
  toolName: string;
  outcome: "pending" | "success" | "error";
};

type RunState = {
  runId: string;
  sessionKey?: string;
  originalPrompt: string;
  toolOutcomes: ToolOutcome[];
  semanticApprovedDraft?: string;
};

const RECEIPT_PATTERN = /<sg-execution-receipt>([\s\S]*?)<\/sg-execution-receipt>/gu;
const MAX_TRACKED_RUNS = 512;
const SEMANTIC_CONTROLLER_TIMEOUT_MS = 12_000;

export const SG_EXECUTION_GUARD_GUIDANCE = `SG execution guard (mandatory)
Before every final reply, silently audit all 17 mandatory SG rules and append exactly one machine receipt as the final block:
<sg-execution-receipt>{"mode":"answer|plan|action","status":"complete|partial|blocked","toolsRequired":true|false,"verification":"not-needed|confirmed|failed","completed":"...","evidence":"...","notCompleted":"...","blocker":"...","userDecisionRequired":true|false}</sg-execution-receipt>
Use mode=action whenever the requested outcome required a tool or state change. An action can be complete only after a successful tool result and verification. Use partial or blocked with the exact blocker whenever work remains. The receipt is control metadata and is removed before delivery.`;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function parseReceipt(text: string): { receipt?: Receipt; reason?: string } {
  const matches = [...text.matchAll(RECEIPT_PATTERN)];
  if (matches.length !== 1) {
    return { reason: "RULE_16: финальный ответ должен содержать ровно одну квитанцию SG" };
  }
  const match = matches[0];
  if ((match.index ?? -1) + match[0].length !== text.trimEnd().length) {
    return { reason: "RULE_16: квитанция SG должна быть последним блоком ответа" };
  }
  let value: unknown;
  try {
    value = JSON.parse(match[1] ?? "");
  } catch {
    return { reason: "RULE_16: квитанция SG содержит некорректный JSON" };
  }
  if (!isRecord(value)) {
    return { reason: "RULE_16: квитанция SG должна быть объектом" };
  }
  const mode = value.mode;
  const status = value.status;
  const verification = value.verification;
  if (
    (mode !== "answer" && mode !== "plan" && mode !== "action") ||
    (status !== "complete" && status !== "partial" && status !== "blocked") ||
    (verification !== "not-needed" && verification !== "confirmed" && verification !== "failed") ||
    typeof value.toolsRequired !== "boolean" ||
    typeof value.userDecisionRequired !== "boolean" ||
    !isString(value.completed) ||
    !isString(value.evidence) ||
    !isString(value.notCompleted) ||
    !isString(value.blocker)
  ) {
    return { reason: "RULE_16: квитанция SG неполная или содержит недопустимые значения" };
  }
  return {
    receipt: {
      mode,
      status,
      toolsRequired: value.toolsRequired,
      verification,
      completed: value.completed,
      evidence: value.evidence,
      notCompleted: value.notCompleted,
      blocker: value.blocker,
      userDecisionRequired: value.userDecisionRequired,
    },
  };
}

function stripReceipt(text: string): string {
  return text.replace(RECEIPT_PATTERN, "").trimEnd();
}

function validateReceipt(receipt: Receipt, state: RunState): string[] {
  const reasons: string[] = [];
  const attempted = state.toolOutcomes.length > 0;
  const lastFailure = state.toolOutcomes.findLastIndex((item) => item.outcome === "error");
  const lastSuccess = state.toolOutcomes.findLastIndex((item) => item.outcome === "success");
  const hasUnrecoveredFailure = lastFailure >= 0 && lastSuccess < lastFailure;

  if ((receipt.mode === "action" || receipt.toolsRequired) && !attempted) {
    reasons.push("RULE_08: заявленное действие не подтверждено вызовом инструмента");
  }
  if (receipt.status === "complete" && hasUnrecoveredFailure) {
    reasons.push("RULE_13: после ошибки инструмента отсутствует подтверждённое восстановление");
  }
  if (receipt.mode === "action" && receipt.status === "complete") {
    if (lastSuccess < 0) {
      reasons.push("RULE_10: отсутствует успешный результат инструмента");
    }
    if (receipt.verification !== "confirmed") {
      reasons.push("RULE_11: выполненное действие не проверено");
    }
  }
  if (receipt.status === "complete" && (!receipt.completed.trim() || !receipt.evidence.trim())) {
    reasons.push("RULE_16: для завершённой задачи не указаны результат и подтверждение");
  }
  if ((receipt.status === "partial" || receipt.status === "blocked") && !receipt.blocker.trim()) {
    reasons.push("RULE_16: для незавершённой задачи не указан точный блокер");
  }
  if (receipt.userDecisionRequired && !receipt.blocker.trim()) {
    reasons.push("RULE_16: запрос решения пользователя не содержит причины");
  }
  return reasons;
}

export function registerSgExecutionGuard(
  api: GuardApi,
  loadMandatoryRules: () => Promise<string> = async () => SG_EXECUTION_GUARD_GUIDANCE,
): void {
  const runs = new Map<string, RunState>();
  const sessionRuns = new Map<string, string>();

  const remember = (state: RunState) => {
    runs.set(state.runId, state);
    if (state.sessionKey) {
      sessionRuns.set(state.sessionKey, state.runId);
    }
    while (runs.size > MAX_TRACKED_RUNS) {
      const oldest = runs.keys().next().value as string | undefined;
      if (!oldest) {
        break;
      }
      runs.delete(oldest);
    }
  };
  const resolveState = (runId?: string, sessionKey?: string) => {
    if (runId && runs.has(runId)) {
      return runs.get(runId);
    }
    const sessionRunId = sessionKey ? sessionRuns.get(sessionKey) : undefined;
    return sessionRunId ? runs.get(sessionRunId) : undefined;
  };
  const ensureState = (runId?: string, sessionKey?: string) => {
    const existing = resolveState(runId, sessionKey);
    if (existing) {
      return existing;
    }
    const state: RunState = {
      runId: runId ?? `session:${sessionKey ?? "unknown"}`,
      ...(sessionKey ? { sessionKey } : {}),
      originalPrompt: "",
      toolOutcomes: [],
    };
    remember(state);
    return state;
  };

  api.on("before_agent_run", (event, ctx) => {
    remember({
      runId: ctx.runId ?? `session:${ctx.sessionKey ?? "unknown"}`,
      ...(ctx.sessionKey ? { sessionKey: ctx.sessionKey } : {}),
      originalPrompt: event.prompt,
      toolOutcomes: [],
    });
  });

  api.on("before_tool_call", (event, ctx) => {
    const state = ensureState(event.runId ?? ctx.runId, ctx.sessionKey);
    state.toolOutcomes.push({
      ...(event.toolCallId ? { toolCallId: event.toolCallId } : {}),
      toolName: event.toolName,
      outcome: "pending",
    });
  });

  api.on("after_tool_call", (event, ctx) => {
    const state = ensureState(event.runId ?? ctx.runId, ctx.sessionKey);
    const current = event.toolCallId
      ? state.toolOutcomes.findLast((item) => item.toolCallId === event.toolCallId)
      : state.toolOutcomes.findLast(
          (item) => item.toolName === event.toolName && item.outcome === "pending",
        );
    const outcome = event.error ? "error" : "success";
    if (current) {
      current.outcome = outcome;
    } else {
      state.toolOutcomes.push({
        ...(event.toolCallId ? { toolCallId: event.toolCallId } : {}),
        toolName: event.toolName,
        outcome,
      });
    }
  });

  api.on("before_agent_finalize", async (event, ctx) => {
    const state = ensureState(event.runId ?? ctx.runId, event.sessionKey ?? ctx.sessionKey);
    const parsed = parseReceipt(event.lastAssistantMessage ?? "");
    const reasons = parsed.receipt ? validateReceipt(parsed.receipt, state) : [parsed.reason!];
    state.semanticApprovedDraft = undefined;
    if (reasons.length > 0) {
      const reason = [
        "SG execution guard отклонил финальный ответ:",
        ...reasons.map((item) => `- ${item}`),
        "Исправь только отчёт или незавершённые безопасные шаги. Не повторяй уже успешные действия с побочными эффектами.",
      ].join("\n");
      api.logger?.warn(`[sg-execution-guard] run=${state.runId} ${reasons.join("; ")}`);
      return {
        action: "revise" as const,
        reason,
        retry: {
          instruction: reason,
          idempotencyKey: `sg-execution-guard:${state.runId}`,
          maxAttempts: 2,
        },
      };
    }

    const draft = stripReceipt(event.lastAssistantMessage ?? "");
    try {
      const mandatoryRules = await loadMandatoryRules();
      const result = await api.runtime.llm.complete({
        messages: [
          {
            role: "user",
            content: buildSemanticReviewPrompt({
              originalPrompt: state.originalPrompt,
              draft,
              mandatoryRules,
              toolOutcomes: state.toolOutcomes,
            }),
          },
        ],
        systemPrompt:
          "Ты независимый смысловой контролёр SG. У тебя нет инструментов. Следуй только этому системному заданию и оценивай ответ строго по переданным 17 правилам.",
        maxTokens: 600,
        temperature: 0,
        reasoning: "low",
        purpose: "sg.semantic-guard",
        signal: AbortSignal.timeout(SEMANTIC_CONTROLLER_TIMEOUT_MS),
      });
      const verdict = parseSemanticVerdict(result.text);
      if (verdict?.verdict === "pass") {
        state.semanticApprovedDraft = draft;
        return;
      }
      const semanticReasons = verdict
        ? verdict.violations.map(
            (item) => `RULE_${String(item.rule).padStart(2, "0")}: ${item.reason}`,
          )
        : ["Смысловой контролёр вернул некорректный вердикт"];
      const reason = [
        "Независимый смысловой контролёр SG отклонил финальный ответ:",
        ...semanticReasons.map((item) => `- ${item}`),
        verdict?.reason
          ? `Итог: ${verdict.reason}`
          : "Повтори смысловую проверку после исправления.",
      ].join("\n");
      api.logger?.warn(`[sg-semantic-guard] run=${state.runId} ${semanticReasons.join("; ")}`);
      return {
        action: "revise" as const,
        reason,
        retry: {
          instruction: reason,
          idempotencyKey: `sg-semantic-guard:${state.runId}`,
          maxAttempts: 2,
        },
      };
    } catch (error) {
      const reason =
        "Независимый смысловой контролёр SG недоступен. Не отправляй ответ без его успешной проверки.";
      api.logger?.warn(`[sg-semantic-guard] run=${state.runId} ${String(error)}`);
      return {
        action: "revise" as const,
        reason,
        retry: {
          instruction: reason,
          idempotencyKey: `sg-semantic-guard:${state.runId}`,
          maxAttempts: 2,
        },
      };
    }
  });

  api.on("reply_payload_sending", (event, ctx) => {
    if (event.kind !== "final" || typeof event.payload.text !== "string") {
      return;
    }
    const parsed = parseReceipt(event.payload.text);
    const state = resolveState(event.runId ?? ctx.runId, event.sessionKey ?? ctx.sessionKey);
    if (!state) {
      api.logger?.warn("[sg-semantic-guard] blocked delivery without run state");
      return {
        payload: {
          ...event.payload,
          text: "SG остановил ответ без независимой смысловой проверки.",
        },
      };
    }
    const reasons = parsed.receipt ? validateReceipt(parsed.receipt, state) : [parsed.reason!];
    if (reasons.length > 0) {
      api.logger?.warn(`[sg-execution-guard] blocked delivery run=${state.runId}`);
      return {
        payload: {
          ...event.payload,
          text: `SG остановил непроверенный ответ.\n\n${reasons.join("\n")}`,
        },
      };
    }
    const draft = stripReceipt(event.payload.text);
    if (state.semanticApprovedDraft !== draft) {
      api.logger?.warn(`[sg-semantic-guard] blocked unchecked delivery run=${state.runId}`);
      return {
        payload: {
          ...event.payload,
          text: "SG остановил ответ без независимой смысловой проверки.",
        },
      };
    }
    return { payload: { ...event.payload, text: draft } };
  });
}
