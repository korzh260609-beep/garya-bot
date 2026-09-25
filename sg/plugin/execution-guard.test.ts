import { describe, expect, it, vi } from "vitest";
import { registerSgExecutionGuard } from "./execution-guard.js";

type Hook = (event: Record<string, unknown>, ctx: Record<string, unknown>) => unknown;

function setup() {
  const hooks = new Map<string, Hook>();
  registerSgExecutionGuard({
    on: (name: string, handler: Hook) => hooks.set(name, handler),
    logger: { warn: vi.fn() },
  } as never);
  const hook = (name: string) => {
    const handler = hooks.get(name);
    if (!handler) {
      throw new Error(`missing ${name} hook`);
    }
    return (event: Record<string, unknown>, ctx: Record<string, unknown>) =>
      Promise.resolve(handler(event, ctx));
  };
  return { hook };
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
    const { hook } = setup();
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
});
