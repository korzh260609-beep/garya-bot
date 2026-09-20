import type { AnyAgentTool, OpenClawPluginToolContext } from "openclaw/plugin-sdk/plugin-entry";
import { jsonResult } from "openclaw/plugin-sdk/tool-results";
import { createSgBillingCommandHandlers, type BillingCommandContext } from "./billing-commands.js";
import { resolveWorkspaceContext } from "./context.js";

export const BILLING_TOOL_NAMES = ["sg_billing_manage"] as const;

export const BILLING_AGENT_GUIDANCE = [
  "SG — биллинг",
  "Понимай намерение пользователя семантически и выбирай строгое действие sg_billing_manage; не используй сопоставление по ключевым словам, шаблоны фраз или собственный текстовый парсер.",
  "Различай предоплаченный баланс пользователя SG, расходы проекта OpenAI и доступный остаток/лимит OpenAI. Если объект запроса неоднозначен, сначала задай короткий уточняющий вопрос и не вызывай инструмент.",
  "Citizen может получать только собственный баланс через self_balance. Управление проектным биллингом и сведения о других пользователях доступны только монарху.",
  "Для credit, resolve_stale_monarch и bind_automation сначала получи явное подтверждение монарха; только после него передавай confirmed=true.",
  "Не предлагай пользователю запоминать или вводить /sg_* команды: это резервная техническая диагностика.",
].join("\n");

type BillingToolOptions = {
  env?: NodeJS.ProcessEnv;
  fetchFn?: typeof fetch;
  now?: () => number;
  logger?: { warn(message: string): void };
};

type BillingToolParameters = {
  action?: string;
  globalId?: string;
  amountUsd?: string;
  operationId?: string;
  days?: number;
  staleMinutes?: number;
  automationJobId?: string;
  confirmed?: boolean;
};

const ACTIONS = [
  "self_balance",
  "project_report",
  "user_report",
  "balance",
  "history",
  "reconcile",
  "diagnostics",
  "credit",
  "resolve_stale_monarch",
  "bind_automation",
] as const;

const MUTATING_ACTIONS = new Set(["credit", "resolve_stale_monarch", "bind_automation"]);

function requiredText(params: BillingToolParameters, key: keyof BillingToolParameters): string {
  const value = params[key];
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`sg-billing-tool-${String(key)}-required`);
  }
  return value.trim();
}

function integerInRange(value: unknown, key: string, minimum: number, maximum: number): number {
  if (!Number.isInteger(value) || (value as number) < minimum || (value as number) > maximum) {
    throw new Error(`sg-billing-tool-${key}-invalid`);
  }
  return value as number;
}

function commandContext(ctx: OpenClawPluginToolContext, args?: string): BillingCommandContext {
  return {
    channel: ctx.messageChannel ?? "",
    ...(ctx.agentAccountId ? { accountId: ctx.agentAccountId } : {}),
    ...(ctx.nativeChannelId ? { to: ctx.nativeChannelId } : {}),
    ...(ctx.requesterSenderId ? { senderId: ctx.requesterSenderId } : {}),
    ...(ctx.deliveryContext?.threadId !== undefined
      ? { messageThreadId: ctx.deliveryContext.threadId }
      : {}),
    ...(args ? { args } : {}),
    config: ctx.config ?? {},
  };
}

async function isMonarch(ctx: OpenClawPluginToolContext, stateDir: string): Promise<boolean> {
  const actor = await resolveWorkspaceContext(
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
  return actor.projectRole === "monarch" && Boolean(actor.globalId);
}

function adminArgs(params: BillingToolParameters, action: string): string {
  switch (action) {
    case "project_report":
      return "report";
    case "user_report":
      return `user ${requiredText(params, "globalId")}`;
    case "balance":
      return `balance ${requiredText(params, "globalId")}`;
    case "history":
      return `history ${requiredText(params, "globalId")}`;
    case "reconcile":
      return params.days === undefined
        ? "reconcile"
        : `reconcile ${integerInRange(params.days, "days", 1, 31)}`;
    case "diagnostics":
      return "diag";
    case "credit":
      return [
        "credit",
        requiredText(params, "globalId"),
        requiredText(params, "amountUsd"),
        requiredText(params, "operationId"),
      ].join(" ");
    case "resolve_stale_monarch":
      return `resolve-stale-monarch ${integerInRange(
        params.staleMinutes,
        "staleMinutes",
        30,
        10_080,
      )}`;
    case "bind_automation":
      return [
        "job-bind",
        requiredText(params, "automationJobId"),
        requiredText(params, "globalId"),
      ].join(" ");
    default:
      throw new Error("sg-billing-tool-action-invalid");
  }
}

export function createSgBillingTool(
  ctx: OpenClawPluginToolContext,
  stateDir: string,
  options: BillingToolOptions = {},
): AnyAgentTool {
  const handlers = createSgBillingCommandHandlers({
    stateDir,
    ...(options.env ? { env: options.env } : {}),
    ...(options.fetchFn ? { fetchFn: options.fetchFn } : {}),
    ...(options.now ? { now: options.now } : {}),
    ...(options.logger ? { logger: options.logger } : {}),
  });
  return {
    name: BILLING_TOOL_NAMES[0],
    label: "Биллинг SG",
    description:
      "Детерминированные операции биллинга после семантического определения намерения моделью. " +
      "Показывает собственный предоплаченный баланс SG; для монарха также отчёты проекта и пользователей, историю, сверку OpenAI и диагностику. " +
      "Не угадывай объект неоднозначного запроса: уточни, имеется в виду баланс SG, расходы проекта OpenAI или доступный остаток/лимит OpenAI. " +
      "Изменяющие действия credit, resolve_stale_monarch и bind_automation разрешены только после явного подтверждения монарха и требуют confirmed=true.",
    parameters: {
      type: "object",
      additionalProperties: false,
      required: ["action"],
      properties: {
        action: { type: "string", enum: [...ACTIONS] },
        globalId: { type: "string", minLength: 1 },
        amountUsd: { type: "string", pattern: "^(0|[1-9]\\d*)(?:\\.\\d{1,9})?$" },
        operationId: { type: "string", minLength: 1 },
        days: { type: "integer", minimum: 1, maximum: 31 },
        staleMinutes: { type: "integer", minimum: 30, maximum: 10_080 },
        automationJobId: { type: "string", minLength: 1 },
        confirmed: { type: "boolean" },
      },
    },
    async execute(_toolCallId, rawParameters) {
      const params = (rawParameters ?? {}) as BillingToolParameters;
      const action = params.action;
      if (!action || !ACTIONS.includes(action as (typeof ACTIONS)[number])) {
        return jsonResult({ status: "invalid", reason: "supported-action-required" });
      }
      try {
        if (action !== "self_balance" && !(await isMonarch(ctx, stateDir))) {
          return jsonResult({ status: "denied", reason: "monarch-required" });
        }
        if (MUTATING_ACTIONS.has(action) && params.confirmed !== true) {
          return jsonResult({ status: "confirmation_required", action });
        }
        const result =
          action === "self_balance"
            ? await handlers.balance(commandContext(ctx))
            : await handlers.billing(commandContext(ctx, adminArgs(params, action)));
        return jsonResult({ status: "ok", output: result.text });
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        options.logger?.warn(`[sg-billing] tool failed safely: ${reason}`);
        return jsonResult({ status: "invalid", reason });
      }
    },
  };
}
