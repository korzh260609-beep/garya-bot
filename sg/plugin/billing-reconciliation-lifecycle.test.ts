import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SgBillingLedger } from "./billing-ledger.js";
import { registerSgBillingReconciliation } from "./billing-reconciliation-lifecycle.js";

const roots: string[] = [];

afterEach(async () => {
  vi.useRealTimers();
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function fixture(env: NodeJS.ProcessEnv) {
  const stateDir = await mkdtemp(path.join(os.tmpdir(), "sg-billing-lifecycle-"));
  roots.push(stateDir);
  const hooks = new Map<string, Array<() => void | Promise<void>>>();
  const info = vi.fn();
  const warn = vi.fn();
  const fetchFn = vi.fn(
    async () =>
      new Response(
        JSON.stringify({
          data: [
            {
              start_time: 1_789_171_200,
              end_time: 1_789_257_600,
              results: [{ amount: { value: "0.75", currency: "usd" } }],
            },
          ],
          has_more: false,
        }),
        { status: 200 },
      ),
  ) as typeof fetch;
  registerSgBillingReconciliation({
    stateDir,
    env,
    fetchFn,
    now: () => Date.parse("2026-09-19T08:00:00.000Z"),
    api: {
      on: (event, handler) => hooks.set(event, [...(hooks.get(event) ?? []), handler]),
      logger: { info, warn },
    },
  });
  return { stateDir, hooks, fetchFn, info, warn };
}

describe("SG billing reconciliation lifecycle", () => {
  it("runs automatically at gateway start when dedicated Admin credentials exist", async () => {
    const test = await fixture({
      OPENAI_ADMIN_KEY: "sk-admin-test",
      OPENAI_PROJECT_ID: "proj_sg",
    });
    for (const hook of test.hooks.get("gateway_start") ?? []) {
      await hook();
    }
    await vi.waitFor(() => expect(test.info).toHaveBeenCalledOnce());
    expect(test.fetchFn).toHaveBeenCalledOnce();
    const ledger = new SgBillingLedger(test.stateDir);
    await expect(ledger.financialReport()).resolves.toMatchObject({
      reconciliationWindowCount: 7,
      reconciliationAdjustmentNanoUsd: 750_000_000,
    });
    ledger.close();
    for (const hook of test.hooks.get("gateway_stop") ?? []) {
      await hook();
    }
  });

  it("does not call the provider or block startup when Admin credentials are absent", async () => {
    const test = await fixture({});
    for (const hook of test.hooks.get("gateway_start") ?? []) {
      await hook();
    }
    expect(test.fetchFn).not.toHaveBeenCalled();
    expect(test.warn).not.toHaveBeenCalled();
    for (const hook of test.hooks.get("gateway_stop") ?? []) {
      await hook();
    }
  });
});
