import { mkdirSync } from "node:fs";
import path from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { configureSqliteConnectionPragmas } from "openclaw/plugin-sdk/plugin-state-runtime";
import {
  openNodeSqliteDatabase,
  runSqliteImmediateTransactionSync,
} from "openclaw/plugin-sdk/sqlite-runtime";

const NANO_USD_PER_USD = 1_000_000_000;
const CUSTOMER_PRICE_MULTIPLIER = 2;

export type SgBillingAccountSnapshot = {
  balanceNanoUsd: number;
  reservedNanoUsd: number;
  availableNanoUsd: number;
};

export type SgBillingEntry = {
  entryId: number;
  globalId: string;
  operationId: string;
  type: "credit" | "reserve" | "complete";
  amountNanoUsd?: number;
  outcome?: "completed" | "error";
  actualCostNanoUsd?: number;
  chargedNanoUsd?: number;
  createdAt: number;
};

type BillingAccountRow = {
  balance_nano_usd: number;
  reserved_nano_usd: number;
};

type BillingOperationRow = {
  operation_type: "credit" | "usage";
  state: "credited" | "reserved" | "terminal";
  amount_nano_usd: number;
  outcome: "completed" | "error" | null;
  actual_cost_nano_usd: number | null;
  charged_nano_usd: number | null;
};

type BillingEntryRow = {
  entry_id: number;
  global_id: string;
  operation_id: string;
  entry_type: "credit" | "reserve" | "complete";
  amount_nano_usd: number | null;
  outcome: "completed" | "error" | null;
  actual_cost_nano_usd: number | null;
  charged_nano_usd: number | null;
  created_at: number;
};

type BillingCorrelationRow = {
  global_id: string;
  operation_id: string;
};

type BillingPartRow = {
  outcome: "pending" | "completed" | "error";
  authorized_nano_usd: number | null;
  actual_cost_nano_usd: number | null;
  charged_nano_usd: number | null;
};

function requireIdentifier(value: string, field: string): string {
  if (!value || value !== value.trim()) {
    throw new Error(`sg-billing-${field}-invalid`);
  }
  return value;
}

function requireNanoUsd(value: number, field: string, allowZero = false): number {
  const minimum = allowZero ? 0 : 1;
  if (!Number.isSafeInteger(value) || value < minimum) {
    throw new Error(`sg-billing-${field}-invalid`);
  }
  return value;
}

function checkedAdd(left: number, right: number): number {
  const sum = left + right;
  if (!Number.isSafeInteger(sum)) {
    throw new Error("sg-billing-amount-overflow");
  }
  return sum;
}

function checkedCharge(actualCostNanoUsd: number): number {
  const charge = actualCostNanoUsd * CUSTOMER_PRICE_MULTIPLIER;
  if (!Number.isSafeInteger(charge)) {
    throw new Error("sg-billing-amount-overflow");
  }
  return charge;
}

export function usdToNanoUsd(costUsd: number): number {
  if (!Number.isFinite(costUsd) || costUsd < 0) {
    throw new Error("sg-billing-usd-cost-invalid");
  }
  const nanoUsd = Math.round(costUsd * NANO_USD_PER_USD);
  return requireNanoUsd(nanoUsd, "usd-cost", true);
}

export class SgBillingLedger {
  private readonly database: DatabaseSync;
  private readonly walMaintenance: ReturnType<typeof configureSqliteConnectionPragmas>;

  constructor(stateDir: string) {
    const directory = path.join(stateDir, "sg");
    mkdirSync(directory, { recursive: true });
    const databasePath = path.join(directory, "billing.sqlite");
    this.database = openNodeSqliteDatabase(databasePath);
    this.walMaintenance = configureSqliteConnectionPragmas(this.database, {
      busyTimeoutMs: 5_000,
      databaseLabel: "sg-billing-ledger",
      databasePath,
      foreignKeys: true,
      synchronous: "NORMAL",
    });
    this.ensureSchema();
  }

