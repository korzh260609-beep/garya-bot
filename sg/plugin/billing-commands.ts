import { SgBillingLedger, type SgBillingEntry } from "./billing-ledger.js";
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
  "/sg_billing diag",
].join("\n");

function formatNanoUsd(value: number): string {
  const whole = Math.floor(value / 1_000_000_000);
  const fraction = String(value % 1_000_000_000)
    .padStart(9, "0")
    .replace(/0+$/u, "");
  return `$${whole}${fraction ? `.${fraction}` : ""}`;
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
