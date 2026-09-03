import { describe, expect, it, vi } from "vitest";
import { Wsp6NativeLifecycle } from "./wsp6-lifecycle.js";

function registeredLifecycle() {
  type Hook = (event: Record<string, unknown>, ctx: { sessionKey?: string }) => unknown;
  const hooks = new Map<string, Hook[]>();
  const lifecycle = new Wsp6NativeLifecycle();
  lifecycle.register({
    on: vi.fn((name: string, handler: Hook) => {
      hooks.set(name, [...(hooks.get(name) ?? []), handler]);
    }) as never,
  });
  return {
    lifecycle,
    hook(name: string) {
      const handler = hooks.get(name)?.[0];
      if (!handler) {
        throw new Error(`missing hook ${name}`);
      }
      return handler;
    },
  };
}

describe("WSP6 native action lifecycle", () => {
  it("allows only the exact queued native message action", async () => {
    const { lifecycle, hook } = registeredLifecycle();
    const params = {
      action: "poll",
      channel: "telegram",
      target: "30",
      pollQuestion: "Question",
      pollOption: ["A", "B"],
      pollMulti: false,
      pollPublic: true,
    };
    lifecycle.queue({
      sessionKey: "agent:main:group:1",
      toolName: "message",
      params,
      purpose: "first-question",
    });

    expect(
      await hook("before_tool_call")(
        { toolName: "message", params },
        { sessionKey: "agent:main:group:1" },
      ),
    ).toBeUndefined();
    expect(
      await hook("before_tool_call")(
        { toolName: "message", params: { ...params, target: "group" } },
        { sessionKey: "agent:main:group:1" },
      ),
    ).toMatchObject({ block: true });
    expect(lifecycle.snapshot()).toMatchObject({ pending: 1, blocked: 1 });
  });

  it("replaces the model reply after success so private data cannot leak", async () => {
    const { lifecycle, hook } = registeredLifecycle();
    lifecycle.queue({
      sessionKey: "agent:main:group:2",
      toolName: "message",
      params: { action: "send", target: "30", message: "private result" },
      purpose: "private-result",
      successReply: "Тест завершён. Личный результат отправлен в личные сообщения.",
    });
    await hook("after_tool_call")(
      { toolName: "message", result: { details: { status: "ok" } } },
      { sessionKey: "agent:main:group:2" },
    );
    expect(
      await hook("before_agent_reply")(
        { reply: { text: "sensitive score" } },
        { sessionKey: "agent:main:group:2" },
      ),
    ).toMatchObject({
      handled: true,
      reply: { text: "Тест завершён. Личный результат отправлен в личные сообщения." },
      reason: "sg-wsp6-private-delivery-protected",
    });
    expect(lifecycle.snapshot()).toMatchObject({ pending: 0, succeeded: 1, failed: 0 });
  });

  it("reports missing or failed native delivery with a safe retry message", async () => {
    const first = registeredLifecycle();
    first.lifecycle.queue({
      sessionKey: "session-missing",
      toolName: "message",
      params: { action: "poll" },
      purpose: "next-question",
    });
    expect(
      await first.hook("before_agent_reply")({}, { sessionKey: "session-missing" }),
    ).toMatchObject({ handled: true, reason: "sg-wsp6-native-action-not-executed" });
    expect(first.lifecycle.snapshot()).toMatchObject({ pending: 0, failed: 1 });

    const second = registeredLifecycle();
    second.lifecycle.queue({
      sessionKey: "session-failed",
      toolName: "message",
      params: { action: "poll" },
      purpose: "first-question",
    });
    await second.hook("after_tool_call")(
      {
        toolName: "message",
        result: { details: { pollAnswerRouting: "unavailable" } },
      },
      { sessionKey: "session-failed" },
    );
    expect(
      await second.hook("before_agent_reply")({}, { sessionKey: "session-failed" }),
    ).toMatchObject({
      handled: true,
      reply: { text: expect.stringContaining("Откройте личный чат") },
    });
    expect(second.lifecycle.snapshot()).toMatchObject({ failed: 1, succeeded: 0 });
  });
});
