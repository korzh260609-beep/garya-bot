import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { AnyAgentTool, OpenClawPluginToolContext } from "openclaw/plugin-sdk/plugin-entry";
import { describe, expect, it } from "vitest";
import { SgBillingLedger } from "./billing-ledger.js";
import { BILLING_AGENT_GUIDANCE, createSgBillingTool } from "./billing-tools.js";

const timestamp = "2026-01-01T00:00:00.000Z";

async function fixture() {
  const stateDir = await mkdtemp(path.join(os.tmpdir(), "sg-billing-tools-"));
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
  return stateDir;
}

function toolContext(senderId: string): OpenClawPluginToolContext {
  return {
    config: {},
    messageChannel: "telegram",
    agentAccountId: "default",
    nativeChannelId: `telegram:${senderId}`,
    requesterSenderId: senderId,
  };
}

async function execute(tool: AnyAgentTool, parameters: Record<string, unknown>) {
  const result = (await tool.execute?.("billing-call", parameters)) as { details: unknown };
  return result.details;
}

describe("SG semantic billing tool", () => {
  it("routes by canonical actions instead of phrases or keyword rules", () => {
    expect(BILLING_AGENT_GUIDANCE).toContain("семантически");
    expect(BILLING_AGENT_GUIDANCE).toContain("не используй сопоставление по ключевым словам");
    expect(BILLING_AGENT_GUIDANCE).toContain("Если объект запроса неоднозначен");
    expect(BILLING_AGENT_GUIDANCE).toContain("Не предлагай пользователю запоминать");
    expect(BILLING_AGENT_GUIDANCE).not.toMatch(/«Сколько|«Покажи|ключев(?:ое|ых) слово:\s/u);
  });

  it("shows a citizen only the balance bound to the trusted current sender", async () => {
    const stateDir = await fixture();
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

    const tool = createSgBillingTool(toolContext("200"), stateDir);
    await expect(
      execute(tool, { action: "self_balance", globalId: "usr_monarch" }),
    ).resolves.toEqual({
      status: "ok",
      output: expect.stringMatching(/Global ID: usr_citizen[\s\S]*Баланс: \$2\.5/u),
    });
    expect(
      (await execute(tool, { action: "self_balance", globalId: "usr_monarch" })) as {
        output: string;
      },
    ).not.toEqual(expect.objectContaining({ output: expect.stringContaining("$9") }));
  });

  it("denies project billing actions to citizens before command execution", async () => {
    const stateDir = await fixture();
    const tool = createSgBillingTool(toolContext("200"), stateDir);

    await expect(execute(tool, { action: "project_report" })).resolves.toEqual({
      status: "denied",
      reason: "monarch-required",
    });
    await expect(execute(tool, { action: "credit" })).resolves.toEqual({
      status: "denied",
      reason: "monarch-required",
    });
  });

  it("requires explicit confirmation for every mutating action", async () => {
    const stateDir = await fixture();
    const tool = createSgBillingTool(toolContext("100"), stateDir);

    for (const action of ["credit", "resolve_stale_monarch", "bind_automation"]) {
      await expect(execute(tool, { action })).resolves.toEqual({
        status: "confirmation_required",
        action,
      });
    }
  });

  it("executes a confirmed monarch credit through the existing billing command logic", async () => {
    const stateDir = await fixture();
    const monarchTool = createSgBillingTool(toolContext("100"), stateDir);
    const citizenTool = createSgBillingTool(toolContext("200"), stateDir);

    await expect(
      execute(monarchTool, {
        action: "credit",
        globalId: "usr_citizen",
        amountUsd: "1.250000001",
        operationId: "semantic-credit-001",
        confirmed: true,
      }),
    ).resolves.toEqual({
      status: "ok",
      output: expect.stringContaining("Баланс: $1.250000001"),
    });
    await expect(execute(citizenTool, { action: "self_balance" })).resolves.toEqual({
      status: "ok",
      output: expect.stringContaining("Баланс: $1.250000001"),
    });
  });

  it("rejects unsupported actions and invalid bounded parameters deterministically", async () => {
    const stateDir = await fixture();
    const tool = createSgBillingTool(toolContext("100"), stateDir);

    await expect(execute(tool, { action: "guess_from_words" })).resolves.toEqual({
      status: "invalid",
      reason: "supported-action-required",
    });
    await expect(execute(tool, { action: "reconcile", days: 32 })).resolves.toEqual({
      status: "invalid",
      reason: "sg-billing-tool-days-invalid",
    });
  });
});
