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

export type SgBillingDiagnostics = {
  integrityOk: boolean;
  integrityMessage: string;
  foreignKeyViolationCount: number;
  accountCount: number;
  reservedOperationCount: number;
  blockedOperationCount: number;
  unpricedPartCount: number;
  reservedBalanceMismatchCount: number;
  oldestReservedAt?: number;
};

export type SgBillingFinancialUser = {
  globalId: string;
  role: "monarch" | "citizen";
  providerCostNanoUsd: number;
  chargedNanoUsd: number;
  profitNanoUsd: number;
  pendingOperationCount: number;
};

export type SgBillingFinancialReport = {
  attributedProviderCostNanoUsd: number;
  reconciliationAdjustmentNanoUsd: number;
  projectProviderCostNanoUsd: number;
  revenueNanoUsd: number;
  profitNanoUsd: number;
  monarchProviderCostNanoUsd: number;
  citizenProviderCostNanoUsd: number;
  pendingOperationCount: number;
  reconciliationWindowCount: number;
  lastReconciledAt?: number;
  users: SgBillingFinancialUser[];
};

export type SgBillingReconciliationWindow = {
  provider: "openai";
  projectId: string;
  windowStartMs: number;
  windowEndMs: number;
  providerCostNanoUsd: number;
  attributedCostNanoUsd: number;
  differenceNanoUsd: number;
  sourceDigest: string;
};

type BillingAccountRow = {
  balance_nano_usd: number;
  reserved_nano_usd: number;
};

