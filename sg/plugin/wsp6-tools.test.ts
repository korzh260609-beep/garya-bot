import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type {
  PluginStateEntry,
  PluginStateKeyedStore,
} from "openclaw/plugin-sdk/plugin-state-runtime";
import { describe, expect, it } from "vitest";
import { SgWorkspaceMembershipRegistry } from "./workspace-memberships.js";
import { SgWorkspaceRegistry } from "./workspace-registry.js";
import {
  SgAssessmentRegistry,
  type SgAssessmentAttempt,
  type SgAssessmentDefinition,
} from "./wsp6-assessments.js";
import { Wsp6NativeLifecycle } from "./wsp6-lifecycle.js";
import { createWsp6Tools, WSP6_AGENT_GUIDANCE } from "./wsp6-tools.js";

const timestamp = "2026-01-01T00:00:00.000Z";

class MemoryStore<T> implements PluginStateKeyedStore<T> {
  private readonly values = new Map<string, PluginStateEntry<T>>();

  async register(key: string, value: T): Promise<void> {
    this.values.set(key, { key, value: structuredClone(value), createdAt: Date.now() });
  }

  async registerIfAbsent(key: string, value: T): Promise<boolean> {
    if (this.values.has(key)) {
      return false;
    }
    await this.register(key, value);
    return true;
  }

  async update(
    key: string,
    updateValue: (current: T | undefined) => T | undefined,
  ): Promise<boolean> {
    const next = updateValue(structuredClone(this.values.get(key)?.value));
    if (next === undefined) {
      return this.values.delete(key);
    }
    await this.register(key, next);
    return true;
  }

  async lookup(key: string): Promise<T | undefined> {
    const value = this.values.get(key)?.value;
    return value === undefined ? undefined : structuredClone(value);
  }

  async consume(key: string): Promise<T | undefined> {
    const value = await this.lookup(key);
    this.values.delete(key);
    return value;
  }

  async delete(key: string): Promise<boolean> {
    return this.values.delete(key);
  }

  async entries(): Promise<PluginStateEntry<T>[]> {
    return structuredClone([...this.values.values()]);
  }

  async clear(): Promise<void> {
    this.values.clear();
  }
}

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), "sg-wsp6-tools-"));
  await mkdir(path.join(root, "sg"), { recursive: true });
  const users = [
    ["usr_owner", "10"],
    ["usr_admin", "20"],
    ["usr_member", "30"],
    ["usr_outsider", "40"],
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
    title: "WSP6 Test",
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
  const assessments = new SgAssessmentRegistry({
    definitions: new MemoryStore<SgAssessmentDefinition>(),
    attempts: new MemoryStore<SgAssessmentAttempt>(),
  });
  const lifecycle = new Wsp6NativeLifecycle();
  return { root, workspace, memberships, assessments, lifecycle };
}

function toolContext(senderId: string, sessionKey: string, privateChat = false) {
  return {
    config: {},
    messageChannel: "telegram",
    agentAccountId: "default",
    nativeChannelId: privateChat ? `telegram:${senderId}` : "telegram:-100500",
    requesterSenderId: senderId,
    sessionKey,
  };
}

function details(result: unknown): Record<string, unknown> {
  return (result as { details: Record<string, unknown> }).details;
}

function findTool(tools: ReturnType<typeof createWsp6Tools>, name: string) {
  const tool = tools.find((item) => item.name === name);
  if (!tool) {
    throw new Error(`missing tool ${name}`);
  }
  return tool;
}

