import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { OpenClawPluginApi } from "openclaw/plugin-sdk/plugin-entry";
import { describe, expect, it, vi } from "vitest";
import { SgWorkspaceMembershipRegistry } from "./workspace-memberships.js";
import { SgWorkspaceRegistry } from "./workspace-registry.js";
import { openSgAssessmentStores, SgAssessmentRegistry } from "./wsp6-assessments.js";
import {
  WSP6_CALLBACK_NAMESPACE,
  Wsp6InteractiveController,
  wsp6StartCallbackValue,
} from "./wsp6-interactive.js";

const timestamp = "2026-01-01T00:00:00.000Z";

type InteractiveRegistration = Parameters<OpenClawPluginApi["registerInteractiveHandler"]>[0];
type CallbackContext = Parameters<InteractiveRegistration["handler"]>[0];

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), "sg-wsp6-interactive-"));
  await mkdir(path.join(root, "sg"), { recursive: true });
  const users = [
    ["usr_owner", "10"],
    ["usr_one", "30"],
    ["usr_two", "31"],
  ] as const;
  await writeFile(
    path.join(root, "sg", "global-profiles.json"),
    JSON.stringify({
      version: 3,
      profiles: users.map(([globalId, senderId]) => ({
        globalId,
        canonicalIdentity: `channel:telegram:${senderId}`,
        role: "citizen",
        status: "active",
        createdAt: timestamp,
        updatedAt: timestamp,
      })),
      identities: users.map(([globalId, senderId]) => ({
        canonicalIdentity: `channel:telegram:${senderId}`,
        globalId,
        createdAt: timestamp,
        updatedAt: timestamp,
      })),
      citizenRequests: [],
      audit: [],
    }),
  );

  const workspace = await new SgWorkspaceRegistry(root).register({
    platform: "telegram",
    accountId: "default",
    resourceId: "telegram:-100500",
    resourceKind: "group",
    title: "Interactive test",
    ownerGlobalId: "usr_owner",
    status: "active",
    settings: {},
  });
  const memberships = new SgWorkspaceMembershipRegistry(root);
  for (const globalId of ["usr_one", "usr_two"]) {
    await memberships.grant({
      actorGlobalId: "usr_owner",
      workspaceId: workspace.workspaceId,
      targetGlobalId: globalId,
      role: "member",
    });
  }

  const assessments = new SgAssessmentRegistry(openSgAssessmentStores(root));
  const definition = await assessments.create({
    testId: "interactive",
    workspaceId: workspace.workspaceId,
    title: "Точный тест",
    kind: "knowledge",
    actorGlobalId: "usr_owner",
    questions: [
      {
        questionId: "q1",
        prompt: "Первый вопрос?",
        options: [
          { optionId: "yes", label: "Да", points: 1 },
          { optionId: "no", label: "Нет", points: 0 },
        ],
      },
      {
        questionId: "q2",
        prompt: "Второй вопрос?",
        options: [
          { optionId: "one", label: "Один", points: 2 },
          { optionId: "two", label: "Два", points: 0 },
        ],
      },
    ],
  });
  await assessments.setStatus(definition.testId, "active");

  let registration: InteractiveRegistration | undefined;
  const sendText = vi.fn(async (_params: unknown) => ({
    channel: "telegram",
    messageId: "dm-result",
  }));
  const controller = new Wsp6InteractiveController(root, () => assessments, {
    config: {} as OpenClawPluginApi["config"],
    registerInteractiveHandler: (value) => {
      registration = value;
    },
    loadOutboundAdapter: vi.fn(async () => ({ deliveryMode: "direct" as const, sendText })),
  });
  controller.register();
  if (!registration) {
    throw new Error("interactive handler was not registered");
  }
  return { assessments, controller, definition, handler: registration.handler, sendText };
}

function callbackPayload(value: string): string {
  const prefix = `${WSP6_CALLBACK_NAMESPACE}:`;
  if (!value.startsWith(prefix)) {
    throw new Error("invalid callback namespace");
  }
  return value.slice(prefix.length);
}

function callbackContext(senderId: string, payload: string) {
  return {
    channel: "telegram",
    accountId: "default",
    senderId,
    isGroup: true,
    auth: { isAuthorizedSender: true },
    callback: { namespace: WSP6_CALLBACK_NAMESPACE, payload, chatId: "-100500" },
    respond: {
      reply: vi.fn(async (_params: unknown) => {}),
      editMessage: vi.fn(async (_params: unknown) => {}),
    },
  };
}

type TelegramButton = { text: string; callback_data: string };

