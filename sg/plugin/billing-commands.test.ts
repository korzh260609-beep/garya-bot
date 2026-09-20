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
      text: expect.stringMatching(/ПОПОЛНЕНИЕ[\s\S]*ID: payment-001[\s\S]*\+\$1\.250000001/u),
    });
    const ledger = new SgBillingLedger(stateDir);
    await expect(ledger.entries("usr_citizen")).resolves.toHaveLength(1);
    ledger.close();
  });

  it("shows structured model, token, source and price evidence in billing history", async () => {
    const { stateDir, invoke } = await fixture();
    const ledger = new SgBillingLedger(stateDir);
    await ledger.startTrackedOperation({
      globalId: "usr_monarch",
      operationId: "run:history-details",
      role: "monarch",
      source: { kind: "automation", id: "job-daily" },
    });
    await ledger.recordPart({
      globalId: "usr_monarch",
      operationId: "run:history-details",
      partId: "model:history-details",
      outcome: "completed",
      actualCostNanoUsd: 123_456,
      metadata: {
        kind: "model",
        provider: "openai",
        model: "gpt-5.6-terra",
        inputTokens: 100,
        outputTokens: 20,
        cacheReadTokens: 10,
        cacheWriteTokens: 5,
        costEvidence: "provider-billed",
      },
    });
    await ledger.finalizeParts({
      globalId: "usr_monarch",
      operationId: "run:history-details",
      outcome: "completed",
    });
    ledger.close();

    const history = await invoke("sg_billing", "100", "history usr_monarch");
    expect(history.text).toMatch(
      /ЗАПУСК — завершён[\s\S]*Источник: automation \(job-daily\)[\s\S]*Модель: openai\/gpt-5\.6-terra[\s\S]*Токены: вход 100, выход 20, cache read 10, cache write 5[\s\S]*источник цены: provider-billed/u,
    );
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

  it("closes only stale unpriced Monarch operations after Admin API reconciliation", async () => {
    const createdAt = Date.now();
    const { stateDir, invoke } = await fixture({ now: () => createdAt + 31 * 60_000 });
    const ledger = new SgBillingLedger(stateDir);
    await ledger.startTrackedOperation({
      globalId: "usr_monarch",
      operationId: "usage:stale-monarch",
      role: "monarch",
    });
    await ledger.recordUnpricedPart({
      globalId: "usr_monarch",
      operationId: "usage:stale-monarch",
      partId: "model:unknown",
    });
    await ledger.credit({
      globalId: "usr_citizen",
      creditId: "credit:stale-citizen",
      amountNanoUsd: 1_000_000_000,
    });
    await ledger.reserve({
      globalId: "usr_citizen",
      operationId: "usage:stale-citizen",
      amountNanoUsd: 500_000_000,
    });
    await ledger.recordUnpricedPart({
      globalId: "usr_citizen",
      operationId: "usage:stale-citizen",
      partId: "model:unknown",
    });
    await ledger.recordReconciliationWindow({
      provider: "openai",
      projectId: "proj_sg",
      windowStartMs: createdAt - 60_000,
      windowEndMs: createdAt,
      providerCostNanoUsd: 100_000,
      attributedCostNanoUsd: 0,
      differenceNanoUsd: 100_000,
      sourceDigest: "digest:stale-repair",
    });
    ledger.close();

    await expect(invoke("sg_billing", "100", "resolve-stale-monarch 30")).resolves.toEqual({
      text: expect.stringMatching(/Закрыто операций: 1[\s\S]*Закрыто частей без цены: 1/u),
    });
    await expect(invoke("sg_billing", "100", "resolve-stale-monarch 30")).resolves.toEqual({
      text: expect.stringMatching(/Закрыто операций: 0[\s\S]*Закрыто частей без цены: 0/u),
    });
    const after = new SgBillingLedger(stateDir);
    await expect(after.financialReport()).resolves.toMatchObject({ pendingOperationCount: 1 });
    await expect(after.diagnostics()).resolves.toMatchObject({
      reservedOperationCount: 1,
      blockedOperationCount: 1,
      unpricedPartCount: 1,
      reservedBalanceMismatchCount: 0,
    });
    await expect(after.entries("usr_monarch")).resolves.toEqual([
      expect.objectContaining({
        operationId: "usage:stale-monarch",
        type: "complete",
        outcome: "error",
        actualCostNanoUsd: 0,
        chargedNanoUsd: 0,
      }),
    ]);
    after.close();
  });

  it("refuses stale cleanup until an Admin API reconciliation exists", async () => {
    const { stateDir, invoke } = await fixture({ now: () => Date.now() + 31 * 60_000 });
    const ledger = new SgBillingLedger(stateDir);
    await ledger.startTrackedOperation({
      globalId: "usr_monarch",
      operationId: "usage:no-reconciliation",
      role: "monarch",
    });
    await ledger.recordUnpricedPart({
      globalId: "usr_monarch",
      operationId: "usage:no-reconciliation",
      partId: "model:unknown",
    });
    ledger.close();

    await expect(invoke("sg_billing", "100", "resolve-stale-monarch 30")).resolves.toEqual({
      text: "SG BILLING — сначала выполните сверку расходов OpenAI за 1 день",
    });
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
    expect(report.text).toMatch(
      /OPENAI \/ ПРОЕКТ SG[\s\S]*Расходы всего: \$0\.750000[\s\S]*Остаток предоплаты: OpenAI API не предоставляет/u,
    );
    expect(report.text).toMatch(/ДОХОД[\s\S]*Выручка пользователей: \$1\.000000/u);
    expect(report.text).toMatch(/Прибыль проекта: \$0\.250000/u);
    expect(report.text).toMatch(/Монарх: \$0\.250000/u);
    expect(report.text).toMatch(
      /Global ID:\nusr_citizen\nРоль: гражданин[\s\S]*Выручка: \$1\.000000/u,
    );
    expect(report.text).toMatch(
      /Global ID:\nusr_monarch\nРоль: монарх[\s\S]*Выручка: \$0\.000000/u,
    );

    const user = await invoke("sg_billing", "100", "user usr_citizen");
    expect(user.text).toMatch(
      /SG BILLING — ПОЛЬЗОВАТЕЛЬ[\s\S]*Global ID:\nusr_citizen[\s\S]*РАСХОДЫ[\s\S]*ДОХОД[\s\S]*СТАТУС/u,
    );
    expect(user.text).not.toContain("usr_monarch");
  });

  it("runs an explicit Admin API reconciliation and reports safe configuration errors", async () => {
    const fetchFn = vi.fn(async (input: string | URL | Request) =>
      new URL(input instanceof Request ? input.url : input).pathname.endsWith("/spend_limit")
        ? new Response(
            JSON.stringify({
              threshold_amount: 5_000,
              currency: "usd",
              interval: "month",
              enforcement: { status: "enforcing" },
            }),
            { status: 200 },
          )
        : new Response(
            JSON.stringify({
              data: [
                {
                  start_time: 1_789_689_600,
                  end_time: 1_789_776_000,
                  results: [
                    {
                      line_item: "model-inference",
                      amount: { value: "2", currency: "usd" },
                    },
                    {
                      line_item: "web-search",
                      amount: { value: "0.5", currency: "usd" },
                    },
                  ],
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
    expect(result.text).toMatch(
      /сверка завершена[\s\S]*Затраты Admin API: \$2\.5[\s\S]*Лимит OpenAI: \$50[\s\S]*ПО ДНЯМ \(UTC\)[\s\S]*2026-09-18: \$2\.5[\s\S]*ПО УСЛУГАМ[\s\S]*model-inference: \$2[\s\S]*web-search: \$0\.5/u,
    );
    expect(fetchFn).toHaveBeenCalledTimes(2);

    const unconfigured = await fixture({ env: {} });
    await expect(unconfigured.invoke("sg_billing", "100", "reconcile")).resolves.toEqual({
      text: "SG BILLING — OPENAI_ADMIN_KEY не настроен",
    });
  });

  it("keeps a 30-day service breakdown within one Telegram message", async () => {
    const firstDaySeconds = Date.parse("2026-08-20T00:00:00.000Z") / 1_000;
    const fetchFn = vi.fn(async (input: string | URL | Request) => {
      const url = new URL(input instanceof Request ? input.url : input);
      if (url.pathname.endsWith("/spend_limit")) {
        return new Response("", { status: 404 });
      }
      return new Response(
        JSON.stringify({
          data: Array.from({ length: 30 }, (_, index) => ({
            start_time: firstDaySeconds + index * 86_400,
            end_time: firstDaySeconds + (index + 1) * 86_400,
            results: [
              {
                line_item: `service-${String(index + 1).padStart(2, "0")}`,
                amount: { value: "0.01", currency: "usd" },
              },
            ],
          })),
          has_more: false,
        }),
        { status: 200 },
      );
    }) as typeof fetch;
    const { invoke } = await fixture({
      env: { OPENAI_ADMIN_KEY: "sk-admin-test", OPENAI_PROJECT_ID: "proj_sg" },
      fetchFn,
      now: () => Date.parse("2026-09-19T08:00:00.000Z"),
    });

    const result = await invoke("sg_billing", "100", "reconcile 30");
    expect(result.text).toContain("Затраты Admin API: $0.3");
    expect(result.text).toContain("2026-08-20: $0.01");
    expect(result.text).toContain("2026-09-18: $0.01");
    expect(result.text).toContain("service-01: $0.01");
    expect(result.text).toContain("service-30: $0.01");
    expect(result.text.length).toBeLessThanOrEqual(4_096);
  });
});