async function createActiveTest(assessments: SgAssessmentRegistry, workspaceId: string) {
  await assessments.create({
    testId: "quick",
    workspaceId,
    title: "Быстрый тест",
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
  await assessments.setStatus("quick", "active");
}

describe("WSP6 assessment tools", () => {
  it("allows managers to define tests and denies management to members", async () => {
    const { root, workspace, assessments, lifecycle } = await fixture();
    const definition = {
      action: "create",
      workspaceId: workspace.workspaceId,
      testId: "managed",
      title: "Управляемый тест",
      kind: "knowledge",
      questions: [
        {
          questionId: "q1",
          prompt: "Выберите ответ",
          options: [
            { optionId: "a", label: "A", points: 1 },
            { optionId: "b", label: "B", points: 0 },
          ],
        },
      ],
    };
    const member = createWsp6Tools(toolContext("30", "member"), root, assessments, lifecycle);
    expect(details(await findTool(member, "sg_test_manage").execute("member", definition))).toEqual(
      { status: "denied", reason: "sg-test-manager-required" },
    );

    const admin = createWsp6Tools(toolContext("20", "admin"), root, assessments, lifecycle);
    expect(
      details(await findTool(admin, "sg_test_manage").execute("admin", definition)),
    ).toMatchObject({ status: "created", test: { testId: "managed", status: "draft" } });
    expect(
      details(
        await findTool(admin, "sg_test_manage").execute("activate", {
          action: "activate",
          testId: "managed",
        }),
      ),
    ).toMatchObject({ status: "active" });
  });

  it("starts a separate attempt and returns an exact native private poll action", async () => {
    const { root, workspace, assessments, lifecycle } = await fixture();
    await createActiveTest(assessments, workspace.workspaceId);
    const tools = createWsp6Tools(
      toolContext("30", "agent:main:group:-100500"),
      root,
      assessments,
      lifecycle,
    );
    const result = details(
      await findTool(tools, "sg_test_attempt").execute("start", {
        action: "start",
        workspaceId: workspace.workspaceId,
        testId: "quick",
      }),
    );
    expect(result).toMatchObject({
      status: "native_action_required",
      nextTool: "message",
      nextAction: {
        action: "poll",
        channel: "telegram",
        target: "30",
        pollQuestion: expect.stringMatching(/^\[SG:att_.+:q1\] 1\/2\./u),
        pollOption: ["Да", "Нет"],
        pollMulti: false,
        pollPublic: true,
      },
    });
    expect(lifecycle.snapshot()).toMatchObject({ pending: 1, queued: 1 });
  });

  it("advances from a poll label and returns deterministic results only in private chat", async () => {
    const { root, workspace, assessments, lifecycle } = await fixture();
    await createActiveTest(assessments, workspace.workspaceId);
    const started = await assessments.start({
      testId: "quick",
      workspaceId: workspace.workspaceId,
      globalId: "usr_member",
    });
    const privateTools = createWsp6Tools(
      toolContext("30", "agent:main:direct:30", true),
      root,
      assessments,
      lifecycle,
    );
    const next = details(
      await findTool(privateTools, "sg_test_attempt").execute("answer-1", {
        action: "answer",
        attemptId: started.attempt.attemptId,
        questionId: "q1",
        answer: "Да",
      }),
    );
    expect(next).toMatchObject({
      status: "native_action_required",
      nextAction: { target: "30", pollOption: ["Один", "Два"] },
    });

    const freshLifecycle = new Wsp6NativeLifecycle();
    const finalTools = createWsp6Tools(
      toolContext("30", "agent:main:direct:30-final", true),
      root,
      assessments,
      freshLifecycle,
    );
    const completed = details(
      await findTool(finalTools, "sg_test_attempt").execute("answer-2", {
        action: "answer",
        attemptId: started.attempt.attemptId,
        questionId: "q2",
        answer: "one",
      }),
    );
    expect(completed).toEqual({
      status: "completed",
      result: { kind: "knowledge", score: 3, maxScore: 3, percent: 100 },
      deterministic: true,
      aiInterpretationAuthoritative: false,
    });
  });

  it("queues completed group results to the participant DM without returning scores", async () => {
    const { root, workspace, assessments, lifecycle } = await fixture();
    await createActiveTest(assessments, workspace.workspaceId);
    const started = await assessments.start({
      testId: "quick",
      workspaceId: workspace.workspaceId,
      globalId: "usr_member",
    });
    await assessments.answer({
      attemptId: started.attempt.attemptId,
      globalId: "usr_member",
      questionId: "q1",
      answer: "yes",
    });
    await assessments.answer({
      attemptId: started.attempt.attemptId,
      globalId: "usr_member",
      questionId: "q2",
      answer: "one",
    });
    const groupTools = createWsp6Tools(
      toolContext("30", "agent:main:group:result"),
      root,
      assessments,
      lifecycle,
    );
    const result = details(
      await findTool(groupTools, "sg_test_attempt").execute("result", {
        action: "result",
        attemptId: started.attempt.attemptId,
      }),
    );
    expect(result).toMatchObject({
      status: "private_delivery_required",
      nextTool: "message",
      nextAction: {
        action: "send",
        channel: "telegram",
        target: "30",
        message: expect.stringContaining("Баллы: 3 из 3"),
      },
    });
    expect(result).not.toHaveProperty("result");
  });

  it("requires current workspace access for every continuation and manager access for stats", async () => {
    const { root, workspace, memberships, assessments, lifecycle } = await fixture();
    await createActiveTest(assessments, workspace.workspaceId);
    const started = await assessments.start({
      testId: "quick",
      workspaceId: workspace.workspaceId,
      globalId: "usr_member",
    });
    await memberships.revoke({
      actorGlobalId: "usr_owner",
      workspaceId: workspace.workspaceId,
      targetGlobalId: "usr_member",
    });
    const formerMember = createWsp6Tools(
      toolContext("30", "former-member", true),
      root,
      assessments,
      lifecycle,
    );
    expect(
      details(
        await findTool(formerMember, "sg_test_attempt").execute("resume", {
          action: "resume",
          attemptId: started.attempt.attemptId,
        }),
      ),
    ).toEqual({ status: "denied", reason: "sg-test-workspace-membership-required" });

    const outsider = createWsp6Tools(toolContext("40", "outsider"), root, assessments, lifecycle);
    expect(
      details(await findTool(outsider, "sg_test_stats").execute("stats", { testId: "quick" })),
    ).toEqual({ status: "denied", reason: "sg-test-workspace-membership-required" });
  });

  it("keeps ordinary polls on the native message tool", () => {
    expect(WSP6_AGENT_GUIDANCE).toContain("обычные опросы отправляй штатным message");
    expect(WSP6_AGENT_GUIDANCE).toContain("не вычисляй баллы самостоятельно");
    expect(createWsp6Tools).not.toHaveProperty("pollTransport");
  });
});
