import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { registerSgBillingCommands } from "./billing-commands.js";
import { SgBillingLedger } from "./billing-ledger.js";

const timestamp = "2026-01-01T00:00:00.000Z";

async function fixture(
  options: {
    env?: NodeJS.ProcessEnv;
    fetchFn?: typeof fetch;
    now?: () => number;
  } = {},
) {
  const stateDir = await mkdtemp(path.join(os.tmpdir(), "sg-billing-commands-"));
  const profilePath = path.join(stateDir, "sg", "global-profiles.json");
  await mkdir(path.dirname(profilePath), { recursive: true });
  await writeFile(
    profilePath,
    JSON.stringify({
      version: 5,
      monarchGlobalId: "usr_monarch",
      profiles: [
        {
          globalId: "usr_monarch",
          canonicalIdentity: "channel:telegram:100",
          role: "monarch",
          status: "active",
          createdAt: timestamp,
          updatedAt: timestamp,
        },
        {
          globalId: "usr_citizen",
          canonicalIdentity: "channel:telegram:200",
          role: "citizen",
          status: "active",
          createdAt: timestamp,
          updatedAt: timestamp,
        },
      ],
      identities: [
        {
          canonicalIdentity: "channel:telegram:100",
          globalId: "usr_monarch",
          createdAt: timestamp,
          updatedAt: timestamp,
        },
        {
          canonicalIdentity: "channel:telegram:200",
          globalId: "usr_citizen",
          createdAt: timestamp,
          updatedAt: timestamp,
        },
      ],
    }),
  );
  const commands = new Map<
    string,
    (ctx: {
      channel: string;
      senderId: string;
      args?: string;
      config: Record<string, unknown>;
    }) => Promise<{ text: string }>
  >();
  registerSgBillingCommands({
    stateDir,
    ...options,
    api: {
      registerCommand: (command) => commands.set(command.name, command.handler),
      logger: { warn: vi.fn() },
    },
  });
  const invoke = (name: string, senderId: string, args?: string) => {
    const handler = commands.get(name);
    if (!handler) {
      throw new Error(`missing command: ${name}`);
    }
    return handler({ channel: "telegram", senderId, ...(args ? { args } : {}), config: {} });
  };
  return { stateDir, invoke };
}

