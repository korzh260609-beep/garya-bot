import { describe, expect, it, vi } from "vitest";
import { registerSgExecutionGuard } from "./execution-guard.js";

type Hook = (event: Record<string, unknown>, ctx: Record<string, unknown>) => unknown;

function setup() {
  const hooks = new Map<string, Hook>();
  const complete = vi.fn(async () => ({
    text: '{"verdict":"pass","violations":[],"reason":"Соответствует"}',
  }));
  registerSgExecutionGuard(
    {
      on: (name: string, handler: Hook) => hooks.set(name, handler),
      logger: { warn: vi.fn() },
      runtime: { llm: { complete } },
    } as never,
    async () => "1. Не выдумывать\n4. Отделять факты от предположений\n17. Проверять результат",
  );
  const hook = (name: string) => {
    const handler = hooks.get(name);
    if (!handler) {
      throw new Error(`missing ${name} hook`);
    }
    return (event: Record<string, unknown>, ctx: Record<string, unknown>) =>
      Promise.resolve(handler(event, ctx));
  };
  return { complete, hook };
}

const receipt = (overrides: Record<string, unknown> = {}) =>
  `Готово.\n<sg-execution-receipt>${JSON.stringify({
    mode: "action",
    status: "complete",
    toolsRequired: true,
    verification: "confirmed",
    completed: "Изменение выполнено",
    evidence: "Результат инструмента подтверждён",
    notCompleted: "",
    blocker: "",
    userDecisionRequired: false,
    ...overrides,
  })}</sg-execution-receipt>`;

