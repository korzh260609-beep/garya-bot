import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SgBillingLedger } from "./billing-ledger.js";
import { reconcileOpenAiBilling } from "./billing-openai-reconciliation.js";

const roots: string[] = [];

async function stateDir() {
  const root = await mkdtemp(path.join(os.tmpdir(), "sg-billing-admin-"));
  roots.push(root);
  return root;
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("SG OpenAI billing reconciliation", () => {
  it("fetches every Admin API page and records replay-safe closed daily windows", async () => {
    const root = await stateDir();
    const calls: URL[] = [];
    const fetchFn = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = new URL(input instanceof Request ? input.url : input);
      calls.push(url);
      expect(init?.headers).toMatchObject({ Authorization: "Bearer sk-admin-test" });
      if (!url.searchParams.has("page")) {
        return new Response(
          JSON.stringify({
            data: [
              {
                start_time: 1_789_603_200,
                end_time: 1_789_689_600,
                results: [{ amount: { value: "1.25", currency: "usd" } }],
              },
            ],
            has_more: true,
            next_page: "page-two",
          }),
          { status: 200 },
        );
      }
      return new Response(
        JSON.stringify({
          data: [
            {
              start_time: 1_789_689_600,
              end_time: 1_789_776_000,
              results: [{ amount: { value: "0.5000000004", currency: "USD" } }],
            },
          ],
          has_more: false,
        }),
        { status: 200 },
      );
    }) as typeof fetch;
    const options = {
      stateDir: root,
      env: { OPENAI_ADMIN_KEY: "sk-admin-test", OPENAI_PROJECT_ID: "proj_sg" },
      fetchFn,
      now: Date.parse("2026-09-19T08:00:00.000Z"),
      days: 2,
    };

    await expect(reconcileOpenAiBilling(options)).resolves.toEqual({
      projectId: "proj_sg",
      startMs: Date.parse("2026-09-17T00:00:00.000Z"),
      endMs: Date.parse("2026-09-19T00:00:00.000Z"),
      windowCount: 2,
      providerCostNanoUsd: 1_750_000_000,
      attributedCostNanoUsd: 0,
      differenceNanoUsd: 1_750_000_000,
    });
    await reconcileOpenAiBilling(options);

    expect(calls).toHaveLength(4);
    expect(calls[0]?.searchParams.get("project_ids[]")).toBe("proj_sg");
    expect(calls[0]?.searchParams.get("group_by[]")).toBe("line_item");
    expect(calls[0]?.searchParams.get("bucket_width")).toBe("1d");
    expect(calls[1]?.searchParams.get("page")).toBe("page-two");
    const ledger = new SgBillingLedger(root);
    await expect(ledger.financialReport()).resolves.toMatchObject({
      reconciliationAdjustmentNanoUsd: 1_750_000_000,
      projectProviderCostNanoUsd: 1_750_000_000,
      reconciliationWindowCount: 2,
    });
    ledger.close();
  });

  it("requires the dedicated Admin key and OpenAI project scope", async () => {
    const root = await stateDir();
    await expect(
      reconcileOpenAiBilling({ stateDir: root, env: { OPENAI_PROJECT_ID: "proj_sg" } }),
    ).rejects.toThrow("sg-billing-admin-key-missing");
    await expect(
      reconcileOpenAiBilling({ stateDir: root, env: { OPENAI_ADMIN_KEY: "sk-admin-test" } }),
    ).rejects.toThrow("sg-billing-openai-project-id-missing");
  });

  it("fails safely on rejected or unavailable Admin API responses", async () => {
    const root = await stateDir();
    const common = {
      stateDir: root,
      env: { OPENAI_ADMIN_KEY: "sk-admin-test", OPENAI_PROJECT_ID: "proj_sg" },
      now: Date.parse("2026-09-19T08:00:00.000Z"),
    };
    await expect(
      reconcileOpenAiBilling({
        ...common,
        fetchFn: vi.fn(async () => new Response("", { status: 403 })) as typeof fetch,
      }),
    ).rejects.toThrow("sg-billing-admin-key-rejected");
    await expect(
      reconcileOpenAiBilling({
        ...common,
        fetchFn: vi.fn(async () => {
          throw new Error("network includes no secret");
        }) as typeof fetch,
      }),
    ).rejects.toThrow("sg-billing-admin-usage-unavailable");

    const ledger = new SgBillingLedger(root);
    await expect(ledger.financialReport()).resolves.toMatchObject({
      reconciliationWindowCount: 0,
      reconciliationAdjustmentNanoUsd: 0,
    });
    ledger.close();
  });
});
