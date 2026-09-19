import {
  SgBillingLedger,
  type SgBillingEntry,
  type SgBillingFinancialReport,
  type SgBillingFinancialUser,
} from "./billing-ledger.js";
import { reconcileOpenAiBilling } from "./billing-openai-reconciliation.js";
import { resolveWorkspaceContext } from "./context.js";
import { SgGlobalProfileRegistry } from "./global-profile-registry.js";

type BillingCommandContext = {
  channel: string;
  accountId?: string;
  to?: string;
  senderId?: string;
  args?: string;
  threadParentId?: string;
  messageThreadId?: string | number;
  config: { session?: { identityLinks?: Record<string, string[]> } };
};

type BillingCommandApi = {
  registerCommand(command: {
    name: string;
    description: string;
    acceptsArgs?: boolean;
    requireAuth: boolean;
    handler(ctx: BillingCommandContext): Promise<{ text: string }>;
  }): void;
  logger?: { warn(message: string): void };
};

const BILLING_USAGE = [
  "SG BILLING — команды монарха:",
  "/sg_billing balance <Global ID>",
  "/sg_billing credit <Global ID> <USD> <ID операции>",
  "/sg_billing history <Global ID>",
  "/sg_billing report",
  "/sg_billing user <Global ID>",
  "/sg_billing reconcile [1-31 дней]",
  "/sg_billing resolve-stale-monarch <30-10080 минут>",
  "/sg_billing job-bind <Automation Job ID> <Global ID>",
  "/sg_billing diag",
].join("\n");

function formatNanoUsd(value: number): string {
  const sign = value < 0 ? "-" : "";
  const absolute = Math.abs(value);
  const whole = Math.floor(absolute / 1_000_000_000);
  const fraction = String(absolute % 1_000_000_000)
    .padStart(9, "0")
    .replace(/0+$/u, "");
  return `${sign}$${whole}${fraction ? `.${fraction}` : ""}`;
}

function formatDisplayUsd(value: number): string {
  const sign = value < 0 ? "−" : "";
  const roundedMicroUsd = Math.floor((Math.abs(value) + 500) / 1_000);
  const whole = Math.floor(roundedMicroUsd / 1_000_000);
  const fraction = String(roundedMicroUsd % 1_000_000).padStart(6, "0");
  return `${sign}$${whole}.${fraction}`;
}

function reconciliationStatus(report: SgBillingFinancialReport): string {
  if (report.lastReconciledAt === undefined) {
    return "нет успешной сверки";
  }
  const ageMs = Date.now() - report.lastReconciledAt;
  const freshness = ageMs <= 24 * 60 * 60 * 1_000 ? "актуальна" : "устарела";
  return `${freshness}, ${new Date(report.lastReconciledAt).toISOString()}`;
}

function formatFinancialUser(user: SgBillingFinancialUser): string {
  return [
    "Global ID:",
    user.globalId,
    `Роль: ${user.role === "monarch" ? "монарх" : "гражданин"}`,
    "",
    "РАСХОДЫ",
    `OpenAI: ${formatDisplayUsd(user.providerCostNanoUsd)}`,
    "",
    "ДОХОД",
    `Выручка: ${formatDisplayUsd(user.chargedNanoUsd)}`,
    `Финансовый результат: ${formatDisplayUsd(user.profitNanoUsd)}`,
    "",
    "СТАТУС",
    `Операций в обработке: ${user.pendingOperationCount}`,
  ].join("\n");
}

