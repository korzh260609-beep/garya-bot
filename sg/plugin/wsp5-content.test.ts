import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { SgContentRegistry, type SgContentDraft, type SgContentScope } from "./content-registry.js";
import { SgWorkspaceRegistry } from "./workspace-registry.js";
import {
  buildWsp5MessageAction,
  buildWsp5ScheduleAdd,
  buildWsp5ScheduleRemove,
  buildWsp5ScheduleUpdate,
  Wsp5NativeLifecycle,
} from "./wsp5-lifecycle.js";

type Hook = (event: Record<string, unknown>, ctx: Record<string, unknown>) => unknown;

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), "sg-wsp5-content-"));
  const workspaceRegistry = new SgWorkspaceRegistry(root);
  const resource = await workspaceRegistry.register({
    platform: "telegram",
    accountId: "default",
    resourceId: "telegram:-100500",
    resourceKind: "group",
  });
  const contentScope = {
    kind: "resource",
    resourceScopeId: resource.resourceScopeId,
  } as const;
  const target = {
    platform: resource.platform,
    accountId: resource.accountId,
    resourceId: resource.resourceId,
  };
  return { root, contentScope, target, contents: new SgContentRegistry(root) };
}

async function approvedDraft(
  contents: SgContentRegistry,
  scope: SgContentScope,
  input: { highImpact?: boolean; media?: boolean } = {},
): Promise<SgContentDraft> {
  const draft = await contents.create({
    scope,
    creatorGlobalId: "usr_member",
    text: "Точный текст публикации",
    media: input.media ? [{ type: "image", media: "https://example.test/image.png" }] : [],
    highImpact: input.highImpact ?? false,
  });
  await contents.submit(draft.draftId, scope, "usr_member");
  return contents.review({
    draftId: draft.draftId,
    scope,
    actorGlobalId: "usr_admin",
    decision: "approve",
  });
}

function registeredLifecycle(contents: SgContentRegistry) {
  const hooks = new Map<string, Hook[]>();
  const lifecycle = new Wsp5NativeLifecycle(contents);
  lifecycle.register({
    on: vi.fn((name: string, handler: Hook) => {
      const list = hooks.get(name) ?? [];
      list.push(handler);
      hooks.set(name, list);
    }),
  } as never);
  return { lifecycle, hooks };
}

async function runHook(
  hooks: Map<string, Hook[]>,
  name: string,
  event: Record<string, unknown>,
  ctx: Record<string, unknown>,
) {
  let result: unknown;
  for (const hook of hooks.get(name) ?? []) {
    result = (await hook(event, ctx)) ?? result;
  }
  return result;
}