function firstButton(call: unknown): TelegramButton {
  const response = call as { buttons?: TelegramButton[][] };
  const button = response.buttons?.[0]?.[0];
  if (!button) {
    throw new Error("callback button missing");
  }
  return button;
}

describe("WSP6 interactive callbacks", () => {
  it("keeps the shared start button and creates independent attempts for two Global IDs", async () => {
    const { controller, definition, handler } = await fixture();
    const startValue = wsp6StartCallbackValue(definition);
    const first = callbackContext("30", callbackPayload(startValue));
    const second = callbackContext("31", callbackPayload(startValue));

    await handler(first as CallbackContext);
    await handler(second as CallbackContext);

    expect(first.respond.editMessage).not.toHaveBeenCalled();
    expect(second.respond.editMessage).not.toHaveBeenCalled();
    const firstAnswer = firstButton(first.respond.reply.mock.calls[0]?.[0]);
    const secondAnswer = firstButton(second.respond.reply.mock.calls[0]?.[0]);
    expect(firstAnswer.callback_data).not.toBe(secondAnswer.callback_data);
    expect(controller.snapshot()).toMatchObject({ registered: true, started: 2, failed: 0 });
  });

  it("replaces questions, rejects another participant, and makes an answer replay idempotent", async () => {
    const { assessments, definition, handler } = await fixture();
    const owner = callbackContext("30", callbackPayload(wsp6StartCallbackValue(definition)));
    await handler(owner as CallbackContext);
    const firstAnswer = firstButton(owner.respond.reply.mock.calls[0]?.[0]);

    const intruder = callbackContext("31", callbackPayload(firstAnswer.callback_data));
    await handler(intruder as CallbackContext);
    expect(intruder.respond.reply).toHaveBeenCalledWith({
      text: "Эта кнопка относится к попытке другого участника.",
    });
    expect(intruder.respond.editMessage).not.toHaveBeenCalled();

    owner.callback.payload = callbackPayload(firstAnswer.callback_data);
    await handler(owner as CallbackContext);
    const nextCall = owner.respond.editMessage.mock.calls.at(-1)?.[0];
    expect(nextCall).toMatchObject({ text: expect.stringContaining("Вопрос 2/2") });
    const nextAnswer = firstButton(nextCall);

    await handler(owner as CallbackContext);
    const replayCall = owner.respond.editMessage.mock.calls.at(-1)?.[0];
    expect(firstButton(replayCall).callback_data).toBe(nextAnswer.callback_data);

    const attemptId = firstAnswer.callback_data.split(":")[2];
    await expect(assessments.resume(attemptId ?? "", "usr_one")).resolves.toMatchObject({
      status: "active",
      attempt: { answers: [{ questionId: "q1", optionId: "yes" }] },
    });
  });

  it("sends the exact result privately and keeps scores out of the group message", async () => {
    const { definition, handler, sendText } = await fixture();
    const ctx = callbackContext("30", callbackPayload(wsp6StartCallbackValue(definition)));
    await handler(ctx as CallbackContext);

    const first = firstButton(ctx.respond.reply.mock.calls[0]?.[0]);
    ctx.callback.payload = callbackPayload(first.callback_data);
    await handler(ctx as CallbackContext);
    const second = firstButton(ctx.respond.editMessage.mock.calls.at(-1)?.[0]);
    ctx.callback.payload = callbackPayload(second.callback_data);
    await handler(ctx as CallbackContext);

    expect(sendText).toHaveBeenCalledWith({
      cfg: {},
      to: "30",
      text: expect.stringContaining("Баллы: 3 из 3"),
      accountId: "default",
    });
    const groupResult = ctx.respond.editMessage.mock.calls.at(-1)?.[0];
    expect(groupResult).toEqual({
      text: "Тест завершён. Личный результат отправлен в личные сообщения.",
      buttons: [],
    });
    expect(JSON.stringify(groupResult)).not.toContain("3 из 3");
  });

  it("keeps every emitted Telegram callback_data within 64 UTF-8 bytes", async () => {
    const { definition, handler } = await fixture();
    const startValue = wsp6StartCallbackValue(definition);
    const opaqueEnvelopeBytes = Buffer.byteLength("tgcb1:00000:", "utf8");
    expect(Buffer.byteLength(startValue, "utf8") + opaqueEnvelopeBytes).toBeLessThanOrEqual(64);

    const ctx = callbackContext("30", callbackPayload(startValue));
    await handler(ctx as CallbackContext);
    const response = ctx.respond.reply.mock.calls[0]?.[0] as { buttons?: TelegramButton[][] };
    for (const button of response.buttons?.flat() ?? []) {
      expect(Buffer.byteLength(button.callback_data, "utf8")).toBeLessThanOrEqual(64);
    }
  });
});
