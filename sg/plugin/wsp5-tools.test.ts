import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { SgContentRegistry } from "./content-registry.js";
import { SgWorkspaceMembershipRegistry } from "./workspace-memberships.js";
import { SgWorkspaceRegistry } from "./workspace-registry.js";
import { Wsp5NativeLifecycle } from "./wsp5-lifecycle.js";
import { createWsp5Tools } from "./wsp5-tools.js";

const timestamp = "2026-01-01T00:00:00.000Z";

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), "sg-wsp5-tools-"));
  await mkdir(path.join(root, "sg"), { recursive: true });
  const users = [
    ["usr_owner", "10"],
    ["usr_admin", "20"],
    ["usr_member", "30"],
    ["usr_guest", "40"],
  ] as const;
  await writeFile(
    path.join(root, "sg", "global-profiles.json"),
    JSON.stringify({
      version: 3,
      profiles: users.slice(0, 3).map(([globalId, senderId]) => ({
        globalId,
        canonicalIdentity: `channel:telegram:${senderId}`,
        role: "citizen",
        status: "active",
        createdAt: timestamp,
        updatedAt: timestamp,
      })),
      identities: users.slice(0, 3).map(([globalId, senderId]) => ({
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
    title: "SG Tools Test",
    ownerGlobalId: "usr_owner",
    status: "active",
    settings: {},
  });
  const memberships = new SgWorkspaceMembershipRegistry(root);
  await memberships.grant({
    actorGlobalId: "usr_owner",
    workspaceId: workspace.workspaceId,
    targetGlobalId: "usr_admin",
    role: "admin",
  });
  await memberships.grant({
    actorGlobalId: "usr_owner",
    workspaceId: workspace.workspaceId,
    targetGlobalId: "usr_member",
    role: "member",
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

describe("SG Workspace Manager WSP5 role tools", () => {
  it("lets a member create, edit and submit only their draft", async () => {
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
      draft: { creatorGlobalId: "usr_member", editorialStatus: "draft" },
    });
    const draftId = (created.draft as { draftId: string }).draftId;
    const submitted = details(await draftTool.execute("submit", { action: "submit", draftId }));
    expect(submitted).toMatchObject({ status: "pending", draft: { editorialStatus: "pending" } });
  });

  it("denies review and publication to member but allows admin", async () => {
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

    const adminTools = createWsp5Tools(toolContext("20", "session-admin"), root, lifecycle);
    const approved = details(
      await findTool(adminTools, "sg_content_review").execute("review-admin", {
        draftId,
        decision: "approve",
      }),
    );
    expect(approved).toMatchObject({ status: "approved" });

    const memberPublish = details(
      await findTool(memberTools, "sg_content_publish").execute("publish-member", { draftId }),
    );
    expect(memberPublish).toEqual({ status: "denied", reason: "sg-content-editor-required" });

    const adminPublish = details(
      await findTool(adminTools, "sg_content_publish").execute("publish-admin", { draftId }),
    );
    expect(adminPublish).toMatchObject({
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

  it("does not treat an unregistered group participant as a member", async () => {
    const { root, workspace, lifecycle } = await fixture();
    const guestTools = createWsp5Tools(toolContext("40", "session-guest"), root, lifecycle);
    const result = details(
      await findTool(guestTools, "sg_content_draft").execute("create-guest", {
        action: "create",
        workspaceId: workspace.workspaceId,
        text: "Недоступный черновик",
      }),
    );
    expect(result).toEqual({ status: "denied", reason: "sg-content-citizen-required" });
  });

  it("returns an exact native automations action for an approved schedule", async () => {
    const { root, workspace, contents, lifecycle } = await fixture();
    const draft = await contents.create({
      workspaceId: workspace.workspaceId,
      creatorGlobalId: "usr_member",
      text: "Запланированный материал",
      media: [],
      highImpact: false,
    });
    await contents.submit(draft.draftId, "usr_member", false);
    await contents.review({
      draftId: draft.draftId,
      actorGlobalId: "usr_admin",
      decision: "approve",
    });
    const at = new Date(Date.now() + 3_600_000).toISOString();
    const adminTools = createWsp5Tools(toolContext("20", "session-schedule"), root, lifecycle);
    const result = details(
      await findTool(adminTools, "sg_content_schedule").execute("schedule", {
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
