import { describe, expect, it } from "vitest";
import {
  isSgInternalRun,
  SgTurnCorrelationRegistry,
  sgTurnRouteKey,
} from "./turn-correlation.js";

describe("SG turn correlation", () => {
  it.each(["telegram", "discord", "matrix"])(
    "recovers a %s turn for delivery without runId or sessionKey",
    (channel) => {
      const registry = new SgTurnCorrelationRegistry();
      registry.remember({
        runId: `${channel}-turn`,
        channel,
        accountId: "default",
        chatId: `${channel}:conversation-1`,
        channelId: "conversation-1",
        selectedProvider: "openai",
        selectedModel: "gpt-5.6-luna",
      });
      registry.noteModelCall(`${channel}-turn`, "openai", "gpt-5.6-luna");
      expect(
        registry.resolve({ channelId: channel, accountId: "default", conversationId: "conversation-1" }),
      ).toMatchObject({
        runId: `${channel}-turn`,
        selectedModelObserved: true,
        differentModelObserved: false,
      });
    },
  );

  it("keeps route, actual model, billing and delivery on one turn", () => {
    const registry = new SgTurnCorrelationRegistry();
    registry.remember({
      runId: "turn-1",
      sessionKey: "agent:main:discord:direct:42",
      selectedProvider: "openai",
      selectedModel: "gpt-5.6-sol",
    });
    registry.noteModelCall("turn-1", "openai", "gpt-5.6-sol");
    registry.noteBilling("turn-1", "call-1", "reserved");
    registry.noteBilling("turn-1", "call-1", "settled");
    expect(registry.claimFinalDelivery("turn-1")).toBe(true);
    expect(registry.claimFinalDelivery("turn-1")).toBe(false);
    expect(registry.get("turn-1")?.billing.get("call-1")).toBe("settled");
  });

  it("distinguishes a real fallback", () => {
    const registry = new SgTurnCorrelationRegistry();
    registry.remember({
      runId: "turn-real-fallback",
      sessionKey: "session-1",
      selectedProvider: "openai",
      selectedModel: "gpt-5.6-luna",
    });
    registry.noteModelCallEnded(
      "turn-real-fallback",
      "openai",
      "gpt-5.6-luna",
      "error",
    );
    registry.noteModelCallEnded(
      "turn-real-fallback",
      "openai",
      "gpt-5.6-terra",
      "completed",
    );
    expect(registry.get("turn-real-fallback")).toMatchObject({
      selectedModelSucceeded: false,
      differentModelSucceeded: true,
    });
    expect(registry.shouldSuppressFalseFallback("turn-real-fallback")).toBe(false);
  });

  it("uses channel, account and conversation as a transport-neutral route", () => {
    expect(
      sgTurnRouteKey({ channel: "matrix", accountId: "work", conversationId: "room-7" }),
    ).toBe(["matrix", "work", "room-7"].join("\0"));
  });

  it("identifies controller, memory and workshop runs", () => {
    expect(isSgInternalRun("skill-workshop-review:1")).toBe(true);
    expect(isSgInternalRun("ordinary-user-turn", "memory")).toBe(true);
    expect(isSgInternalRun("ordinary-user-turn", "user")).toBe(false);
  });
  it("suppresses only a fallback notice disproved by a completed selected model call", () => {
    const registry = new SgTurnCorrelationRegistry();
    registry.remember({
      runId: "turn-false-fallback",
      channel: "matrix",
      accountId: "work",
      chatId: "room-7",
      selectedProvider: "openai",
      selectedModel: "gpt-5.6-luna",
    });
    registry.noteModelCallEnded(
      "turn-false-fallback",
      "openai",
      "gpt-5.6-luna",
      "completed",
    );
    expect(registry.shouldSuppressFalseFallback("turn-false-fallback")).toBe(true);
  });

  it("does not let controller or memory model work create a false real-fallback signal", () => {
    const registry = new SgTurnCorrelationRegistry();
    registry.remember({
      runId: "turn-internal-model",
      channel: "telegram",
      chatId: "42",
      selectedProvider: "openai",
      selectedModel: "gpt-5.6-luna",
    });
    registry.noteModelCallEnded(
      "turn-internal-model",
      "openai",
      "gpt-5.6-luna",
      "completed",
    );
    registry.beginInternalModelWork("turn-internal-model");
    registry.noteModelCallEnded(
      "turn-internal-model",
      "openai",
      "gpt-5.6-terra",
      "completed",
    );
    registry.endInternalModelWork("turn-internal-model");
    expect(registry.shouldSuppressFalseFallback("turn-internal-model")).toBe(true);
  });

  it("uses FIFO for concurrent turns on the same transport route", () => {
    const registry = new SgTurnCorrelationRegistry();
    const route = { channel: "discord", accountId: "default", chatId: "room-9" };
    registry.remember({ ...route, runId: "first" });
    registry.remember({ ...route, runId: "second" });
    const delivery = {
      channelId: "discord",
      accountId: "default",
      conversationId: "room-9",
    };
    expect(registry.resolve(delivery)?.runId).toBe("first");
    expect(registry.claimFinalDelivery("first")).toBe(true);
    expect(registry.resolve(delivery)?.runId).toBe("second");
  });

});
