import { mkdir, mkdtemp, realpath, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, describe, expect, it } from "vitest";
import { SgBillingLedger, usdToNanoUsd } from "./billing-ledger.js";
import { resolveWorkspaceContext } from "./context.js";

const openedLedgers: SgBillingLedger[] = [];
const temporaryRoots: string[] = [];

async function openLedger() {
  const root = await realpath(await mkdtemp(path.join(os.tmpdir(), "sg-billing-ledger-")));
  const ledger = new SgBillingLedger(root);
  temporaryRoots.push(root);
  openedLedgers.push(ledger);
  return { ledger, root };
}

async function credit(
  ledger: SgBillingLedger,
  globalId: string,
  amountNanoUsd: number,
  creditId = `credit:${globalId}`,
) {
  await ledger.credit({ globalId, creditId, amountNanoUsd });
}

afterEach(async () => {
  for (const ledger of openedLedgers.splice(0)) {
    ledger.close();
  }
  await Promise.all(
    temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

describe("SG prepaid billing ledger", () => {
  it("stores USD costs as exact integer nano-USD", () => {
    expect(usdToNanoUsd(0.0003165)).toBe(316_500);
    expect(Number.isSafeInteger(usdToNanoUsd(0.0000000125))).toBe(true);
  });

  it("credits one Global ID and reports its available balance", async () => {
    const { ledger } = await openLedger();

    await credit(ledger, "usr_one", 1_000_000);

    await expect(ledger.snapshot("usr_one")).resolves.toEqual({
      balanceNanoUsd: 1_000_000,
      reservedNanoUsd: 0,
      availableNanoUsd: 1_000_000,
    });
  });

  it("reserves funds without charging them", async () => {
    const { ledger } = await openLedger();
    await credit(ledger, "usr_one", 1_000);

    await ledger.reserve({ globalId: "usr_one", operationId: "run:one", amountNanoUsd: 400 });

    await expect(ledger.snapshot("usr_one")).resolves.toEqual({
      balanceNanoUsd: 1_000,
      reservedNanoUsd: 400,
      availableNanoUsd: 600,
    });
  });

  it("rejects an unaffordable reservation without changing account state", async () => {
    const { ledger } = await openLedger();
    await credit(ledger, "usr_one", 300);

    await expect(
      ledger.reserve({ globalId: "usr_one", operationId: "run:too-expensive", amountNanoUsd: 400 }),
    ).rejects.toThrow("sg-billing-insufficient-funds");
    await expect(ledger.snapshot("usr_one")).resolves.toEqual({
      balanceNanoUsd: 300,
      reservedNanoUsd: 0,
      availableNanoUsd: 300,
    });
  });

  it("charges actual provider cost times two and releases the unused reserve", async () => {
    const { ledger } = await openLedger();
    await credit(ledger, "usr_one", 1_000_000);
    await ledger.reserve({
      globalId: "usr_one",
      operationId: "call:model-one",
      amountNanoUsd: 800_000,
    });

    await ledger.complete({
      globalId: "usr_one",
      operationId: "call:model-one",
      outcome: "completed",
      actualCostNanoUsd: 316_500,
    });

    await expect(ledger.snapshot("usr_one")).resolves.toEqual({
      balanceNanoUsd: 367_000,
      reservedNanoUsd: 0,
      availableNanoUsd: 367_000,
    });
    await expect(ledger.entries("usr_one")).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          operationId: "call:model-one",
          type: "complete",
          outcome: "completed",
          actualCostNanoUsd: 316_500,
          chargedNanoUsd: 633_000,
        }),
      ]),
    );
  });

  it("does not charge a duplicate terminal event twice", async () => {
    const { ledger } = await openLedger();
    await credit(ledger, "usr_one", 1_000);
    await ledger.reserve({
      globalId: "usr_one",
      operationId: "call:duplicate",
      amountNanoUsd: 600,
    });
    const terminal = {
      globalId: "usr_one",
      operationId: "call:duplicate",
      outcome: "completed" as const,
      actualCostNanoUsd: 200,
    };

    await ledger.complete(terminal);
    await ledger.complete(terminal);

    await expect(ledger.snapshot("usr_one")).resolves.toEqual({
      balanceNanoUsd: 600,
      reservedNanoUsd: 0,
      availableNanoUsd: 600,
    });
    const terminalEntries = (await ledger.entries("usr_one")).filter(
      (entry) => entry.operationId === "call:duplicate" && entry.type === "complete",
    );
    expect(terminalEntries).toHaveLength(1);
  });

  it("releases the full reserve when an error incurred no provider cost", async () => {
    const { ledger } = await openLedger();
    await credit(ledger, "usr_one", 1_000);
    await ledger.reserve({
      globalId: "usr_one",
      operationId: "call:no-cost-error",
      amountNanoUsd: 600,
    });

    await ledger.complete({
      globalId: "usr_one",
      operationId: "call:no-cost-error",
      outcome: "error",
    });

    await expect(ledger.snapshot("usr_one")).resolves.toEqual({
      balanceNanoUsd: 1_000,
      reservedNanoUsd: 0,
      availableNanoUsd: 1_000,
    });
  });

  it("charges billed error usage times two before releasing the reserve", async () => {
    const { ledger } = await openLedger();
    await credit(ledger, "usr_one", 1_000);
    await ledger.reserve({
      globalId: "usr_one",
      operationId: "call:billed-error",
      amountNanoUsd: 600,
    });

    await ledger.complete({
      globalId: "usr_one",
      operationId: "call:billed-error",
      outcome: "error",
      actualCostNanoUsd: 125,
    });

    await expect(ledger.snapshot("usr_one")).resolves.toEqual({
      balanceNanoUsd: 750,
      reservedNanoUsd: 0,
      availableNanoUsd: 750,
    });
  });

  it("shares one balance between Telegram DM and group context for the same Global ID", async () => {
    const { ledger, root } = await openLedger();
    const direct = await resolveWorkspaceContext(
      { channel: "telegram", senderId: "123", to: "telegram:123" },
      root,
    );
    const group = await resolveWorkspaceContext(
      { channel: "telegram", senderId: "123", to: "telegram:-100456" },
      root,
    );
    expect(group.globalId).toBe(direct.globalId);
    const globalId = direct.globalId;
    if (!globalId) {
      throw new Error("test Global ID was not resolved");
    }
    await credit(ledger, globalId, 1_000);

    await ledger.reserve({ globalId, operationId: "group:run", amountNanoUsd: 300 });

    await expect(ledger.snapshot(globalId)).resolves.toEqual({
      balanceNanoUsd: 1_000,
      reservedNanoUsd: 300,
      availableNanoUsd: 700,
    });
  });

  it("isolates balances and reservations between Global IDs", async () => {
    const { ledger } = await openLedger();
    await credit(ledger, "usr_a", 1_000);
    await credit(ledger, "usr_b", 2_000);

    await ledger.reserve({ globalId: "usr_a", operationId: "run:a", amountNanoUsd: 400 });

    await expect(ledger.snapshot("usr_a")).resolves.toMatchObject({ availableNanoUsd: 600 });
    await expect(ledger.snapshot("usr_b")).resolves.toEqual({
      balanceNanoUsd: 2_000,
      reservedNanoUsd: 0,
      availableNanoUsd: 2_000,
    });
  });

  it("serializes concurrent reservations and prevents double spending", async () => {
    const { ledger } = await openLedger();
    await credit(ledger, "usr_one", 100);

    const results = await Promise.allSettled([
      ledger.reserve({ globalId: "usr_one", operationId: "run:first", amountNanoUsd: 80 }),
      ledger.reserve({ globalId: "usr_one", operationId: "run:second", amountNanoUsd: 80 }),
    ]);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    await expect(ledger.snapshot("usr_one")).resolves.toEqual({
      balanceNanoUsd: 100,
      reservedNanoUsd: 80,
      availableNanoUsd: 20,
    });
  });

  it("atomically bounds concurrent provider authorizations within one reservation", async () => {
    const { ledger } = await openLedger();
    await credit(ledger, "usr_one", 1_000);
    await ledger.reserve({ globalId: "usr_one", operationId: "run:bounded", amountNanoUsd: 1_000 });

    const results = await Promise.allSettled([
      ledger.authorizePart({
        globalId: "usr_one",
        operationId: "run:bounded",
        partId: "model:first",
        authorizedNanoUsd: 700,
      }),
      ledger.authorizePart({
        globalId: "usr_one",
        operationId: "run:bounded",
        partId: "model:second",
        authorizedNanoUsd: 700,
      }),
    ]);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    await expect(
      ledger.prepaidCapacity({ globalId: "usr_one", operationId: "run:bounded" }),
    ).resolves.toEqual({ remainingNanoUsd: 300, hasUnpricedParts: false });
  });

  it("converts a pending unpriced media part into a bounded authorization", async () => {
    const { ledger } = await openLedger();
    await credit(ledger, "usr_one", 1_000);
    await ledger.reserve({ globalId: "usr_one", operationId: "run:media", amountNanoUsd: 1_000 });
    await ledger.recordUnpricedPart({
      globalId: "usr_one",
      operationId: "run:media",
      partId: "tool:media",
    });

    await ledger.authorizePart({
      globalId: "usr_one",
      operationId: "run:media",
      partId: "tool:media",
      authorizedNanoUsd: 800,
    });

    await expect(
      ledger.prepaidCapacity({ globalId: "usr_one", operationId: "run:media" }),
    ).resolves.toEqual({ remainingNanoUsd: 200, hasUnpricedParts: false });
  });

  it("blocks further capacity after an authorized part ends without an exact cost", async () => {
    const { ledger } = await openLedger();
    await credit(ledger, "usr_one", 1_000);
    await ledger.reserve({ globalId: "usr_one", operationId: "run:unknown", amountNanoUsd: 1_000 });
    await ledger.authorizePart({
      globalId: "usr_one",
      operationId: "run:unknown",
      partId: "model:unknown",
      authorizedNanoUsd: 700,
    });
    await ledger.recordPart({
      globalId: "usr_one",
      operationId: "run:unknown",
      partId: "model:unknown",
      outcome: "completed",
    });

    await expect(
      ledger.prepaidCapacity({ globalId: "usr_one", operationId: "run:unknown" }),
    ).resolves.toEqual({ remainingNanoUsd: 1_000, hasUnpricedParts: true });
  });

  it("persists balance, reservation, idempotency, and journal across reopen", async () => {
    const { ledger, root } = await openLedger();
    await credit(ledger, "usr_one", 1_000);
    await ledger.reserve({
      globalId: "usr_one",
      operationId: "call:persisted",
      amountNanoUsd: 600,
    });
    ledger.close();
    openedLedgers.splice(openedLedgers.indexOf(ledger), 1);

    const reopened = new SgBillingLedger(root);
    openedLedgers.push(reopened);
    await reopened.complete({
      globalId: "usr_one",
      operationId: "call:persisted",
      outcome: "completed",
      actualCostNanoUsd: 200,
    });
    await reopened.complete({
      globalId: "usr_one",
      operationId: "call:persisted",
      outcome: "completed",
      actualCostNanoUsd: 200,
    });

    await expect(reopened.snapshot("usr_one")).resolves.toEqual({
      balanceNanoUsd: 600,
      reservedNanoUsd: 0,
      availableNanoUsd: 600,
    });
    const terminalEntries = (await reopened.entries("usr_one")).filter(
      (entry) => entry.operationId === "call:persisted" && entry.type === "complete",
    );
    expect(terminalEntries).toHaveLength(1);
  });

  it("records Monarch provider expense without reserving or charging a prepaid balance", async () => {
    const { ledger } = await openLedger();

    await ledger.startTrackedOperation({
      globalId: "usr_monarch",
      operationId: "run:monarch",
      role: "monarch",
    });
    await ledger.recordPart({
      globalId: "usr_monarch",
      operationId: "run:monarch",
      partId: "model:one",
      outcome: "completed",
      actualCostNanoUsd: 125_000,
    });
    await ledger.finalizeParts({
      globalId: "usr_monarch",
      operationId: "run:monarch",
      outcome: "completed",
    });

    await expect(ledger.snapshot("usr_monarch")).resolves.toEqual({
      balanceNanoUsd: 0,
      reservedNanoUsd: 0,
      availableNanoUsd: 0,
    });
    await expect(ledger.entries("usr_monarch")).resolves.toEqual([
      expect.objectContaining({
        operationId: "run:monarch",
        type: "complete",
        actualCostNanoUsd: 125_000,
        chargedNanoUsd: 0,
      }),
    ]);
  });

  it("persists trusted automation ownership idempotently and rejects reassignment", async () => {
    const { ledger, root } = await openLedger();
    const binding = { jobId: "job-daily", globalId: "usr_monarch", role: "monarch" as const };

    await ledger.bindAutomationOwner(binding);
    await ledger.bindAutomationOwner(binding);
    await expect(ledger.resolveAutomationOwner("job-daily")).resolves.toEqual({
      globalId: "usr_monarch",
      role: "monarch",
    });
    await expect(
      ledger.bindAutomationOwner({
        jobId: "job-daily",
        globalId: "usr_other",
        role: "citizen",
      }),
    ).rejects.toThrow("sg-billing-idempotency-conflict");

    ledger.close();
    openedLedgers.splice(openedLedgers.indexOf(ledger), 1);
    const reopened = new SgBillingLedger(root);
    openedLedgers.push(reopened);
    await expect(reopened.resolveAutomationOwner("job-daily")).resolves.toEqual({
      globalId: "usr_monarch",
      role: "monarch",
    });
  });

  it("migrates a legacy billing database to the role-aware operation schema", async () => {
    const root = await realpath(await mkdtemp(path.join(os.tmpdir(), "sg-billing-legacy-")));
    temporaryRoots.push(root);
    const directory = path.join(root, "sg");
    await mkdir(directory, { recursive: true });
    const legacy = new DatabaseSync(path.join(directory, "billing.sqlite"));
    legacy.exec(`
      CREATE TABLE sg_billing_operations (
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
        PRIMARY KEY (global_id, operation_id)
      ) STRICT;
    `);
    legacy.close();

    const ledger = new SgBillingLedger(root);
    openedLedgers.push(ledger);
    await credit(ledger, "usr_legacy", 1_000);
    await ledger.reserve({ globalId: "usr_legacy", operationId: "run:legacy", amountNanoUsd: 500 });
    await expect(
      ledger.operationBilling({ globalId: "usr_legacy", operationId: "run:legacy" }),
    ).resolves.toEqual({ role: "citizen", chargeMultiplier: 2 });
  });

  it("reports project, Monarch and per-user cost, revenue and profit without treating topups as revenue", async () => {
    const { ledger } = await openLedger();
    await credit(ledger, "usr_citizen", 10_000, "topup:not-revenue");
    await ledger.reserve({
      globalId: "usr_citizen",
      operationId: "run:citizen-report",
      amountNanoUsd: 1_000,
    });
    await ledger.complete({
      globalId: "usr_citizen",
      operationId: "run:citizen-report",
      outcome: "completed",
      actualCostNanoUsd: 100,
    });
    await ledger.startTrackedOperation({
      globalId: "usr_monarch",
      operationId: "run:monarch-report",
      role: "monarch",
    });
    await ledger.recordPart({
      globalId: "usr_monarch",
      operationId: "run:monarch-report",
      partId: "model:report",
      outcome: "completed",
      actualCostNanoUsd: 50,
    });
    await ledger.finalizeParts({
      globalId: "usr_monarch",
      operationId: "run:monarch-report",
      outcome: "completed",
    });
    await ledger.recordReconciliationWindow({
      provider: "openai",
      projectId: "proj_sg",
      windowStartMs: 1,
      windowEndMs: 2,
      providerCostNanoUsd: 200,
      attributedCostNanoUsd: 150,
      differenceNanoUsd: 50,
      sourceDigest: "digest:one",
    });
    await ledger.recordReconciliationWindow({
      provider: "openai",
      projectId: "proj_sg",
      windowStartMs: 1,
      windowEndMs: 2,
      providerCostNanoUsd: 200,
      attributedCostNanoUsd: 150,
      differenceNanoUsd: 50,
      sourceDigest: "digest:one",
    });

    await expect(ledger.financialReport()).resolves.toMatchObject({
      attributedProviderCostNanoUsd: 150,
      reconciliationAdjustmentNanoUsd: 50,
      projectProviderCostNanoUsd: 200,
      revenueNanoUsd: 200,
      profitNanoUsd: 0,
      monarchProviderCostNanoUsd: 50,
      citizenProviderCostNanoUsd: 100,
      reconciliationWindowCount: 1,
      users: [
        {
          globalId: "usr_citizen",
          role: "citizen",
          providerCostNanoUsd: 100,
          chargedNanoUsd: 200,
          profitNanoUsd: 100,
          pendingOperationCount: 0,
        },
        {
          globalId: "usr_monarch",
          role: "monarch",
          providerCostNanoUsd: 50,
          chargedNanoUsd: 0,
          profitNanoUsd: -50,
          pendingOperationCount: 0,
        },
      ],
    });
  });

  it("uses only the newest reconciliation revision for an overlapping provider window", async () => {
    const { ledger } = await openLedger();
    await ledger.recordReconciliationWindow({
      provider: "openai",
      projectId: "proj_sg",
      windowStartMs: 10,
      windowEndMs: 20,
      providerCostNanoUsd: 100,
      attributedCostNanoUsd: 0,
      differenceNanoUsd: 100,
      sourceDigest: "digest:old",
    });
    await ledger.recordReconciliationWindow({
      provider: "openai",
      projectId: "proj_sg",
      windowStartMs: 10,
      windowEndMs: 20,
      providerCostNanoUsd: 125,
      attributedCostNanoUsd: 0,
      differenceNanoUsd: 125,
      sourceDigest: "digest:new",
    });

    await expect(ledger.financialReport()).resolves.toMatchObject({
      reconciliationAdjustmentNanoUsd: 125,
      projectProviderCostNanoUsd: 125,
      reconciliationWindowCount: 1,
    });
  });
});