function formatFinancialReport(report: SgBillingFinancialReport): string {
  return [
    "SG BILLING — ПРОЕКТ",
    "",
    "РАСХОДЫ",
    `OpenAI всего: ${formatDisplayUsd(report.projectProviderCostNanoUsd)}`,
    `Локально распределено: ${formatDisplayUsd(report.attributedProviderCostNanoUsd)}`,
    `Корректировка Admin API: ${formatDisplayUsd(report.reconciliationAdjustmentNanoUsd)}`,
    `Монарх: ${formatDisplayUsd(report.monarchProviderCostNanoUsd)}`,
    `Граждане: ${formatDisplayUsd(report.citizenProviderCostNanoUsd)}`,
    "",
    "ДОХОД",
    `Выручка пользователей: ${formatDisplayUsd(report.revenueNanoUsd)}`,
    `Прибыль проекта: ${formatDisplayUsd(report.profitNanoUsd)}`,
    "",
    "СТАТУС",
    `Операций в обработке: ${report.pendingOperationCount}`,
    `Окон сверки: ${report.reconciliationWindowCount}`,
    `Сверка: ${reconciliationStatus(report)}`,
    "",
    "ПО ПОЛЬЗОВАТЕЛЯМ",
    ...(report.users.length
      ? report.users.flatMap((user, index) => [
          ...(index === 0 ? [] : [""]),
          `ПОЛЬЗОВАТЕЛЬ ${index + 1}`,
          formatFinancialUser(user),
        ])
      : ["Операций нет"]),
  ].join("\n");
}

function parsePositiveUsd(value: string): number | undefined {
  const match = /^(0|[1-9]\d*)(?:\.(\d{1,9}))?$/u.exec(value);
  if (!match) {
    return undefined;
  }
  const whole = BigInt(match[1]!);
  const fraction = BigInt((match[2] ?? "").padEnd(9, "0"));
  const nanoUsd = whole * 1_000_000_000n + fraction;
  if (nanoUsd < 1n || nanoUsd > BigInt(Number.MAX_SAFE_INTEGER)) {
    return undefined;
  }
  return Number(nanoUsd);
}

function formatBalance(
  globalId: string,
  snapshot: { balanceNanoUsd: number; reservedNanoUsd: number; availableNanoUsd: number },
): string {
  return [
    "SG BALANCE",
    `Global ID: ${globalId}`,
    `Баланс: ${formatNanoUsd(snapshot.balanceNanoUsd)}`,
    `В резерве: ${formatNanoUsd(snapshot.reservedNanoUsd)}`,
    `Доступно: ${formatNanoUsd(snapshot.availableNanoUsd)}`,
  ].join("\n");
}

function formatEntry(entry: SgBillingEntry): string {
  const details =
    entry.type === "credit"
      ? `+${formatNanoUsd(entry.amountNanoUsd ?? 0)}`
      : entry.type === "reserve"
        ? `резерв ${formatNanoUsd(entry.amountNanoUsd ?? 0)}`
        : [
            entry.outcome ?? "unknown",
            `cost=${formatNanoUsd(entry.actualCostNanoUsd ?? 0)}`,
            `charged=${formatNanoUsd(entry.chargedNanoUsd ?? 0)}`,
          ].join(" ");
  return `${new Date(entry.createdAt).toISOString()} | ${entry.operationId} | ${entry.type} | ${details}`;
}