type BillingOperationRow = {
  operation_type: "credit" | "usage";
  state: "credited" | "reserved" | "terminal";
  amount_nano_usd: number;
  billing_role: "monarch" | "citizen";
  charge_multiplier: 0 | 2;
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

type BillingAutomationOwnerRow = {
  global_id: string;
  role: "monarch" | "citizen";
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

function requireSignedNanoUsd(value: number, field: string): number {
  if (!Number.isSafeInteger(value)) {
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

function checkedCharge(actualCostNanoUsd: number, multiplier = CUSTOMER_PRICE_MULTIPLIER): number {
  const charge = actualCostNanoUsd * multiplier;
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
        billing_role TEXT NOT NULL DEFAULT 'citizen'
          CHECK (billing_role IN ('monarch', 'citizen')),
        charge_multiplier INTEGER NOT NULL DEFAULT 2 CHECK (charge_multiplier IN (0, 2)),
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

      CREATE TABLE IF NOT EXISTS sg_billing_automation_owners (
        job_id TEXT PRIMARY KEY,
        global_id TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('monarch', 'citizen')),
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      ) STRICT;

      CREATE TABLE IF NOT EXISTS sg_billing_reconciliation_windows (
        reconciliation_id INTEGER PRIMARY KEY AUTOINCREMENT,
        source_key TEXT NOT NULL,
        source_digest TEXT NOT NULL UNIQUE,
        provider TEXT NOT NULL CHECK (provider IN ('openai')),
        project_id TEXT NOT NULL,
        window_start_ms INTEGER NOT NULL,
        window_end_ms INTEGER NOT NULL,
        provider_cost_nano_usd INTEGER NOT NULL,
        attributed_cost_nano_usd INTEGER NOT NULL CHECK (attributed_cost_nano_usd >= 0),
        difference_nano_usd INTEGER NOT NULL,
        synced_at INTEGER NOT NULL,
        CHECK (window_end_ms > window_start_ms)
      ) STRICT;

      CREATE INDEX IF NOT EXISTS sg_billing_reconciliation_source_key_id
        ON sg_billing_reconciliation_windows(source_key, reconciliation_id);
    `);
    const operationColumns = this.database
      .prepare("PRAGMA table_info(sg_billing_operations)")
      .all() as Array<{ name: string }>;
    if (!operationColumns.some((column) => column.name === "billing_role")) {
      this.database.exec(
        "ALTER TABLE sg_billing_operations ADD COLUMN billing_role TEXT NOT NULL DEFAULT 'citizen' CHECK (billing_role IN ('monarch', 'citizen'))",
      );
    }
    if (!operationColumns.some((column) => column.name === "charge_multiplier")) {
      this.database.exec(
        "ALTER TABLE sg_billing_operations ADD COLUMN charge_multiplier INTEGER NOT NULL DEFAULT 2 CHECK (charge_multiplier IN (0, 2))",
      );
    }
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
        `SELECT operation_type, state, amount_nano_usd, billing_role, charge_multiplier, outcome,
                actual_cost_nano_usd, charged_nano_usd
         FROM sg_billing_operations
         WHERE global_id = ? AND operation_id = ?`,
      )
      .get(globalId, operationId) as BillingOperationRow | undefined;
  }

  async startTrackedOperation(params: {
    globalId: string;
    operationId: string;
    role: "monarch";
  }): Promise<void> {
    const globalId = requireIdentifier(params.globalId, "global-id");
    const operationId = requireIdentifier(params.operationId, "operation-id");
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
            existing.amount_nano_usd === 0 &&
            existing.billing_role === params.role &&
            existing.charge_multiplier === 0
          ) {
            return;
          }
          throw new Error("sg-billing-idempotency-conflict");
        }
        this.database
          .prepare(
            `INSERT INTO sg_billing_operations
              (global_id, operation_id, operation_type, state, amount_nano_usd,
               billing_role, charge_multiplier, created_at, updated_at)
             VALUES (?, ?, 'usage', 'reserved', 0, ?, 0, ?, ?)`,
          )
          .run(globalId, operationId, params.role, now, now);
      },
      {
        busyTimeoutMs: 5_000,
        databaseLabel: "sg-billing-ledger",
        operationLabel: "start-tracked-operation",
      },
    );
  }

  async operationBilling(params: {
    globalId: string;
    operationId: string;
  }): Promise<{ role: "monarch" | "citizen"; chargeMultiplier: 0 | 2 }> {
    const globalId = requireIdentifier(params.globalId, "global-id");
    const operationId = requireIdentifier(params.operationId, "operation-id");
    const operation = this.operation(globalId, operationId);
    if (!operation || operation.operation_type !== "usage") {
      throw new Error("sg-billing-reservation-not-found");
    }
    return {
      role: operation.billing_role,
      chargeMultiplier: operation.charge_multiplier,
    };
  }

  async bindAutomationOwner(params: {
    jobId: string;
    globalId: string;
    role: "monarch" | "citizen";
  }): Promise<void> {
    const jobId = requireIdentifier(params.jobId, "job-id");
    const globalId = requireIdentifier(params.globalId, "global-id");
    runSqliteImmediateTransactionSync(
      this.database,
      () => {
        const existing = this.database
          .prepare(`SELECT global_id, role FROM sg_billing_automation_owners WHERE job_id = ?`)
          .get(jobId) as BillingAutomationOwnerRow | undefined;
        if (existing) {
          if (existing.global_id === globalId && existing.role === params.role) {
            return;
          }
          throw new Error("sg-billing-idempotency-conflict");
        }
        const now = Date.now();
        this.database
          .prepare(
            `INSERT INTO sg_billing_automation_owners
              (job_id, global_id, role, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?)`,
          )
          .run(jobId, globalId, params.role, now, now);
      },
      {
        busyTimeoutMs: 5_000,
        databaseLabel: "sg-billing-ledger",
        operationLabel: "bind-automation-owner",
      },
    );
  }

  async resolveAutomationOwner(
    jobIdInput: string,
  ): Promise<{ globalId: string; role: "monarch" | "citizen" } | undefined> {
    const jobId = requireIdentifier(jobIdInput, "job-id");
    const row = this.database
      .prepare(`SELECT global_id, role FROM sg_billing_automation_owners WHERE job_id = ?`)
      .get(jobId) as BillingAutomationOwnerRow | undefined;
    return row ? { globalId: row.global_id, role: row.role } : undefined;
  }

  async unbindAutomationOwner(jobIdInput: string): Promise<void> {
    const jobId = requireIdentifier(jobIdInput, "job-id");
    this.database.prepare(`DELETE FROM sg_billing_automation_owners WHERE job_id = ?`).run(jobId);
  }

  async actualCostForWindow(params: { startMs: number; endMs: number }): Promise<number> {
    const startMs = requireNanoUsd(params.startMs, "window-start", true);
    const endMs = requireNanoUsd(params.endMs, "window-end");
    if (endMs <= startMs) {
      throw new Error("sg-billing-window-invalid");
    }
    const row = this.database
      .prepare(
        `SELECT COALESCE(SUM(actual_cost_nano_usd), 0) AS total
         FROM sg_billing_operations
         WHERE operation_type = 'usage'
           AND created_at >= ? AND created_at < ?`,
      )
      .get(startMs, endMs) as { total: number };
    return row.total;
  }

  async recordReconciliationWindow(params: SgBillingReconciliationWindow): Promise<void> {
    const projectId = requireIdentifier(params.projectId, "project-id");
    const sourceDigest = requireIdentifier(params.sourceDigest, "source-digest");
    const windowStartMs = requireNanoUsd(params.windowStartMs, "window-start", true);
    const windowEndMs = requireNanoUsd(params.windowEndMs, "window-end");
    const providerCostNanoUsd = requireSignedNanoUsd(params.providerCostNanoUsd, "provider-cost");
    const attributedCostNanoUsd = requireNanoUsd(
      params.attributedCostNanoUsd,
      "attributed-cost",
      true,
    );
    const differenceNanoUsd = requireSignedNanoUsd(params.differenceNanoUsd, "difference");
    if (
      windowEndMs <= windowStartMs ||
      differenceNanoUsd !== providerCostNanoUsd - attributedCostNanoUsd
    ) {
      throw new Error("sg-billing-reconciliation-invalid");
    }
    const sourceKey = `${params.provider}:${projectId}:${windowStartMs}:${windowEndMs}`;
    runSqliteImmediateTransactionSync(
      this.database,
      () => {
        const existing = this.database
          .prepare(
            `SELECT source_key FROM sg_billing_reconciliation_windows WHERE source_digest = ?`,
          )
          .get(sourceDigest) as { source_key: string } | undefined;
        if (existing) {
          if (existing.source_key === sourceKey) {
            return;
          }
          throw new Error("sg-billing-idempotency-conflict");
        }
        this.database
          .prepare(
            `INSERT INTO sg_billing_reconciliation_windows
              (source_key, source_digest, provider, project_id, window_start_ms, window_end_ms,
               provider_cost_nano_usd, attributed_cost_nano_usd, difference_nano_usd, synced_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .run(
            sourceKey,
            sourceDigest,
            params.provider,
            projectId,
            windowStartMs,
            windowEndMs,
            providerCostNanoUsd,
            attributedCostNanoUsd,
            differenceNanoUsd,
            Date.now(),
          );
      },
      {
        busyTimeoutMs: 5_000,
        databaseLabel: "sg-billing-ledger",
        operationLabel: "record-reconciliation-window",
      },
    );
  }

  async financialReport(): Promise<SgBillingFinancialReport> {
    const usageRows = this.database
      .prepare(
        `SELECT global_id, billing_role,
                COALESCE(SUM(actual_cost_nano_usd), 0) AS provider_cost,
                COALESCE(SUM(charged_nano_usd), 0) AS charged,
                SUM(CASE WHEN state = 'reserved' THEN 1 ELSE 0 END) AS pending
         FROM sg_billing_operations
         WHERE operation_type = 'usage'
         GROUP BY global_id, billing_role
         ORDER BY global_id, billing_role`,
      )
      .all() as Array<{
      global_id: string;
      billing_role: "monarch" | "citizen";
      provider_cost: number;
      charged: number;
      pending: number;
    }>;
    const reconciliation = this.database
      .prepare(
        `SELECT COALESCE(SUM(current.difference_nano_usd), 0) AS adjustment,
                COUNT(*) AS windows,
                MAX(current.synced_at) AS last_synced
         FROM sg_billing_reconciliation_windows AS current
         WHERE current.reconciliation_id = (
           SELECT MAX(latest.reconciliation_id)
           FROM sg_billing_reconciliation_windows AS latest
           WHERE latest.source_key = current.source_key
         )`,
      )
      .get() as { adjustment: number; windows: number; last_synced: number | null };
    const users = usageRows.map(
      (row): SgBillingFinancialUser => ({
        globalId: row.global_id,
        role: row.billing_role,
        providerCostNanoUsd: row.provider_cost,
        chargedNanoUsd: row.charged,
        profitNanoUsd: row.charged - row.provider_cost,
        pendingOperationCount: row.pending,
      }),
    );
    const attributedProviderCostNanoUsd = users.reduce(
      (total, user) => checkedAdd(total, user.providerCostNanoUsd),
      0,
    );
    const revenueNanoUsd = users
      .filter((user) => user.role === "citizen")
      .reduce((total, user) => checkedAdd(total, user.chargedNanoUsd), 0);
    const projectProviderCostNanoUsd = checkedAdd(
      attributedProviderCostNanoUsd,
      reconciliation.adjustment,
    );
    return {
      attributedProviderCostNanoUsd,
      reconciliationAdjustmentNanoUsd: reconciliation.adjustment,
      projectProviderCostNanoUsd,
      revenueNanoUsd,
      profitNanoUsd: revenueNanoUsd - projectProviderCostNanoUsd,
      monarchProviderCostNanoUsd: users
        .filter((user) => user.role === "monarch")
        .reduce((total, user) => checkedAdd(total, user.providerCostNanoUsd), 0),
      citizenProviderCostNanoUsd: users
        .filter((user) => user.role === "citizen")
        .reduce((total, user) => checkedAdd(total, user.providerCostNanoUsd), 0),
      pendingOperationCount: users.reduce(
        (total, user) => checkedAdd(total, user.pendingOperationCount),
        0,
      ),
      reconciliationWindowCount: reconciliation.windows,
      ...(reconciliation.last_synced === null
        ? {}
        : { lastReconciledAt: reconciliation.last_synced }),
      users,
    };
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
        const chargedNanoUsd =
          actualCostNanoUsd === undefined
            ? undefined
            : checkedCharge(actualCostNanoUsd, operation.charge_multiplier);
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
    runSqliteImmediateTransactionSync(
      this.database,
      () => {
        const operation = this.operation(globalId, operationId);
        if (!operation || operation.operation_type !== "usage") {
          throw new Error("sg-billing-reservation-not-found");
        }
        const chargedNanoUsd = checkedCharge(actualCostNanoUsd, operation.charge_multiplier);
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

  async recentEntries(globalIdInput: string, limitInput = 20): Promise<SgBillingEntry[]> {
    const globalId = requireIdentifier(globalIdInput, "global-id");
    const limit = requireNanoUsd(limitInput, "entry-limit");
    const rows = this.database
      .prepare(
        `SELECT entry_id, global_id, operation_id, entry_type, amount_nano_usd,
                outcome, actual_cost_nano_usd, charged_nano_usd, created_at
         FROM sg_billing_entries
         WHERE global_id = ?
         ORDER BY entry_id DESC
         LIMIT ?`,
      )
      .all(globalId, limit) as BillingEntryRow[];
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

  async diagnostics(): Promise<SgBillingDiagnostics> {
    const integrityRows = this.database.prepare("PRAGMA quick_check").all() as Array<{
      quick_check: string;
    }>;
    const integrityMessage = integrityRows.map((row) => row.quick_check).join("; ") || "unknown";
    const foreignKeyViolationCount = this.database.prepare("PRAGMA foreign_key_check").all().length;
    const accountCount = (
      this.database.prepare("SELECT COUNT(*) AS count FROM sg_billing_accounts").get() as {
        count: number;
      }
    ).count;
    const reserved = this.database
      .prepare(
        `SELECT COUNT(*) AS count, MIN(created_at) AS oldest
         FROM sg_billing_operations
         WHERE operation_type = 'usage' AND state = 'reserved'`,
      )
      .get() as { count: number; oldest: number | null };
    const unresolved = this.database
      .prepare(
        `SELECT COUNT(*) AS parts, COUNT(DISTINCT global_id || char(0) || operation_id) AS operations
         FROM sg_billing_operation_parts
         WHERE actual_cost_nano_usd IS NULL
           AND (authorized_nano_usd IS NULL OR outcome != 'pending')`,
      )
      .get() as { parts: number; operations: number };
    const reservedBalanceMismatchCount = (
      this.database
        .prepare(
          `SELECT COUNT(*) AS count
           FROM sg_billing_accounts AS accounts
           LEFT JOIN (
             SELECT global_id,
                    SUM(amount_nano_usd - COALESCE(charged_nano_usd, 0)) AS expected_reserved
             FROM sg_billing_operations
             WHERE operation_type = 'usage' AND state = 'reserved'
             GROUP BY global_id
           ) AS operations ON operations.global_id = accounts.global_id
           WHERE accounts.reserved_nano_usd != COALESCE(operations.expected_reserved, 0)`,
        )
        .get() as { count: number }
    ).count;
    return {
      integrityOk: integrityMessage === "ok",
      integrityMessage,
      foreignKeyViolationCount,
      accountCount,
      reservedOperationCount: reserved.count,
      blockedOperationCount: unresolved.operations,
      unpricedPartCount: unresolved.parts,
      reservedBalanceMismatchCount,
      ...(reserved.oldest !== null ? { oldestReservedAt: reserved.oldest } : {}),
    };
  }

  close(): void {
    if (!this.database.isOpen) {
      return;
    }
    this.walMaintenance.close({ checkpointMode: "TRUNCATE" });
    this.database.close();
  }
}
