import { describe, expect, it } from "vitest";
import {
  isSgInternalRun,
  SgTurnCorrelationRegistry,
  sgTurnRouteKey,
} from "./turn-correlation.js";

describe("SG turn correlation", () => {
  it.each(["telegram", "discord"])(
    "recovers a %s turn for delivery without runId or sessionKey",
    (channel) => {
      const registry = new SgTurnCorrelationRegistry();
      registry.remember({
        runId: `${channel}-turn`,
        channel,
        accountId: "default",
        chatId: "conversation-1",
        selectedProvider: "openai",
        selectedModel: "gpt-5.6-luna",
      });
      registry.noteModelCall(`${channel}-turn`, "openai", "gpt-5.6-luna");
      expect(
        registry.resolve({ channel, accountId: "default", conversationId: "conversation-1" }),
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
    registry.noteModelCall("turn-real-fallback", "openai", "gpt-5.6-terra");
    expect(registry.get("turn-real-fallback")).toMatchObject({
      selectedModelObserved: false,
      differentModelObserved: true,
    });
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
});