describe("SG billing commands", () => {
  it("shows citizens only their own balance and denies billing administration", async () => {
    const { stateDir, invoke } = await fixture();
    const ledger = new SgBillingLedger(stateDir);
    await ledger.credit({
      globalId: "usr_citizen",
      creditId: "credit:citizen",
      amountNanoUsd: 2_500_000_000,
    });
    await ledger.credit({
      globalId: "usr_monarch",
      creditId: "credit:monarch",
      amountNanoUsd: 9_000_000_000,
    });
    ledger.close();

    await expect(invoke("sg_balance", "200", "usr_monarch")).resolves.toEqual({
      text: expect.stringMatching(/Global ID: usr_citizen[\s\S]*Баланс: \$2\.5/u),
    });
    expect((await invoke("sg_balance", "200", "usr_monarch")).text).not.toContain("$9");
    await expect(invoke("sg_billing", "200", "balance usr_monarch")).resolves.toEqual({
      text: "SG BILLING — доступ разрешён только монарху",
    });
  });

  it("lets the monarch credit, inspect balance and read bounded history idempotently", async () => {
    const { stateDir, invoke } = await fixture();
    await expect(
      invoke("sg_billing", "100", "credit usr_citizen 1.250000001 payment-001"),
    ).resolves.toEqual({ text: expect.stringContaining("Баланс: $1.250000001") });
    await invoke("sg_billing", "100", "credit usr_citizen 1.250000001 payment-001");
    await expect(invoke("sg_billing", "100", "balance usr_citizen")).resolves.toEqual({
      text: expect.stringContaining("Баланс: $1.250000001"),
    });
    await expect(invoke("sg_billing", "100", "history usr_citizen")).resolves.toEqual({
      text: expect.stringMatching(/payment-001 \| credit \| \+\$1\.250000001/u),
    });
    const ledger = new SgBillingLedger(stateDir);
    await expect(ledger.entries("usr_citizen")).resolves.toHaveLength(1);
    ledger.close();
  });

  it("rejects invalid amounts, unknown profiles and conflicting operation IDs", async () => {
    const { invoke } = await fixture();
    await expect(
      invoke("sg_billing", "100", "credit usr_missing 1 payment-unknown"),
    ).resolves.toEqual({ text: "SG BILLING — Global ID не найден или неактивен" });
    await expect(invoke("sg_billing", "100", "credit usr_citizen 0 payment-zero")).resolves.toEqual(
      {
        text: "SG BILLING — сумма USD должна быть положительной, максимум 9 знаков после точки",
      },
    );
    await invoke("sg_billing", "100", "credit usr_citizen 1 payment-conflict");
    await expect(
      invoke("sg_billing", "100", "credit usr_citizen 2 payment-conflict"),
    ).resolves.toEqual({
      text: "SG BILLING — ID операции уже использован с другими параметрами",
    });
  });

  it("reports structural health and unresolved unpriced reservations without changing them", async () => {
    const { stateDir, invoke } = await fixture();
    const ledger = new SgBillingLedger(stateDir);
    await ledger.credit({
      globalId: "usr_citizen",
      creditId: "credit:diag",
      amountNanoUsd: 2_000_000_000,
    });
    await ledger.reserve({
      globalId: "usr_citizen",
      operationId: "usage:diag",
      amountNanoUsd: 1_000_000_000,
    });
    await ledger.recordUnpricedPart({
      globalId: "usr_citizen",
      operationId: "usage:diag",
      partId: "part:unknown",
    });
    ledger.close();

    const result = await invoke("sg_billing", "100", "diag");
    expect(result.text).toMatch(/SG BILLING DIAG — WARN/u);
    expect(result.text).toContain("Активные резервы: 1");
    expect(result.text).toContain("Заблокированные операции без цены: 1");
    expect(result.text).toContain("Несовпадения суммы резервов: 0");
    const after = new SgBillingLedger(stateDir);
    await expect(after.snapshot("usr_citizen")).resolves.toMatchObject({
      balanceNanoUsd: 2_000_000_000,
      reservedNanoUsd: 1_000_000_000,
    });
    after.close();
  });

  it("lets only the Monarch bind an existing automation to a verified Global ID", async () => {
    const { stateDir, invoke } = await fixture();

    await expect(invoke("sg_billing", "200", "job-bind job-existing usr_citizen")).resolves.toEqual(
      { text: "SG BILLING — доступ разрешён только монарху" },
    );
    await expect(invoke("sg_billing", "100", "job-bind job-existing usr_missing")).resolves.toEqual(
      { text: "SG BILLING — Global ID не найден или неактивен" },
    );
    await expect(invoke("sg_billing", "100", "job-bind job-existing usr_monarch")).resolves.toEqual(
      {
        text: expect.stringMatching(/Job ID: job-existing[\s\S]*Global ID: usr_monarch/u),
      },
    );

    const ledger = new SgBillingLedger(stateDir);
    await expect(ledger.resolveAutomationOwner("job-existing")).resolves.toEqual({
      globalId: "usr_monarch",
      role: "monarch",
    });
    ledger.close();
  });

  it("shows project and per-user cost, revenue and profit only to the Monarch", async () => {
    const { stateDir, invoke } = await fixture();
    const ledger = new SgBillingLedger(stateDir);
    await ledger.credit({
      globalId: "usr_citizen",
      creditId: "credit:report",
      amountNanoUsd: 3_000_000_000,
    });
    await ledger.reserve({
      globalId: "usr_citizen",
      operationId: "usage:citizen-report",
      amountNanoUsd: 2_000_000_000,
    });
    await ledger.complete({
      globalId: "usr_citizen",
      operationId: "usage:citizen-report",
      outcome: "completed",
      actualCostNanoUsd: 500_000_000,
    });
    await ledger.startTrackedOperation({
      globalId: "usr_monarch",
      operationId: "usage:monarch-report",
      role: "monarch",
    });
    await ledger.complete({
      globalId: "usr_monarch",
      operationId: "usage:monarch-report",
      outcome: "completed",
      actualCostNanoUsd: 250_000_000,
    });
    ledger.close();

    await expect(invoke("sg_billing", "200", "report")).resolves.toEqual({
      text: "SG BILLING — доступ разрешён только монарху",
    });
    const report = await invoke("sg_billing", "100", "report");
    expect(report.text).toMatch(/Затраты провайдера: \$0\.75/u);
    expect(report.text).toMatch(/Выручка пользователей: \$1/u);
    expect(report.text).toMatch(/Прибыль проекта: \$0\.25/u);
    expect(report.text).toMatch(/Затраты монарха: \$0\.25/u);
    expect(report.text).toMatch(/usr_citizen \(citizen\).*выручка=\$1/u);
    expect(report.text).toMatch(/usr_monarch \(monarch\).*выручка=\$0/u);

    const user = await invoke("sg_billing", "100", "user usr_citizen");
    expect(user.text).toContain("SG BILLING USER — usr_citizen");
    expect(user.text).not.toContain("usr_monarch");
  });

  it("runs an explicit Admin API reconciliation and reports safe configuration errors", async () => {
    const fetchFn = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            data: [
              {
                start_time: 1_789_689_600,
                end_time: 1_789_776_000,
                results: [{ amount: { value: "2.5", currency: "usd" } }],
              },
            ],
            has_more: false,
          }),
          { status: 200 },
        ),
    ) as typeof fetch;
    const configured = await fixture({
      env: { OPENAI_ADMIN_KEY: "sk-admin-test", OPENAI_PROJECT_ID: "proj_sg" },
      fetchFn,
      now: () => Date.parse("2026-09-19T08:00:00.000Z"),
    });
    const result = await configured.invoke("sg_billing", "100", "reconcile 1");
    expect(result.text).toMatch(/сверка завершена[\s\S]*Затраты Admin API: \$2\.5/u);
    expect(fetchFn).toHaveBeenCalledOnce();

    const unconfigured = await fixture({ env: {} });
    await expect(unconfigured.invoke("sg_billing", "100", "reconcile")).resolves.toEqual({
      text: "SG BILLING — OPENAI_ADMIN_KEY не настроен",
    });
  });
});
