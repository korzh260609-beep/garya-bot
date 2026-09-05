import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type {
  PluginStateEntry,
  PluginStateKeyedStore,
} from "openclaw/plugin-sdk/plugin-state-runtime";
import { describe, expect, it } from "vitest";
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
    title: "WSP6 Test",
    ownerGlobalId: "usr_monarch",
    status: "active",
    settings: {},
  });
  const assessments = new SgAssessmentRegistry({
    definitions: new MemoryStore<SgAssessmentDefinition>(),
    attempts: new MemoryStore<SgAssessmentAttempt>(),
  });
  const lifecycle = new Wsp6NativeLifecycle();
  return { root, workspace, assessments, lifecycle };
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
    actorGlobalId: "usr_monarch",
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
  it("normalizes duplicate model-generated profile keys by result position", async () => {
    const { root, workspace, assessments, lifecycle } = await fixture();
    const admin = createWsp6Tools(
      toolContext("10", "agent:main:group:profile-normalization"),
      root,
      assessments,
      lifecycle,
    );

    const result = details(
      await findTool(admin, "sg_test_manage").execute("profile-normalization", {
        action: "create_and_publish",
        workspaceId: workspace.workspaceId,
        title: "Какой ты гусь?",
        kind: "profile",
        results: [
          { key: "result", title: "Гусь-исследователь", description: "Любит новое." },
          { key: "result", title: "Гусь-организатор", description: "Наводит порядок." },
          { key: "result", title: "Гусь-философ", description: "Думает глубоко." },
        ],
        questions: [
          { text: "Куда пойдёшь?", options: ["В лес", "На совет", "К пруду"] },
          { text: "Что выберешь?", options: ["Карту", "План", "Тишину"] },
          { text: "Как гоготать?", options: ["С любопытством", "Командно", "Задумчиво"] },
        ],
      }),
    );

    expect(result).toMatchObject({
      status: "native_action_required",
      test: { kind: "profile", status: "active", questionCount: 3, resultCount: 3 },
    });
    const [definition] = await assessments.listDefinitions(workspace.workspaceId);
    expect(definition?.results.map((profile) => profile.key)).toEqual(["A", "B", "C"]);
    expect(
      definition?.questions.map((question) => question.options.map((option) => option.scoreKey)),
    ).toEqual([
      ["A", "B", "C"],
      ["A", "B", "C"],
      ["A", "B", "C"],
    ]);
    if (!definition) {
      throw new Error("normalized profile definition missing");
    }
    const started = await assessments.start({
      testId: definition.testId,
      workspaceId: workspace.workspaceId,
      globalId: "usr_citizen_b",
    });
    await assessments.answer({
      attemptId: started.attempt.attemptId,
      globalId: "usr_citizen_b",
      questionId: "q_1",
      answer: "o_1",
    });
    await assessments.answer({
      attemptId: started.attempt.attemptId,
      globalId: "usr_citizen_b",
      questionId: "q_2",
      answer: "o_2",
    });
    await expect(
      assessments.answer({
        attemptId: started.attempt.attemptId,
        globalId: "usr_citizen_b",
        questionId: "q_3",
        answer: "o_2",
      }),
    ).resolves.toMatchObject({
      status: "completed",
      result: {
        kind: "profile",
        mode: "categories",
        keys: ["B"],
        profiles: [{ title: "Гусь-организатор", description: "Наводит порядок." }],
        counts: { A: 1, B: 2 },
      },
    });

    const automaticDraft = details(
      await findTool(admin, "sg_test_manage").execute("profile-automatic-keys", {
        action: "create",
        workspaceId: workspace.workspaceId,
        title: "Автоматические ключи",
        kind: "profile",
        results: [{ title: "Первый" }, { title: "Второй" }, { title: "Третий" }],
        questions: [{ text: "Выберите", options: ["Раз", "Два", "Три"] }],
      }),
    );
    expect(automaticDraft).toMatchObject({ status: "created", test: { resultCount: 3 } });
    const definitions = await assessments.listDefinitions(workspace.workspaceId);
    expect(
      definitions.find((item) => item.title === "Автоматические ключи")?.results,
    ).toMatchObject([{ key: "A" }, { key: "B" }, { key: "C" }]);
  });

  it("creates and publishes an SG 2.1-style categorical profile test", async () => {
    const { root, workspace, assessments, lifecycle } = await fixture();
    const admin = createWsp6Tools(
      toolContext("10", "agent:main:group:profile"),
      root,
      assessments,
      lifecycle,
    );

    const result = details(
      await findTool(admin, "sg_test_manage").execute("profile", {
        action: "create_and_publish",
        workspaceId: workspace.workspaceId,
        title: "Какой ты гусь?",
        kind: "profile",
        results: [
          { key: "A", title: "Гусь-исследователь", description: "Любит новое." },
          { key: "B", title: "Гусь-организатор", description: "Наводит порядок." },
        ],
        questions: [
          {
            text: "Что выберешь?",
            options: ["Исследовать", "Организовать"],
          },
        ],
      }),
    );

    expect(result).toMatchObject({
      status: "native_action_required",
      test: { kind: "profile", status: "active", resultCount: 2 },
      nextTool: "message",
      nextAction: {
        message: expect.stringContaining("Какой ты гусь?"),
        presentation: {
          blocks: [
            {
              type: "buttons",
              buttons: [{ label: "▶️ Начать тест", action: { type: "callback" } }],
            },
          ],
        },
      },
    });

    const [definition] = await assessments.listDefinitions(workspace.workspaceId);
    if (!definition) {
      throw new Error("profile definition missing");
    }
    expect(definition.questions[0]).toMatchObject({
      questionId: "q_1",
      prompt: "Что выберешь?",
      options: [
        { optionId: "o_1", label: "Исследовать", scoreKey: "A" },
        { optionId: "o_2", label: "Организовать", scoreKey: "B" },
      ],
    });
    const started = await assessments.start({
      testId: definition.testId,
      workspaceId: workspace.workspaceId,
      globalId: "usr_citizen_b",
    });
    await expect(
      assessments.answer({
        attemptId: started.attempt.attemptId,
        globalId: "usr_citizen_b",
        questionId: "q_1",
        answer: "o_1",
      }),
    ).resolves.toMatchObject({
      status: "completed",
      result: {
        kind: "profile",
        mode: "categories",
        keys: ["A"],
        profiles: [{ title: "Гусь-исследователь", description: "Любит новое." }],
        counts: { A: 1 },
      },
    });
  });

  it("allows the monarch to define tests and denies management to citizens", async () => {
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
    const citizen = createWsp6Tools(toolContext("30", "citizen"), root, assessments, lifecycle);
    expect(
      details(await findTool(citizen, "sg_test_manage").execute("citizen", definition)),
    ).toEqual({ status: "denied", reason: "sg-test-manager-required" });

    const monarch = createWsp6Tools(toolContext("10", "monarch"), root, assessments, lifecycle);
    expect(
      details(await findTool(monarch, "sg_test_manage").execute("monarch", definition)),
    ).toMatchObject({ status: "created", test: { testId: "managed", status: "draft" } });
    expect(
      details(
        await findTool(monarch, "sg_test_manage").execute("activate", {
          action: "activate",
          testId: "managed",
        }),
      ),
    ).toMatchObject({
      status: "native_action_required",
      test: { testId: "managed", status: "active" },
      nextTool: "message",
      nextAction: {
        action: "send",
        channel: "telegram",
        target: "telegram:-100500",
        message: expect.stringContaining("Интерактивный тест: Управляемый тест"),
        presentation: {
          blocks: [
            {
              type: "buttons",
              buttons: [
                {
                  label: "▶️ Начать тест",
                  action: { type: "callback", value: expect.stringMatching(/^sg6:s:/u) },
                },
              ],
            },
          ],
        },
      },
    });
  });

  it("starts a separate attempt and returns native private answer buttons", async () => {
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
        action: "send",
        channel: "telegram",
        target: "30",
        message: expect.stringContaining("Вопрос 1/2"),
        presentation: {
          blocks: [
            {
              type: "buttons",
              buttons: [
                {
                  label: "A. Да",
                  action: { type: "callback", value: expect.stringMatching(/^sg6:a:att_/u) },
                },
                {
                  label: "B. Нет",
                  action: { type: "callback", value: expect.stringMatching(/^sg6:a:att_/u) },
                },
              ],
            },
          ],
        },
      },
    });
    expect(lifecycle.snapshot()).toMatchObject({ pending: 1, queued: 1 });
  });

  it("advances from an answer and returns deterministic results only in private chat", async () => {
    const { root, workspace, assessments, lifecycle } = await fixture();
    await createActiveTest(assessments, workspace.workspaceId);
    const started = await assessments.start({
      testId: "quick",
      workspaceId: workspace.workspaceId,
      globalId: "usr_citizen_b",
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
      nextAction: {
        target: "30",
        message: expect.stringContaining("Вопрос 2/2"),
        presentation: {
          blocks: [
            {
              type: "buttons",
              buttons: [
                { label: "A. Один", action: { type: "callback" } },
                { label: "B. Два", action: { type: "callback" } },
              ],
            },
          ],
        },
      },
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
      globalId: "usr_citizen_b",
    });
    await assessments.answer({
      attemptId: started.attempt.attemptId,
      globalId: "usr_citizen_b",
      questionId: "q1",
      answer: "yes",
    });
    await assessments.answer({
      attemptId: started.attempt.attemptId,
      globalId: "usr_citizen_b",
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

  it("keeps attempts available to citizens while statistics remain manager-only", async () => {
    const { root, workspace, assessments, lifecycle } = await fixture();
    await createActiveTest(assessments, workspace.workspaceId);
    const started = await assessments.start({
      testId: "quick",
      workspaceId: workspace.workspaceId,
      globalId: "usr_citizen_b",
    });
    const citizen = createWsp6Tools(
      toolContext("30", "citizen-resume", true),
      root,
      assessments,
      lifecycle,
    );
    expect(
      details(
        await findTool(citizen, "sg_test_attempt").execute("resume", {
          action: "resume",
          attemptId: started.attempt.attemptId,
        }),
      ),
    ).toMatchObject({ status: "native_action_required" });

    const otherCitizen = createWsp6Tools(
      toolContext("40", "citizen-stats"),
      root,
      assessments,
      lifecycle,
    );
    expect(
      details(await findTool(otherCitizen, "sg_test_stats").execute("stats", { testId: "quick" })),
    ).toEqual({ status: "denied", reason: "sg-test-manager-required" });
  });

  it("keeps ordinary polls on the native message tool", () => {
    expect(WSP6_AGENT_GUIDANCE).toContain("обычные опросы отправляй штатным message");
    expect(WSP6_AGENT_GUIDANCE).toContain("не вычисляй баллы самостоятельно");
    expect(createWsp6Tools).not.toHaveProperty("pollTransport");
  });
});