describe("SG Workspace Manager WSP5 content state", () => {
  it("keeps member editing limited to the creator and resets approval on edits", async () => {
    const { contents, contentScope } = await fixture();
    const approved = await approvedDraft(contents, contentScope);

    await expect(
      contents.update({
        draftId: approved.draftId,
        scope: contentScope,
        actorGlobalId: "usr_other_member",
        text: "Чужое изменение",
      }),
    ).rejects.toThrow("sg-content-own-draft-required");

    const updated = await contents.update({
      draftId: approved.draftId,
      scope: contentScope,
      actorGlobalId: "usr_member",
      text: "Новая редакция",
    });
    expect(updated).toMatchObject({
      revision: 2,
      editorialStatus: "draft",
      deliveryStatus: "none",
    });
    expect(updated).not.toHaveProperty("approvedByGlobalId");
  });

  it("atomically records editor approval before a direct publication", async () => {
    const { contents, contentScope, target } = await fixture();
    const draft = await contents.create({
      scope: contentScope,
      creatorGlobalId: "usr_owner",
      text: "Прямая публикация владельца",
      media: [],
      highImpact: false,
    });

    await expect(contents.beginPublish(draft.draftId, contentScope, "usr_owner")).rejects.toThrow(
      "sg-content-approval-required",
    );

    const operation = await contents.beginPublish(draft.draftId, contentScope, "usr_owner", true);
    const publishing = await contents.findDraft(draft.draftId, contentScope);
    const params = buildWsp5MessageAction(publishing!, target);
    const { lifecycle, hooks } = registeredLifecycle(contents);
    lifecycle.queue({
      sessionKey: "session-owner-direct",
      actorGlobalId: "usr_owner",
      operation,
      toolName: "message",
      params,
      requireApproval: false,
      target,
    });
    await runHook(
      hooks,
      "after_tool_call",
      { toolName: "message", params, result: { details: { messageId: "telegram-owner-1" } } },
      { sessionKey: "session-owner-direct" },
    );

    const snapshot = await contents.snapshot();
    expect(snapshot.drafts[0]).toMatchObject({
      editorialStatus: "approved",
      deliveryStatus: "published",
      approvedByGlobalId: "usr_owner",
    });
    expect(snapshot.publications[0]).toMatchObject({
      status: "published",
      nativeResultId: "telegram-owner-1",
    });
    expect(snapshot.audit.map((event) => event.action)).toEqual([
      "create",
      "approve",
      "publish_request",
      "publish_success",
    ]);
    expect(snapshot.audit[1]?.operationId).toBe(snapshot.audit[2]?.operationId);
  });

  it("publishes text and representative media only after an exact native message action", async () => {
    const { contents, contentScope, target } = await fixture();
    const draft = await approvedDraft(contents, contentScope, { media: true });
    const operation = await contents.beginPublish(draft.draftId, contentScope, "usr_admin");
    const publishing = await contents.findDraft(draft.draftId, contentScope);
    const params = buildWsp5MessageAction(publishing!, target);
    const { lifecycle, hooks } = registeredLifecycle(contents);
    lifecycle.queue({
      sessionKey: "session-publish",
      actorGlobalId: "usr_admin",
      operation,
      toolName: "message",
      params,
      requireApproval: false,
      target,
    });

    await runHook(
      hooks,
      "after_tool_call",
      { toolName: "message", params, result: { details: { messageId: "telegram-42" } } },
      { sessionKey: "session-publish" },
    );
    const snapshot = await contents.snapshot();
    expect(snapshot.drafts[0]).toMatchObject({ deliveryStatus: "published" });
    expect(snapshot.publications[0]).toMatchObject({
      status: "published",
      mode: "now",
      platform: "telegram",
      target: "telegram:-100500",
      nativeResultId: "telegram-42",
    });
    expect(params).toMatchObject({
      action: "send",
      channel: "telegram",
      target: "telegram:-100500",
      message: "Точный текст публикации",
      attachments: [{ type: "image", media: "https://example.test/image.png" }],
    });
  });

  it("blocks a changed destination and records no false publication success", async () => {
    const { contents, contentScope, target } = await fixture();
    const draft = await approvedDraft(contents, contentScope);
    const operation = await contents.beginPublish(draft.draftId, contentScope, "usr_admin");
    const params = buildWsp5MessageAction(
      (await contents.findDraft(draft.draftId, contentScope))!,
      target,
    );
    const { lifecycle, hooks } = registeredLifecycle(contents);
    lifecycle.queue({
      sessionKey: "session-block",
      actorGlobalId: "usr_admin",
      operation,
      toolName: "message",
      params,
      requireApproval: false,
      target,
    });

    await expect(
      runHook(
        hooks,
        "before_tool_call",
        { toolName: "message", params: { ...params, target: "telegram:-999" } },
        { sessionKey: "session-block" },
      ),
    ).resolves.toMatchObject({ block: true });
    await runHook(hooks, "before_agent_reply", {}, { sessionKey: "session-block" });
    const snapshot = await contents.snapshot();
    expect(snapshot.drafts[0]).toMatchObject({
      deliveryStatus: "failed",
      lastError: "native-action-not-executed",
    });
    expect(snapshot.publications[0]).toMatchObject({ status: "failed" });
    expect(lifecycle.snapshot()).toMatchObject({ blocked: 1, succeeded: 0, failed: 1 });
  });

  it("uses the native approval gate for high-impact publication", async () => {
    const { contents, contentScope, target } = await fixture();
    const draft = await approvedDraft(contents, contentScope, { highImpact: true });
    const operation = await contents.beginPublish(draft.draftId, contentScope, "usr_admin");
    const params = buildWsp5MessageAction(
      (await contents.findDraft(draft.draftId, contentScope))!,
      target,
    );
    const { lifecycle, hooks } = registeredLifecycle(contents);
    lifecycle.queue({
      sessionKey: "session-approval",
      actorGlobalId: "usr_admin",
      operation,
      toolName: "message",
      params,
      requireApproval: true,
      target,
    });

    await expect(
      runHook(
        hooks,
        "before_tool_call",
        { toolName: "message", params },
        { sessionKey: "session-approval" },
      ),
    ).resolves.toMatchObject({
      requireApproval: { severity: "warning", pluginId: "sg-workspace-manager" },
    });
  });

  it("persists a native schedule across restart and preserves the selected scope", async () => {
    const { root, contents, contentScope, target } = await fixture();
    const draft = await approvedDraft(contents, contentScope);
    const at = new Date(Date.now() + 3_600_000).toISOString();
    const begun = await contents.beginSchedule({
      draftId: draft.draftId,
      scope: contentScope,
      actorGlobalId: "usr_admin",
      at,
    });
    const scheduling = await contents.findDraft(draft.draftId, contentScope);
    const params = buildWsp5ScheduleAdd(scheduling!, begun.dispatchToken);
    const { lifecycle, hooks } = registeredLifecycle(contents);
    lifecycle.queue({
      sessionKey: "session-schedule",
      actorGlobalId: "usr_admin",
      operation: begun.operation,
      toolName: "automations",
      params,
      requireApproval: false,
      target,
    });
    await runHook(
      hooks,
      "after_tool_call",
      { toolName: "cron", params, result: { details: { id: "cron-job-1" } } },
      { sessionKey: "session-schedule" },
    );

    const restarted = new SgContentRegistry(root);
    await expect(restarted.findDraft(draft.draftId, contentScope)).resolves.toMatchObject({
      deliveryStatus: "scheduled",
      scheduledAt: at,
      automationJobId: "cron-job-1",
      dispatchToken: begun.dispatchToken,
    });
    expect(params).toMatchObject({
      action: "add",
      job: {
        schedule: { kind: "at", at },
        sessionTarget: "isolated",
        delivery: { mode: "none" },
      },
    });
  });

  it("reschedules through automations and restores the prior time when native update fails", async () => {
    const { contents, contentScope } = await fixture();
    const draft = await approvedDraft(contents, contentScope);
    const firstAt = new Date(Date.now() + 3_600_000).toISOString();
    const scheduled = await contents.beginSchedule({
      draftId: draft.draftId,
      scope: contentScope,
      actorGlobalId: "usr_admin",
      at: firstAt,
    });
    await contents.finishNative({
      operation: scheduled.operation,
      success: true,
      actorGlobalId: "usr_admin",
      automationJobId: "cron-job-1",
    });
    const secondAt = new Date(Date.now() + 7_200_000).toISOString();
    const moved = await contents.beginReschedule({
      draftId: draft.draftId,
      scope: contentScope,
      actorGlobalId: "usr_admin",
      at: secondAt,
    });
    expect(buildWsp5ScheduleUpdate(moved.jobId, secondAt)).toEqual({
      action: "update",
      jobId: "cron-job-1",
      job: { schedule: { kind: "at", at: secondAt } },
    });
    await contents.finishNative({
      operation: moved.operation,
      success: false,
      actorGlobalId: "usr_admin",
      error: "gateway-unavailable",
    });
    await expect(contents.findDraft(draft.draftId, contentScope)).resolves.toMatchObject({
      deliveryStatus: "scheduled",
      scheduledAt: firstAt,
      automationJobId: "cron-job-1",
      lastError: "gateway-unavailable",
    });
  });

  it("cancels through automations and prevents later scheduled delivery", async () => {
    const { contents, contentScope } = await fixture();
    const draft = await approvedDraft(contents, contentScope);
    const scheduled = await contents.beginSchedule({
      draftId: draft.draftId,
      scope: contentScope,
      actorGlobalId: "usr_admin",
      at: new Date(Date.now() + 3_600_000).toISOString(),
    });
    await contents.finishNative({
      operation: scheduled.operation,
      success: true,
      actorGlobalId: "usr_admin",
      automationJobId: "cron-job-1",
    });
    const cancel = await contents.beginCancel(draft.draftId, contentScope, "usr_admin");
    expect(buildWsp5ScheduleRemove(cancel.jobId)).toEqual({
      action: "remove",
      jobId: "cron-job-1",
    });
    await contents.finishNative({
      operation: cancel.operation,
      success: true,
      actorGlobalId: "usr_admin",
    });
    const cancelled = await contents.findDraft(draft.draftId, contentScope);
    expect(cancelled).toMatchObject({ deliveryStatus: "cancelled" });
    expect(cancelled).not.toHaveProperty("automationJobId");
    expect(cancelled).not.toHaveProperty("dispatchToken");
    await expect(
      contents.beginScheduledDispatch(draft.draftId, scheduled.dispatchToken),
    ).rejects.toThrow("sg-content-scheduled-dispatch-denied");
  });
});