describe("SG execution guard", () => {
  it("requires a machine-checkable receipt before finalization", async () => {
    const { hook } = setup();
    await hook("before_agent_run")({ prompt: "Сделай задачу", messages: [] }, { runId: "r1" });

    await expect(
      hook("before_agent_finalize")(
        { runId: "r1", sessionId: "s1", lastAssistantMessage: "Готово" },
        { runId: "r1" },
      ),
    ).resolves.toMatchObject({ action: "revise" });
  });

  it("requires the receipt to be the final block", async () => {
    const { hook } = setup();
    await hook("before_agent_run")({ prompt: "Ответь", messages: [] }, { runId: "r1-tail" });

    await expect(
      hook("before_agent_finalize")(
        {
          runId: "r1-tail",
          sessionId: "s1-tail",
          lastAssistantMessage: `${receipt({ mode: "answer", toolsRequired: false })}\nпослесловие`,
        },
        { runId: "r1-tail" },
      ),
    ).resolves.toMatchObject({ action: "revise" });
  });

  it("rejects a completed action that used no tool", async () => {
    const { hook } = setup();
    await hook("before_agent_run")({ prompt: "Сделай задачу", messages: [] }, { runId: "r2" });

    await expect(
      hook("before_agent_finalize")(
        { runId: "r2", sessionId: "s2", lastAssistantMessage: receipt() },
        { runId: "r2" },
      ),
    ).resolves.toMatchObject({ action: "revise" });
  });

  it("accepts a verified action backed by a successful tool call", async () => {
    const { complete, hook } = setup();
    await hook("before_agent_run")({ prompt: "Сделай задачу", messages: [] }, { runId: "r3" });
    await hook("before_tool_call")(
      { runId: "r3", toolCallId: "t1", toolName: "write", params: {} },
      { runId: "r3", toolName: "write" },
    );
    await hook("after_tool_call")(
      { runId: "r3", toolCallId: "t1", toolName: "write", params: {}, result: "ok" },
      { runId: "r3", toolName: "write" },
    );

    await expect(
      hook("before_agent_finalize")(
        { runId: "r3", sessionId: "s3", lastAssistantMessage: receipt() },
        { runId: "r3" },
      ),
    ).resolves.toBeUndefined();
    expect(complete).toHaveBeenCalledOnce();
  });

  it("requests revision when the independent controller finds a semantic violation", async () => {
    const { complete, hook } = setup();
    complete.mockResolvedValueOnce({
      text: JSON.stringify({
        verdict: "revise",
        violations: [{ rule: 4, reason: "Предположение выдано за факт" }],
        reason: "Отделить предположение от подтверждённого факта",
      }),
    });
    await hook("before_agent_run")({ prompt: "Ответь точно", messages: [] }, { runId: "r3-sem" });
    const answer = receipt({ mode: "answer", toolsRequired: false, verification: "not-needed" });

    await expect(
      hook("before_agent_finalize")(
        { runId: "r3-sem", sessionId: "s3-sem", lastAssistantMessage: answer },
        { runId: "r3-sem" },
      ),
    ).resolves.toMatchObject({
      action: "revise",
      reason: expect.stringContaining("RULE_04"),
    });
  });

  it("fails closed when the controller returns malformed output", async () => {
    const { complete, hook } = setup();
    complete.mockResolvedValueOnce({ text: "not json" });
    await hook("before_agent_run")({ prompt: "Ответь", messages: [] }, { runId: "r3-bad" });
    const answer = receipt({ mode: "answer", toolsRequired: false, verification: "not-needed" });

    await expect(
      hook("before_agent_finalize")(
        { runId: "r3-bad", sessionId: "s3-bad", lastAssistantMessage: answer },
        { runId: "r3-bad" },
      ),
    ).resolves.toMatchObject({ action: "revise" });
  });

  it("fails closed when the controller call throws", async () => {
    const { complete, hook } = setup();
    complete.mockRejectedValueOnce(new Error("controller unavailable"));
    await hook("before_agent_run")({ prompt: "Ответь", messages: [] }, { runId: "r3-error" });
    const answer = receipt({ mode: "answer", toolsRequired: false, verification: "not-needed" });

    await expect(
      hook("before_agent_finalize")(
        { runId: "r3-error", sessionId: "s3-error", lastAssistantMessage: answer },
        { runId: "r3-error" },
      ),
    ).resolves.toMatchObject({
      action: "revise",
      reason: expect.stringContaining("недоступен"),
    });
  });

  it("rejects a false success after an unrecovered tool failure", async () => {
    const { hook } = setup();
    await hook("before_agent_run")({ prompt: "Сделай задачу", messages: [] }, { runId: "r4" });
    await hook("before_tool_call")(
      { runId: "r4", toolCallId: "t1", toolName: "write", params: {} },
      { runId: "r4", toolName: "write" },
    );
    await hook("after_tool_call")(
      { runId: "r4", toolCallId: "t1", toolName: "write", params: {}, error: "failed" },
      { runId: "r4", toolName: "write" },
    );

    await expect(
      hook("before_agent_finalize")(
        { runId: "r4", sessionId: "s4", lastAssistantMessage: receipt() },
        { runId: "r4" },
      ),
    ).resolves.toMatchObject({ action: "revise" });
  });

  it("strips a valid receipt from the delivered final reply", async () => {
    const { hook } = setup();
    await hook("before_agent_run")({ prompt: "Ответь", messages: [] }, { runId: "r5" });
    const answer = receipt({
      mode: "answer",
      toolsRequired: false,
      verification: "not-needed",
      evidence: "Не требуется",
    });
    await hook("before_agent_finalize")(
      { runId: "r5", sessionId: "s5", lastAssistantMessage: answer },
      { runId: "r5" },
    );

    await expect(
      hook("reply_payload_sending")(
        { kind: "final", runId: "r5", payload: { text: answer } },
        { runId: "r5" },
      ),
    ).resolves.toEqual({ payload: { text: "Готово." } });
  });

  it("replaces an invalid final reply when revision could not run", async () => {
    const { hook } = setup();
    await hook("before_agent_run")({ prompt: "Сделай задачу", messages: [] }, { runId: "r6" });

    await expect(
      hook("reply_payload_sending")(
        { kind: "final", runId: "r6", payload: { text: "Готово" } },
        { runId: "r6" },
      ),
    ).resolves.toEqual({
      payload: {
        text: expect.stringContaining("SG остановил непроверенный ответ"),
      },
    });
  });

  it("blocks a technically valid reply that skipped semantic finalization", async () => {
    const { hook } = setup();
    await hook("before_agent_run")({ prompt: "Ответь", messages: [] }, { runId: "r7" });
    const answer = receipt({ mode: "answer", toolsRequired: false, verification: "not-needed" });

    await expect(
      hook("reply_payload_sending")(
        { kind: "final", runId: "r7", payload: { text: answer } },
        { runId: "r7" },
      ),
    ).resolves.toEqual({
      payload: { text: "SG остановил ответ без независимой смысловой проверки." },
    });
  });

  it("blocks a delivered draft changed after semantic approval", async () => {
    const { hook } = setup();
    await hook("before_agent_run")({ prompt: "Ответь", messages: [] }, { runId: "r8" });
    const answer = receipt({ mode: "answer", toolsRequired: false, verification: "not-needed" });
    await hook("before_agent_finalize")(
      { runId: "r8", sessionId: "s8", lastAssistantMessage: answer },
      { runId: "r8" },
    );

    await expect(
      hook("reply_payload_sending")(
        { kind: "final", runId: "r8", payload: { text: `Изменено.\n${answer}` } },
        { runId: "r8" },
      ),
    ).resolves.toEqual({
      payload: { text: "SG остановил ответ без независимой смысловой проверки." },
    });
  });
});