async function resolveActor(ctx: BillingCommandContext, stateDir: string) {
  return resolveWorkspaceContext(
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
}

async function withLedger<T>(stateDir: string, run: (ledger: SgBillingLedger) => Promise<T>) {
  const ledger = new SgBillingLedger(stateDir);
  try {
    return await run(ledger);
  } finally {
    ledger.close();
  }
}

export function registerSgBillingCommands(params: {
  api: BillingCommandApi;
  stateDir: string;
  env?: NodeJS.ProcessEnv;
  fetchFn?: typeof fetch;
  now?: () => number;
}): void {
  const { api, stateDir } = params;
  const profiles = new SgGlobalProfileRegistry(stateDir);

  api.registerCommand({
    name: "sg_balance",
    description: "Показать собственный предоплаченный баланс SG",
    requireAuth: false,
    handler: async (ctx) => {
      try {
        const actor = await resolveActor(ctx, stateDir);
        if (!actor.globalId || !actor.projectRole) {
          return { text: "SG BALANCE — Global ID не определён" };
        }
        const snapshot = await withLedger(stateDir, (ledger) => ledger.snapshot(actor.globalId!));
        return { text: formatBalance(actor.globalId, snapshot) };
      } catch (error) {
        api.logger?.warn(
          `[sg-billing] balance failed safely: ${error instanceof Error ? error.message : String(error)}`,
        );
        return { text: "SG BALANCE — не удалось получить баланс" };
      }
    },
  });

  api.registerCommand({
    name: "sg_billing",
    description: "Управление предоплаченным биллингом SG для монарха",
    acceptsArgs: true,
    requireAuth: false,
    handler: async (ctx) => {
      try {
        const actor = await resolveActor(ctx, stateDir);
        if (actor.projectRole !== "monarch" || !actor.globalId) {
          return { text: "SG BILLING — доступ разрешён только монарху" };
        }

        const args = ctx.args?.trim().split(/\s+/u).filter(Boolean) ?? [];
        const [action, globalId, value, operationId, ...extra] = args;
        if (action === "report" && !globalId) {
          const report = await withLedger(stateDir, (ledger) => ledger.financialReport());
          return { text: formatFinancialReport(report) };
        }
        if (action === "user" && globalId && !value) {
          if (!(await profiles.findByGlobalId(globalId))) {
            return { text: "SG BILLING — Global ID не найден или неактивен" };
          }
          const report = await withLedger(stateDir, (ledger) => ledger.financialReport());
          const users = report.users.filter((user) => user.globalId === globalId);
          return {
            text: users.length
              ? ["SG BILLING — ПОЛЬЗОВАТЕЛЬ", "", ...users.map(formatFinancialUser)].join("\n")
              : `SG BILLING — ПОЛЬЗОВАТЕЛЬ\n\nGlobal ID:\n${globalId}\n\nОпераций нет`,
          };
        }
        if (action === "reconcile" && !value && !operationId && extra.length === 0) {
          const days = globalId === undefined ? undefined : Number(globalId);
          if (
            days !== undefined &&
            (!Number.isInteger(days) || days < 1 || days > 31 || String(days) !== globalId)
          ) {
            return { text: BILLING_USAGE };
          }
          const result = await reconcileOpenAiBilling({
            stateDir,
            env: params.env ?? process.env,
            ...(params.fetchFn ? { fetchFn: params.fetchFn } : {}),
            ...(params.now ? { now: params.now() } : {}),
            ...(days === undefined ? {} : { days }),
          });
          return {
            text: [
              "SG BILLING — сверка завершена",
              `Проект OpenAI: ${result.projectId}`,
              `Окон: ${result.windowCount}`,
              `Затраты Admin API: ${formatNanoUsd(result.providerCostNanoUsd)}`,
              `Локально атрибутировано: ${formatNanoUsd(result.attributedCostNanoUsd)}`,
              `Корректировка: ${formatNanoUsd(result.differenceNanoUsd)}`,
            ].join("\n"),
          };
        }
        if (action === "diag" && !globalId) {
          const diagnostic = await withLedger(stateDir, (ledger) => ledger.diagnostics());
          const structurallySound =
            diagnostic.integrityOk &&
            diagnostic.foreignKeyViolationCount === 0 &&
            diagnostic.reservedBalanceMismatchCount === 0;
          const status = !structurallySound
            ? "FAIL"
            : diagnostic.blockedOperationCount > 0
              ? "WARN"
              : "PASS";
          return {
            text: [
              `SG BILLING DIAG — ${status}`,
              `SQLite integrity: ${diagnostic.integrityMessage}`,
              `Нарушения FK: ${diagnostic.foreignKeyViolationCount}`,
              `Счета: ${diagnostic.accountCount}`,
              `Активные резервы: ${diagnostic.reservedOperationCount}`,
              `Заблокированные операции без цены: ${diagnostic.blockedOperationCount}`,
              `Части без цены: ${diagnostic.unpricedPartCount}`,
              `Несовпадения суммы резервов: ${diagnostic.reservedBalanceMismatchCount}`,
              `Старейший активный резерв: ${
                diagnostic.oldestReservedAt === undefined
                  ? "нет"
                  : new Date(diagnostic.oldestReservedAt).toISOString()
              }`,
            ].join("\n"),
          };
        }

        if (
          action === "resolve-stale-monarch" &&
          globalId &&
          !value &&
          !operationId &&
          extra.length === 0
        ) {
          const staleMinutes = Number(globalId);
          if (
            !Number.isInteger(staleMinutes) ||
            staleMinutes < 30 ||
            staleMinutes > 10_080 ||
            String(staleMinutes) !== globalId
          ) {
            return { text: BILLING_USAGE };
          }
          const now = params.now?.() ?? Date.now();
          const result = await withLedger(stateDir, (ledger) =>
            ledger.resolveStaleMonarchOperations(now - staleMinutes * 60_000),
          );
          return {
            text: [
              "SG BILLING — старые операции монарха закрыты",
              `Порог возраста: ${staleMinutes} мин`,
              `Закрыто операций: ${result.operationCount}`,
              `Закрыто частей без цены: ${result.unpricedPartCount}`,
              "Списание с монарха: $0.000000",
              "Общие расходы сохранены сверкой Admin API",
            ].join("\n"),
          };
        }

        if (action === "job-bind") {
          if (!globalId || !value || operationId || extra.length > 0) {
            return { text: BILLING_USAGE };
          }
          const profile = await profiles.findByGlobalId(value);
          if (!profile || (profile.role !== "monarch" && profile.role !== "citizen")) {
            return { text: "SG BILLING — Global ID не найден или неактивен" };
          }
          const billingRole = profile.role;
          await withLedger(stateDir, (ledger) =>
            ledger.bindAutomationOwner({
              jobId: globalId,
              globalId: profile.globalId,
              role: billingRole,
            }),
          );
          return {
            text: [
              "SG BILLING — automation привязана",
              `Job ID: ${globalId}`,
              `Global ID: ${profile.globalId}`,
              `Роль: ${billingRole}`,
            ].join("\n"),
          };
        }

        if (
          !globalId ||
          extra.length > 0 ||
          !["balance", "credit", "history"].includes(action ?? "") ||
          (action === "credit" ? !value || !operationId : Boolean(value || operationId))
        ) {
          return { text: BILLING_USAGE };
        }
        if (!(await profiles.findByGlobalId(globalId))) {
          return { text: "SG BILLING — Global ID не найден или неактивен" };
        }

        if (action === "balance") {
          const snapshot = await withLedger(stateDir, (ledger) => ledger.snapshot(globalId));
          return { text: formatBalance(globalId, snapshot) };
        }
        if (action === "history") {
          const entries = await withLedger(stateDir, (ledger) => ledger.recentEntries(globalId));
          return {
            text: entries.length
              ? [
                  `SG BILLING HISTORY — ${globalId} (последние ${entries.length})`,
                  ...entries.map(formatEntry),
                ].join("\n")
              : `SG BILLING HISTORY — ${globalId}\nОпераций нет`,
          };
        }

        const amountNanoUsd = parsePositiveUsd(value!);
        if (amountNanoUsd === undefined) {
          return {
            text: "SG BILLING — сумма USD должна быть положительной, максимум 9 знаков после точки",
          };
        }
        await withLedger(stateDir, (ledger) =>
          ledger.credit({ globalId, creditId: operationId!, amountNanoUsd }),
        );
        const snapshot = await withLedger(stateDir, (ledger) => ledger.snapshot(globalId));
        return {
          text: [
            "SG BILLING — пополнение записано",
            `Global ID: ${globalId}`,
            `ID операции: ${operationId}`,
            `Сумма: ${formatNanoUsd(amountNanoUsd)}`,
            `Баланс: ${formatNanoUsd(snapshot.balanceNanoUsd)}`,
          ].join("\n"),
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        api.logger?.warn(`[sg-billing] command failed safely: ${message}`);
        if (message.startsWith("sg-billing-admin-")) {
          return {
            text:
              message === "sg-billing-admin-key-missing"
                ? "SG BILLING — OPENAI_ADMIN_KEY не настроен"
                : message === "sg-billing-openai-project-id-missing"
                  ? "SG BILLING — OPENAI_PROJECT_ID не настроен"
                  : "SG BILLING — сверка Admin API временно недоступна; локальный учёт продолжает работать",
          };
        }
        if (message === "sg-billing-reconciliation-required") {
          return {
            text: "SG BILLING — сначала выполните /sg_billing reconcile 1",
          };
        }
        return {
          text:
            message === "sg-billing-idempotency-conflict"
              ? "SG BILLING — ID операции уже использован с другими параметрами"
              : "SG BILLING — операция не выполнена",
        };
      }
    },
  });
}
