import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { SgContentRegistry } from "./content-registry.js";
import { SgWorkspaceRegistry } from "./workspace-registry.js";
import { Wsp5NativeLifecycle } from "./wsp5-lifecycle.js";
import { createWsp5Tools } from "./wsp5-tools.js";

const timestamp = "2026-01-01T00:00:00.000Z";

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), "sg-wsp5-tools-"));
  await mkdir(path.join(root, "sg"), { recursive: true });
  const users = [
    ["usr_monarch", "10", "monarch"],
    ["usr_citizen_a", "20", "citizen"],
    ["usr_citizen_b", "30", "citizen"],
    ["usr_citizen_c", "40", "citizen"],
  ] as const;
  await writeFile(
    path.join(root, "sg", "global-profiles.json"),
    JSON.stringify({
      version: 5,
      monarchGlobalId: "usr_monarch",
      profiles: users.map(([globalId, senderId, role]) => ({
        globalId,
        canonicalIdentity: `channel:telegram:${senderId}`,
        role,
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
    }),
  );
  const workspace = await new SgWorkspaceRegistry(root).register({
    platform: "telegram",
    accountId: "default",
    resourceId: "telegram:-100500",
    resourceKind: "group",
    title: "SG Tools Test",
    ownerGlobalId: "usr_monarch",
    status: "active",
    settings: {},
  });
  const contents = new SgContentRegistry(root);
  const lifecycle = new Wsp5NativeLifecycle(contents);
  return { root, workspace, contents, lifecycle };
}

function toolContext(senderId: string, sessionKey: string) {
  return {
    config: {},
    messageChannel: "telegram",
    agentAccountId: "default",
    nativeChannelId: "telegram:-100500",
    requesterSenderId: senderId,
    sessionKey,
  };
}

function details(result: unknown): Record<string, unknown> {
  return (result as { details: Record<string, unknown> }).details;
}

function findTool(tools: ReturnType<typeof createWsp5Tools>, name: string) {
  const tool = tools.find((item) => item.name === name);
  if (!tool) {
    throw new Error(`missing tool ${name}`);
  }
  return tool;
}

describe("SG Workspace Manager WSP5 tools", () => {
  it("lets a citizen create, edit and submit only their draft", async () => {
    const { root, workspace, lifecycle } = await fixture();
    const tools = createWsp5Tools(toolContext("30", "session-member"), root, lifecycle);
    const draftTool = findTool(tools, "sg_content_draft");
    const created = details(
      await draftTool.execute("create", {
        action: "create",
        workspaceId: workspace.workspaceId,
        text: "Черновик участника",
      }),
    );
    expect(created).toMatchObject({
      status: "created",
      draft: { creatorGlobalId: "usr_citizen_b", editorialStatus: "draft" },
    });
    const draftId = (created.draft as { draftId: string }).draftId;
    const submitted = details(await draftTool.execute("submit", { action: "submit", draftId }));
    expect(submitted).toMatchObject({ status: "pending", draft: { editorialStatus: "pending" } });
  });

  it("denies review and publication to a citizen but allows the monarch", async () => {
    const { root, workspace, lifecycle } = await fixture();
    const memberTools = createWsp5Tools(toolContext("30", "session-member"), root, lifecycle);
    const draftTool = findTool(memberTools, "sg_content_draft");
    const created = details(
      await draftTool.execute("create", {
        action: "create",
        workspaceId: workspace.workspaceId,
        text: "Материал",
      }),
    );
    const draftId = (created.draft as { draftId: string }).draftId;
    await draftTool.execute("submit", { action: "submit", draftId });

    const memberReview = details(
      await findTool(memberTools, "sg_content_review").execute("review-member", {
        draftId,
        decision: "approve",
      }),
    );
    expect(memberReview).toEqual({ status: "denied", reason: "sg-content-editor-required" });

    const monarchTools = createWsp5Tools(toolContext("10", "session-monarch"), root, lifecycle);
    const approved = details(
      await findTool(monarchTools, "sg_content_review").execute("review-monarch", {
        draftId,
        decision: "approve",
      }),
    );
    expect(approved).toMatchObject({ status: "approved" });

    const memberPublish = details(
      await findTool(memberTools, "sg_content_publish").execute("publish-member", { draftId }),
    );
    expect(memberPublish).toEqual({ status: "denied", reason: "sg-content-editor-required" });

    const monarchPublish = details(
      await findTool(monarchTools, "sg_content_publish").execute("publish-monarch", { draftId }),
    );
    expect(monarchPublish).toMatchObject({
      status: "native_action_required",
      nextTool: "message",
      nextAction: {
        action: "send",
        channel: "telegram",
        target: "telegram:-100500",
        message: "Материал",
      },
    });
  });

  it("treats a monarch publish command as approval without a second confirmation", async () => {
    const { root, workspace, contents, lifecycle } = await fixture();
    const monarchTools = createWsp5Tools(
      toolContext("10", "session-monarch-publish"),
      root,
      lifecycle,
    );
    const created = details(
      await findTool(monarchTools, "sg_content_draft").execute("create-monarch", {
        action: "create",
        workspaceId: workspace.workspaceId,
        text: "Материал владельца",
      }),
    );
    const draftId = (created.draft as { draftId: string }).draftId;

    const published = details(
      await findTool(monarchTools, "sg_content_publish").execute("publish-monarch", { draftId }),
    );

    expect(published).toMatchObject({
      status: "native_action_required",
      nextTool: "message",
      nextAction: {
        action: "send",
        channel: "telegram",
        target: "telegram:-100500",
        message: "Материал владельца",
      },
    });
    await expect(contents.findDraft(draftId)).resolves.toMatchObject({
      editorialStatus: "approved",
      deliveryStatus: "publishing",
      approvedByGlobalId: "usr_monarch",
    });
    expect((await contents.snapshot()).audit.slice(-2).map((event) => event.action)).toEqual([
      "approve",
      "publish_request",
    ]);
  });

  it("lets the monarch publish a pending citizen draft as the approval decision", async () => {
    const { root, workspace, contents, lifecycle } = await fixture();
    const memberTools = createWsp5Tools(
      toolContext("30", "session-member-submit"),
      root,
      lifecycle,
    );
    const created = details(
      await findTool(memberTools, "sg_content_draft").execute("create-member", {
        action: "create",
        workspaceId: workspace.workspaceId,
        text: "Материал участника",
      }),
    );
    const draftId = (created.draft as { draftId: string }).draftId;
    await findTool(memberTools, "sg_content_draft").execute("submit-member", {
      action: "submit",
      draftId,
    });

    const monarchTools = createWsp5Tools(
      toolContext("10", "session-monarch-publish"),
      root,
      lifecycle,
    );
    const published = details(
      await findTool(monarchTools, "sg_content_publish").execute("publish-monarch", { draftId }),
    );

    expect(published).toMatchObject({ status: "native_action_required", nextTool: "message" });
    await expect(contents.findDraft(draftId)).resolves.toMatchObject({
      editorialStatus: "approved",
      deliveryStatus: "publishing",
      approvedByGlobalId: "usr_monarch",
    });
  });

  it("lets a citizen work without an SG workspace membership record", async () => {
    const { root, workspace, lifecycle } = await fixture();
    const citizenTools = createWsp5Tools(toolContext("40", "session-citizen"), root, lifecycle);
    const result = details(
      await findTool(citizenTools, "sg_content_draft").execute("create-citizen", {
        action: "create",
        workspaceId: workspace.workspaceId,
        text: "Недоступный черновик",
      }),
    );
    expect(result).toMatchObject({
      status: "created",
      draft: { creatorGlobalId: "usr_citizen_c" },
    });
  });

  it("returns an exact native automations action for an approved schedule", async () => {
    const { root, workspace, contents, lifecycle } = await fixture();
    const draft = await contents.create({
      workspaceId: workspace.workspaceId,
      creatorGlobalId: "usr_citizen_b",
      text: "Запланированный материал",
      media: [],
      highImpact: false,
    });
    await contents.submit(draft.draftId, "usr_citizen_b", false);
    await contents.review({
      draftId: draft.draftId,
      actorGlobalId: "usr_monarch",
      decision: "approve",
    });
    const at = new Date(Date.now() + 3_600_000).toISOString();
    const monarchTools = createWsp5Tools(toolContext("10", "session-schedule"), root, lifecycle);
    const result = details(
      await findTool(monarchTools, "sg_content_schedule").execute("schedule", {
        action: "schedule",
        draftId: draft.draftId,
        at,
      }),
    );
    expect(result).toMatchObject({
      status: "native_action_required",
      nextTool: "automations",
      nextAction: {
        action: "add",
        job: {
          schedule: { kind: "at", at },
          sessionTarget: "isolated",
          delivery: { mode: "none" },
        },
      },
    });
  });
});