  private ensureSchema(): void {
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS sg_billing_accounts (
        global_id TEXT PRIMARY KEY,
        balance_nano_usd INTEGER NOT NULL CHECK (balance_nano_usd >= 0),
        reserved_nano_usd INTEGER NOT NULL CHECK (reserved_nano_usd >= 0),
        updated_at INTEGER NOT NULL,
        CHECK (reserved_nano_usd <= balance_nano_usd)
      ) STRICT;

      CREATE TABLE IF NOT EXISTS sg_billing_operations (
        global_id TEXT NOT NULL,
        operation_id TEXT NOT NULL,
        operation_type TEXT NOT NULL CHECK (operation_type IN ('credit', 'usage')),
        state TEXT NOT NULL CHECK (state IN ('credited', 'reserved', 'terminal')),
        amount_nano_usd INTEGER NOT NULL CHECK (amount_nano_usd >= 0),
        outcome TEXT CHECK (outcome IN ('completed', 'error')),
        actual_cost_nano_usd INTEGER CHECK (actual_cost_nano_usd >= 0),
        charged_nano_usd INTEGER CHECK (charged_nano_usd >= 0),
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        PRIMARY KEY (global_id, operation_id),
        FOREIGN KEY (global_id) REFERENCES sg_billing_accounts(global_id)
      ) STRICT;

      CREATE TABLE IF NOT EXISTS sg_billing_entries (
        entry_id INTEGER PRIMARY KEY AUTOINCREMENT,
        global_id TEXT NOT NULL,
        operation_id TEXT NOT NULL,
        entry_type TEXT NOT NULL CHECK (entry_type IN ('credit', 'reserve', 'complete')),
        amount_nano_usd INTEGER CHECK (amount_nano_usd >= 0),
        outcome TEXT CHECK (outcome IN ('completed', 'error')),
        actual_cost_nano_usd INTEGER CHECK (actual_cost_nano_usd >= 0),
        charged_nano_usd INTEGER CHECK (charged_nano_usd >= 0),
        created_at INTEGER NOT NULL,
        FOREIGN KEY (global_id, operation_id)
          REFERENCES sg_billing_operations(global_id, operation_id)
      ) STRICT;

      CREATE INDEX IF NOT EXISTS sg_billing_entries_global_id_entry_id
        ON sg_billing_entries(global_id, entry_id);

      CREATE TABLE IF NOT EXISTS sg_billing_correlations (
        correlation_id TEXT PRIMARY KEY,
        global_id TEXT NOT NULL,
        operation_id TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (global_id, operation_id)
          REFERENCES sg_billing_operations(global_id, operation_id)
      ) STRICT;

      CREATE TABLE IF NOT EXISTS sg_billing_operation_parts (
        global_id TEXT NOT NULL,
        operation_id TEXT NOT NULL,
        part_id TEXT NOT NULL,
        outcome TEXT NOT NULL CHECK (outcome IN ('pending', 'completed', 'error')),
        authorized_nano_usd INTEGER CHECK (authorized_nano_usd >= 0),
        actual_cost_nano_usd INTEGER CHECK (actual_cost_nano_usd >= 0),
        charged_nano_usd INTEGER CHECK (charged_nano_usd >= 0),
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        PRIMARY KEY (global_id, operation_id, part_id),
        FOREIGN KEY (global_id, operation_id)
          REFERENCES sg_billing_operations(global_id, operation_id)
      ) STRICT;
    `);
    const partColumns = this.database
      .prepare("PRAGMA table_info(sg_billing_operation_parts)")
      .all() as Array<{ name: string }>;
    if (!partColumns.some((column) => column.name === "authorized_nano_usd")) {
      this.database.exec(
        "ALTER TABLE sg_billing_operation_parts ADD COLUMN authorized_nano_usd INTEGER CHECK (authorized_nano_usd >= 0)",
      );
    }
  }

  private ensureAccount(globalId: string, now: number): void {
    this.database
      .prepare(
        `INSERT OR IGNORE INTO sg_billing_accounts
          (global_id, balance_nano_usd, reserved_nano_usd, updated_at)
         VALUES (?, 0, 0, ?)`,
      )
      .run(globalId, now);
  }

  private account(globalId: string): BillingAccountRow {
    const row = this.database
      .prepare(
        `SELECT balance_nano_usd, reserved_nano_usd
         FROM sg_billing_accounts
         WHERE global_id = ?`,
      )
      .get(globalId) as BillingAccountRow | undefined;
    return row ?? { balance_nano_usd: 0, reserved_nano_usd: 0 };
  }

  private operation(globalId: string, operationId: string): BillingOperationRow | undefined {
    return this.database
      .prepare(
        `SELECT operation_type, state, amount_nano_usd, outcome,
                actual_cost_nano_usd, charged_nano_usd
         FROM sg_billing_operations
         WHERE global_id = ? AND operation_id = ?`,
      )
      .get(globalId, operationId) as BillingOperationRow | undefined;
  }

  async credit(params: {
    globalId: string;
    creditId: string;
    amountNanoUsd: number;
  }): Promise<void> {
    const globalId = requireIdentifier(params.globalId, "global-id");
    const creditId = requireIdentifier(params.creditId, "credit-id");
    const amountNanoUsd = requireNanoUsd(params.amountNanoUsd, "credit-amount");
    runSqliteImmediateTransactionSync(
      this.database,
      () => {
        const now = Date.now();
        this.ensureAccount(globalId, now);
        const existing = this.operation(globalId, creditId);
        if (existing) {
          if (
            existing.operation_type === "credit" &&
            existing.state === "credited" &&
            existing.amount_nano_usd === amountNanoUsd
          ) {
            return;
          }
          throw new Error("sg-billing-idempotency-conflict");
        }
        const account = this.account(globalId);
        const balance = checkedAdd(account.balance_nano_usd, amountNanoUsd);
        this.database
          .prepare(
            `INSERT INTO sg_billing_operations
              (global_id, operation_id, operation_type, state, amount_nano_usd, created_at, updated_at)
             VALUES (?, ?, 'credit', 'credited', ?, ?, ?)`,
          )
          .run(globalId, creditId, amountNanoUsd, now, now);
        this.database
          .prepare(
            `UPDATE sg_billing_accounts
             SET balance_nano_usd = ?, updated_at = ?
             WHERE global_id = ?`,
          )
          .run(balance, now, globalId);
        this.database
          .prepare(
            `INSERT INTO sg_billing_entries
              (global_id, operation_id, entry_type, amount_nano_usd, created_at)
             VALUES (?, ?, 'credit', ?, ?)`,
          )
          .run(globalId, creditId, amountNanoUsd, now);
      },
      { busyTimeoutMs: 5_000, databaseLabel: "sg-billing-ledger", operationLabel: "credit" },
    );
  }

  async reserve(params: {
    globalId: string;
    operationId: string;
    amountNanoUsd: number;
  }): Promise<void> {
    const globalId = requireIdentifier(params.globalId, "global-id");
    const operationId = requireIdentifier(params.operationId, "operation-id");
    const amountNanoUsd = requireNanoUsd(params.amountNanoUsd, "reserve-amount");
    runSqliteImmediateTransactionSync(
      this.database,
      () => {
        const now = Date.now();
        this.ensureAccount(globalId, now);
        const existing = this.operation(globalId, operationId);
        if (existing) {
          if (
            existing.operation_type === "usage" &&
            existing.state === "reserved" &&
            existing.amount_nano_usd === amountNanoUsd
          ) {
            return;
          }
          throw new Error("sg-billing-idempotency-conflict");
        }
        const account = this.account(globalId);
        const available = account.balance_nano_usd - account.reserved_nano_usd;
        if (available < amountNanoUsd) {
          throw new Error("sg-billing-insufficient-funds");
        }
        const reserved = checkedAdd(account.reserved_nano_usd, amountNanoUsd);
        this.database
          .prepare(
            `INSERT INTO sg_billing_operations
              (global_id, operation_id, operation_type, state, amount_nano_usd, created_at, updated_at)
             VALUES (?, ?, 'usage', 'reserved', ?, ?, ?)`,
          )
          .run(globalId, operationId, amountNanoUsd, now, now);
        this.database
          .prepare(
            `UPDATE sg_billing_accounts
             SET reserved_nano_usd = ?, updated_at = ?
             WHERE global_id = ?`,
          )
          .run(reserved, now, globalId);
        this.database
          .prepare(
            `INSERT INTO sg_billing_entries
              (global_id, operation_id, entry_type, amount_nano_usd, created_at)
             VALUES (?, ?, 'reserve', ?, ?)`,
          )
          .run(globalId, operationId, amountNanoUsd, now);
      },
      { busyTimeoutMs: 5_000, databaseLabel: "sg-billing-ledger", operationLabel: "reserve" },
    );
  }

  async reserveAvailable(params: { globalId: string; operationId: string }): Promise<number> {
    const globalId = requireIdentifier(params.globalId, "global-id");
    const operationId = requireIdentifier(params.operationId, "operation-id");
    let reservedAmount = 0;
    runSqliteImmediateTransactionSync(
      this.database,
      () => {
        const now = Date.now();
        this.ensureAccount(globalId, now);
        const existing = this.operation(globalId, operationId);
        if (existing) {
          if (existing.operation_type === "usage" && existing.state === "reserved") {
            reservedAmount = existing.amount_nano_usd;
            return;
          }
          throw new Error("sg-billing-idempotency-conflict");
        }
        const account = this.account(globalId);
        const available = account.balance_nano_usd - account.reserved_nano_usd;
        if (available < 1) {
          throw new Error("sg-billing-insufficient-funds");
        }
        reservedAmount = available;
        this.database
          .prepare(
            `INSERT INTO sg_billing_operations
              (global_id, operation_id, operation_type, state, amount_nano_usd, created_at, updated_at)
             VALUES (?, ?, 'usage', 'reserved', ?, ?, ?)`,
          )
          .run(globalId, operationId, available, now, now);
        this.database
          .prepare(
            `UPDATE sg_billing_accounts
             SET reserved_nano_usd = ?, updated_at = ?
             WHERE global_id = ?`,
          )
          .run(checkedAdd(account.reserved_nano_usd, available), now, globalId);
        this.database
          .prepare(
            `INSERT INTO sg_billing_entries
              (global_id, operation_id, entry_type, amount_nano_usd, created_at)
             VALUES (?, ?, 'reserve', ?, ?)`,
          )
          .run(globalId, operationId, available, now);
      },
      {
        busyTimeoutMs: 5_000,
        databaseLabel: "sg-billing-ledger",
        operationLabel: "reserve-available",
      },
    );
    return reservedAmount;
  }

  async bindCorrelation(params: {
    correlationId: string;
    globalId: string;
    operationId: string;
  }): Promise<void> {
    const correlationId = requireIdentifier(params.correlationId, "correlation-id");
    const globalId = requireIdentifier(params.globalId, "global-id");
    const operationId = requireIdentifier(params.operationId, "operation-id");
    runSqliteImmediateTransactionSync(
      this.database,
      () => {
        const operation = this.operation(globalId, operationId);
        if (!operation || operation.operation_type !== "usage") {
          throw new Error("sg-billing-reservation-not-found");
        }
        const existing = this.database
          .prepare(
            `SELECT global_id, operation_id
             FROM sg_billing_correlations
             WHERE correlation_id = ?`,
          )
          .get(correlationId) as BillingCorrelationRow | undefined;
        if (existing) {
          if (existing.global_id === globalId && existing.operation_id === operationId) {
            return;
          }
          throw new Error("sg-billing-idempotency-conflict");
        }
        this.database
          .prepare(
            `INSERT INTO sg_billing_correlations
              (correlation_id, global_id, operation_id, created_at)
             VALUES (?, ?, ?, ?)`,
          )
          .run(correlationId, globalId, operationId, Date.now());
      },
      {
        busyTimeoutMs: 5_000,
        databaseLabel: "sg-billing-ledger",
        operationLabel: "bind-correlation",
      },
    );
  }

  async resolveCorrelation(
    correlationIdInput: string,
  ): Promise<{ globalId: string; operationId: string } | undefined> {
    const correlationId = requireIdentifier(correlationIdInput, "correlation-id");
    const row = this.database
      .prepare(
        `SELECT global_id, operation_id
         FROM sg_billing_correlations
         WHERE correlation_id = ?`,
      )
      .get(correlationId) as BillingCorrelationRow | undefined;
    return row ? { globalId: row.global_id, operationId: row.operation_id } : undefined;
  }

  async prepaidCapacity(params: {
    globalId: string;
    operationId: string;
  }): Promise<{ remainingNanoUsd: number; hasUnpricedParts: boolean }> {
    const globalId = requireIdentifier(params.globalId, "global-id");
    const operationId = requireIdentifier(params.operationId, "operation-id");
    const operation = this.operation(globalId, operationId);
    if (!operation || operation.operation_type !== "usage" || operation.state !== "reserved") {
      throw new Error("sg-billing-reservation-not-found");
    }
    const pending = this.database
      .prepare(
        `SELECT
           COALESCE(SUM(CASE WHEN outcome = 'pending' THEN authorized_nano_usd ELSE 0 END), 0)
             AS authorized,
           SUM(CASE
             WHEN actual_cost_nano_usd IS NULL
               AND (authorized_nano_usd IS NULL OR outcome != 'pending')
             THEN 1 ELSE 0 END)
             AS unpriced
         FROM sg_billing_operation_parts
         WHERE global_id = ? AND operation_id = ?`,
      )
      .get(globalId, operationId) as { authorized: number; unpriced: number };
    return {
      remainingNanoUsd:
        operation.amount_nano_usd - (operation.charged_nano_usd ?? 0) - pending.authorized,
      hasUnpricedParts: pending.unpriced > 0,
    };
  }

  async authorizePart(params: {
    globalId: string;
    operationId: string;
    partId: string;
    authorizedNanoUsd: number;
  }): Promise<void> {
    const globalId = requireIdentifier(params.globalId, "global-id");
    const operationId = requireIdentifier(params.operationId, "operation-id");
    const partId = requireIdentifier(params.partId, "part-id");
    const authorizedNanoUsd = requireNanoUsd(params.authorizedNanoUsd, "authorized-amount");
    runSqliteImmediateTransactionSync(
      this.database,
      () => {
        const operation = this.operation(globalId, operationId);
        if (!operation || operation.operation_type !== "usage" || operation.state !== "reserved") {
          throw new Error("sg-billing-reservation-not-found");
        }
        const existing = this.database
          .prepare(
            `SELECT outcome, authorized_nano_usd, actual_cost_nano_usd, charged_nano_usd
             FROM sg_billing_operation_parts
             WHERE global_id = ? AND operation_id = ? AND part_id = ?`,
          )
          .get(globalId, operationId, partId) as BillingPartRow | undefined;
        if (existing) {
          if (
            existing.outcome === "pending" &&
            existing.authorized_nano_usd === authorizedNanoUsd &&
            existing.actual_cost_nano_usd === null &&
            existing.charged_nano_usd === null
          ) {
            return;
          }
          if (
            existing.outcome === "pending" &&
            existing.authorized_nano_usd === null &&
            existing.actual_cost_nano_usd === null &&
            existing.charged_nano_usd === null
          ) {
            const pending = this.database
              .prepare(
                `SELECT COALESCE(SUM(authorized_nano_usd), 0) AS authorized
                 FROM sg_billing_operation_parts
                 WHERE global_id = ? AND operation_id = ? AND outcome = 'pending'`,
              )
              .get(globalId, operationId) as { authorized: number };
            const remaining =
              operation.amount_nano_usd - (operation.charged_nano_usd ?? 0) - pending.authorized;
            if (authorizedNanoUsd > remaining) {
              throw new Error("sg-billing-insufficient-prepaid-capacity");
            }
            this.database
              .prepare(
                `UPDATE sg_billing_operation_parts
                 SET authorized_nano_usd = ?, updated_at = ?
                 WHERE global_id = ? AND operation_id = ? AND part_id = ?`,
              )
              .run(authorizedNanoUsd, Date.now(), globalId, operationId, partId);
            return;
          }
          throw new Error("sg-billing-idempotency-conflict");
        }
        const pending = this.database
          .prepare(
            `SELECT COALESCE(SUM(authorized_nano_usd), 0) AS authorized
             FROM sg_billing_operation_parts
             WHERE global_id = ? AND operation_id = ? AND outcome = 'pending'`,
          )
          .get(globalId, operationId) as { authorized: number };
        const remaining =
          operation.amount_nano_usd - (operation.charged_nano_usd ?? 0) - pending.authorized;
        if (authorizedNanoUsd > remaining) {
          throw new Error("sg-billing-insufficient-prepaid-capacity");
        }
        const now = Date.now();
        this.database
          .prepare(
            `INSERT INTO sg_billing_operation_parts
              (global_id, operation_id, part_id, outcome, authorized_nano_usd, created_at, updated_at)
             VALUES (?, ?, ?, 'pending', ?, ?, ?)`,
          )
          .run(globalId, operationId, partId, authorizedNanoUsd, now, now);
      },
      {
        busyTimeoutMs: 5_000,
        databaseLabel: "sg-billing-ledger",
        operationLabel: "authorize-part",
      },
    );
  }

  async recordPart(params: {
    globalId: string;
    operationId: string;
    partId: string;
    outcome: "completed" | "error";
    actualCostNanoUsd?: number;
  }): Promise<void> {
    const globalId = requireIdentifier(params.globalId, "global-id");
    const operationId = requireIdentifier(params.operationId, "operation-id");
    const partId = requireIdentifier(params.partId, "part-id");
    const actualCostNanoUsd =
      params.actualCostNanoUsd === undefined
        ? undefined
        : requireNanoUsd(params.actualCostNanoUsd, "actual-cost", true);
    const chargedNanoUsd =
      actualCostNanoUsd === undefined ? undefined : checkedCharge(actualCostNanoUsd);
    runSqliteImmediateTransactionSync(
      this.database,
      () => {
        const operation = this.operation(globalId, operationId);
        if (!operation || operation.operation_type !== "usage") {
          throw new Error("sg-billing-reservation-not-found");
        }
        if (operation.state !== "reserved") {
          throw new Error("sg-billing-reservation-invalid");
        }
        const existing = this.database
          .prepare(
            `SELECT outcome, authorized_nano_usd, actual_cost_nano_usd, charged_nano_usd
             FROM sg_billing_operation_parts
             WHERE global_id = ? AND operation_id = ? AND part_id = ?`,
          )
          .get(globalId, operationId, partId) as BillingPartRow | undefined;
        if (existing) {
          if (
            existing.outcome === params.outcome &&
            existing.actual_cost_nano_usd === (actualCostNanoUsd ?? null) &&
            existing.charged_nano_usd === (chargedNanoUsd ?? null)
          ) {
            return;
          }
          if (existing.outcome === "pending" && existing.actual_cost_nano_usd === null) {
            const now = Date.now();
            if (actualCostNanoUsd === undefined || chargedNanoUsd === undefined) {
              this.database
                .prepare(
                  `UPDATE sg_billing_operation_parts
                   SET outcome = ?, updated_at = ?
                   WHERE global_id = ? AND operation_id = ? AND part_id = ?`,
                )
                .run(params.outcome, now, globalId, operationId, partId);
              return;
            }
            const chargedSoFar = operation.charged_nano_usd ?? 0;
            const chargeLimit =
              existing.authorized_nano_usd ?? operation.amount_nano_usd - chargedSoFar;
            if (chargedNanoUsd > chargeLimit) {
              throw new Error("sg-billing-settlement-exceeds-prepaid-funds");
            }
            const account = this.account(globalId);
            const nextActual = checkedAdd(operation.actual_cost_nano_usd ?? 0, actualCostNanoUsd);
            const nextCharged = checkedAdd(chargedSoFar, chargedNanoUsd);
            this.database
              .prepare(
                `UPDATE sg_billing_operation_parts
                 SET outcome = ?, actual_cost_nano_usd = ?, charged_nano_usd = ?, updated_at = ?
                 WHERE global_id = ? AND operation_id = ? AND part_id = ?`,
              )
              .run(
                params.outcome,
                actualCostNanoUsd,
                chargedNanoUsd,
                now,
                globalId,
                operationId,
                partId,
              );
            this.database
              .prepare(
                `UPDATE sg_billing_operations
                 SET actual_cost_nano_usd = ?, charged_nano_usd = ?, updated_at = ?
                 WHERE global_id = ? AND operation_id = ?`,
              )
              .run(nextActual, nextCharged, now, globalId, operationId);
            this.database
              .prepare(
                `UPDATE sg_billing_accounts
                 SET balance_nano_usd = ?, reserved_nano_usd = ?, updated_at = ?
                 WHERE global_id = ?`,
              )
              .run(
                account.balance_nano_usd - chargedNanoUsd,
                account.reserved_nano_usd - chargedNanoUsd,
                now,
                globalId,
              );
            return;
          }
          throw new Error("sg-billing-idempotency-conflict");
        }

        const now = Date.now();
        if (actualCostNanoUsd === undefined || chargedNanoUsd === undefined) {
          this.database
            .prepare(
              `INSERT INTO sg_billing_operation_parts
                (global_id, operation_id, part_id, outcome, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?)`,
            )
            .run(globalId, operationId, partId, params.outcome, now, now);
          return;
        }

        const chargedSoFar = operation.charged_nano_usd ?? 0;
        const remainingReserve = operation.amount_nano_usd - chargedSoFar;
        if (chargedNanoUsd > remainingReserve) {
          throw new Error("sg-billing-settlement-exceeds-prepaid-funds");
        }
        const account = this.account(globalId);
        const nextActual = checkedAdd(operation.actual_cost_nano_usd ?? 0, actualCostNanoUsd);
        const nextCharged = checkedAdd(chargedSoFar, chargedNanoUsd);
        this.database
          .prepare(
            `INSERT INTO sg_billing_operation_parts
              (global_id, operation_id, part_id, outcome, actual_cost_nano_usd,
               charged_nano_usd, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .run(
            globalId,
            operationId,
            partId,
            params.outcome,
            actualCostNanoUsd,
            chargedNanoUsd,
            now,
            now,
          );
        this.database
          .prepare(
            `UPDATE sg_billing_operations
             SET actual_cost_nano_usd = ?, charged_nano_usd = ?, updated_at = ?
             WHERE global_id = ? AND operation_id = ?`,
          )
          .run(nextActual, nextCharged, now, globalId, operationId);
        this.database
          .prepare(
            `UPDATE sg_billing_accounts
             SET balance_nano_usd = ?, reserved_nano_usd = ?, updated_at = ?
             WHERE global_id = ?`,
          )
          .run(
            account.balance_nano_usd - chargedNanoUsd,
            account.reserved_nano_usd - chargedNanoUsd,
            now,
            globalId,
          );
      },
      {
        busyTimeoutMs: 5_000,
        databaseLabel: "sg-billing-ledger",
        operationLabel: "record-part",
      },
    );
  }

  async recordUnpricedPart(params: {
    globalId: string;
    operationId: string;
    partId: string;
  }): Promise<void> {
    const globalId = requireIdentifier(params.globalId, "global-id");
    const operationId = requireIdentifier(params.operationId, "operation-id");
    const partId = requireIdentifier(params.partId, "part-id");
    runSqliteImmediateTransactionSync(
      this.database,
      () => {
        const operation = this.operation(globalId, operationId);
        if (!operation || operation.operation_type !== "usage") {
          throw new Error("sg-billing-reservation-not-found");
        }
        if (operation.state !== "reserved") {
          throw new Error("sg-billing-reservation-invalid");
        }
        const existing = this.database
          .prepare(
            `SELECT outcome, authorized_nano_usd, actual_cost_nano_usd, charged_nano_usd
             FROM sg_billing_operation_parts
             WHERE global_id = ? AND operation_id = ? AND part_id = ?`,
          )
          .get(globalId, operationId, partId) as BillingPartRow | undefined;
        if (existing) {
          if (
            existing.outcome === "pending" &&
            existing.actual_cost_nano_usd === null &&
            existing.charged_nano_usd === null
          ) {
            return;
          }
          throw new Error("sg-billing-idempotency-conflict");
        }
        const now = Date.now();
        this.database
          .prepare(
            `INSERT INTO sg_billing_operation_parts
              (global_id, operation_id, part_id, outcome, created_at, updated_at)
             VALUES (?, ?, ?, 'pending', ?, ?)`,
          )
          .run(globalId, operationId, partId, now, now);
      },
      {
        busyTimeoutMs: 5_000,
        databaseLabel: "sg-billing-ledger",
        operationLabel: "record-unpriced-part",
      },
    );
  }

  async finalizeParts(params: {
    globalId: string;
    operationId: string;
    outcome: "completed" | "error";
  }): Promise<boolean> {
    const globalId = requireIdentifier(params.globalId, "global-id");
    const operationId = requireIdentifier(params.operationId, "operation-id");
    let finalized = false;
    runSqliteImmediateTransactionSync(
      this.database,
      () => {
        const operation = this.operation(globalId, operationId);
        if (!operation || operation.operation_type !== "usage") {
          throw new Error("sg-billing-reservation-not-found");
        }
        if (operation.state === "terminal") {
          if (operation.outcome === params.outcome) {
            finalized = true;
            return;
          }
          throw new Error("sg-billing-idempotency-conflict");
        }
        const unpriced = this.database
          .prepare(
            `SELECT COUNT(*) AS count
             FROM sg_billing_operation_parts
             WHERE global_id = ? AND operation_id = ? AND actual_cost_nano_usd IS NULL`,
          )
          .get(globalId, operationId) as { count: number };
        if (unpriced.count > 0) {
          return;
        }
        const chargedNanoUsd = operation.charged_nano_usd ?? 0;
        const actualCostNanoUsd = operation.actual_cost_nano_usd ?? 0;
        const remainingReserve = operation.amount_nano_usd - chargedNanoUsd;
        const account = this.account(globalId);
        const now = Date.now();
        this.database
          .prepare(
            `UPDATE sg_billing_operations
             SET state = 'terminal', outcome = ?, actual_cost_nano_usd = ?,
                 charged_nano_usd = ?, updated_at = ?
             WHERE global_id = ? AND operation_id = ?`,
          )
          .run(params.outcome, actualCostNanoUsd, chargedNanoUsd, now, globalId, operationId);
        this.database
          .prepare(
            `UPDATE sg_billing_accounts
             SET reserved_nano_usd = ?, updated_at = ?
             WHERE global_id = ?`,
          )
          .run(account.reserved_nano_usd - remainingReserve, now, globalId);
        this.database
          .prepare(
            `INSERT INTO sg_billing_entries
              (global_id, operation_id, entry_type, outcome,
               actual_cost_nano_usd, charged_nano_usd, created_at)
             VALUES (?, ?, 'complete', ?, ?, ?, ?)`,
          )
          .run(globalId, operationId, params.outcome, actualCostNanoUsd, chargedNanoUsd, now);
        finalized = true;
      },
      {
        busyTimeoutMs: 5_000,
        databaseLabel: "sg-billing-ledger",
        operationLabel: "finalize-parts",
      },
    );
    return finalized;
  }

  async complete(params: {
    globalId: string;
    operationId: string;
    outcome: "completed" | "error";
    actualCostNanoUsd?: number;
  }): Promise<void> {
    const globalId = requireIdentifier(params.globalId, "global-id");
    const operationId = requireIdentifier(params.operationId, "operation-id");
    const actualCostNanoUsd = requireNanoUsd(params.actualCostNanoUsd ?? 0, "actual-cost", true);
    const chargedNanoUsd = checkedCharge(actualCostNanoUsd);
    runSqliteImmediateTransactionSync(
      this.database,
      () => {
        const operation = this.operation(globalId, operationId);
        if (!operation || operation.operation_type !== "usage") {
          throw new Error("sg-billing-reservation-not-found");
        }
        if (operation.state === "terminal") {
          if (
            operation.outcome === params.outcome &&
            operation.actual_cost_nano_usd === actualCostNanoUsd &&
            operation.charged_nano_usd === chargedNanoUsd
          ) {
            return;
          }
          throw new Error("sg-billing-idempotency-conflict");
        }
        if (operation.state !== "reserved") {
          throw new Error("sg-billing-reservation-invalid");
        }
        const account = this.account(globalId);
        const fundsNotReservedElsewhere =
          account.balance_nano_usd - (account.reserved_nano_usd - operation.amount_nano_usd);
        if (fundsNotReservedElsewhere < chargedNanoUsd) {
          throw new Error("sg-billing-settlement-exceeds-prepaid-funds");
        }
        const now = Date.now();
        const balance = account.balance_nano_usd - chargedNanoUsd;
        const reserved = account.reserved_nano_usd - operation.amount_nano_usd;
        this.database
          .prepare(
            `UPDATE sg_billing_operations
             SET state = 'terminal', outcome = ?, actual_cost_nano_usd = ?,
                 charged_nano_usd = ?, updated_at = ?
             WHERE global_id = ? AND operation_id = ?`,
          )
          .run(params.outcome, actualCostNanoUsd, chargedNanoUsd, now, globalId, operationId);
        this.database
          .prepare(
            `UPDATE sg_billing_accounts
             SET balance_nano_usd = ?, reserved_nano_usd = ?, updated_at = ?
             WHERE global_id = ?`,
          )
          .run(balance, reserved, now, globalId);
        this.database
          .prepare(
            `INSERT INTO sg_billing_entries
              (global_id, operation_id, entry_type, outcome,
               actual_cost_nano_usd, charged_nano_usd, created_at)
             VALUES (?, ?, 'complete', ?, ?, ?, ?)`,
          )
          .run(globalId, operationId, params.outcome, actualCostNanoUsd, chargedNanoUsd, now);
      },
      { busyTimeoutMs: 5_000, databaseLabel: "sg-billing-ledger", operationLabel: "complete" },
    );
  }

  async snapshot(globalIdInput: string): Promise<SgBillingAccountSnapshot> {
    const globalId = requireIdentifier(globalIdInput, "global-id");
    const account = this.account(globalId);
    return {
      balanceNanoUsd: account.balance_nano_usd,
      reservedNanoUsd: account.reserved_nano_usd,
      availableNanoUsd: account.balance_nano_usd - account.reserved_nano_usd,
    };
  }

  async entries(globalIdInput: string): Promise<SgBillingEntry[]> {
    const globalId = requireIdentifier(globalIdInput, "global-id");
    const rows = this.database
      .prepare(
        `SELECT entry_id, global_id, operation_id, entry_type, amount_nano_usd,
                outcome, actual_cost_nano_usd, charged_nano_usd, created_at
         FROM sg_billing_entries
         WHERE global_id = ?
         ORDER BY entry_id ASC`,
      )
      .all(globalId) as BillingEntryRow[];
    return rows.map((row) => {
      const entry: SgBillingEntry = {
        entryId: row.entry_id,
        globalId: row.global_id,
        operationId: row.operation_id,
        type: row.entry_type,
        createdAt: row.created_at,
      };
      if (row.amount_nano_usd !== null) {
        entry.amountNanoUsd = row.amount_nano_usd;
      }
      if (row.outcome !== null) {
        entry.outcome = row.outcome;
      }
      if (row.actual_cost_nano_usd !== null) {
        entry.actualCostNanoUsd = row.actual_cost_nano_usd;
      }
      if (row.charged_nano_usd !== null) {
        entry.chargedNanoUsd = row.charged_nano_usd;
      }
      return entry;
    });
  }

  close(): void {
    if (!this.database.isOpen) {
      return;
    }
    this.walMaintenance.close({ checkpointMode: "TRUNCATE" });
    this.database.close();
  }
}
