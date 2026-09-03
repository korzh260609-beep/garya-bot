import type {
  PluginStateEntry,
  PluginStateKeyedStore,
} from "openclaw/plugin-sdk/plugin-state-runtime";
import { describe, expect, it } from "vitest";
import {
  SgAssessmentRegistry,
  type SgAssessmentAttempt,
  type SgAssessmentDefinition,
} from "./wsp6-assessments.js";

class MemoryStore<T> implements PluginStateKeyedStore<T> {
  readonly values = new Map<string, PluginStateEntry<T>>();

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

function registryFixture() {
  const definitions = new MemoryStore<SgAssessmentDefinition>();
  const attempts = new MemoryStore<SgAssessmentAttempt>();
  return {
    definitions,
    attempts,
    registry: new SgAssessmentRegistry({ definitions, attempts }),
  };
}

async function activeKnowledgeTest(registry: SgAssessmentRegistry, testId = "capitals") {
  await registry.create({
    testId,
    workspaceId: "wsp_one",
    title: "Столицы",
    kind: "knowledge",
    actorGlobalId: "usr_owner",
    questions: [
      {
        questionId: "q1",
        prompt: "Столица Франции?",
        options: [
          { optionId: "paris", label: "Париж", points: 2 },
          { optionId: "rome", label: "Рим", points: 0 },
        ],
      },
      {
        questionId: "q2",
        prompt: "Столица Италии?",
        options: [
          { optionId: "rome", label: "Рим", points: 3 },
          { optionId: "madrid", label: "Мадрид", points: 0 },
        ],
      },
    ],
  });
  await registry.setStatus(testId, "active");
}

describe("WSP6 assessment registry", () => {
  it("keeps independent durable attempts per Global ID and computes exact scores", async () => {
    const { definitions, attempts, registry } = registryFixture();
    await activeKnowledgeTest(registry);

    const first = await registry.start({
      testId: "capitals",
      workspaceId: "wsp_one",
      globalId: "usr_one",
    });
    const second = await registry.start({
      testId: "capitals",
      workspaceId: "wsp_one",
      globalId: "usr_two",
    });
    expect(first.attempt.attemptId).not.toBe(second.attempt.attemptId);

    const next = await registry.answer({
      attemptId: first.attempt.attemptId,
      globalId: "usr_one",
      questionId: "q1",
      answer: "Париж",
    });
    expect(next).toMatchObject({ status: "next", question: { questionId: "q2" } });
    const completed = await registry.answer({
      attemptId: first.attempt.attemptId,
      globalId: "usr_one",
      questionId: "q2",
      answer: "rome",
    });
    expect(completed).toMatchObject({
      status: "completed",
      result: { kind: "knowledge", score: 5, maxScore: 5, percent: 100 },
    });

    const restarted = new SgAssessmentRegistry({ definitions, attempts });
    await expect(restarted.resume(second.attempt.attemptId, "usr_two")).resolves.toMatchObject({
      status: "active",
      question: { questionId: "q1" },
    });
  });

  it("makes answer replay idempotent and rejects conflicts, ordering errors and cross-user access", async () => {
    const { registry } = registryFixture();
    await activeKnowledgeTest(registry);
    const started = await registry.start({
      testId: "capitals",
      workspaceId: "wsp_one",
      globalId: "usr_one",
    });
    const input = {
      attemptId: started.attempt.attemptId,
      globalId: "usr_one",
      questionId: "q1",
      answer: "paris",
    };
    await expect(registry.answer(input)).resolves.toMatchObject({ status: "next" });
    await expect(registry.answer(input)).resolves.toMatchObject({
      status: "next",
      attempt: { answers: [{ questionId: "q1", optionId: "paris" }] },
    });
    await expect(registry.answer({ ...input, answer: "rome" })).rejects.toThrow(
      "sg-test-answer-conflict",
    );
    await expect(
      registry.answer({ ...input, questionId: "q2", answer: "rome", globalId: "usr_two" }),
    ).rejects.toThrow("sg-test-attempt-owner-required");

    const other = await registry.start({
      testId: "capitals",
      workspaceId: "wsp_one",
      globalId: "usr_two",
    });
    await expect(
      registry.answer({
        attemptId: other.attempt.attemptId,
        globalId: "usr_two",
        questionId: "q2",
        answer: "rome",
      }),
    ).rejects.toThrow("sg-test-answer-out-of-order");
  });

  it("computes profile dimensions from stored option scores", async () => {
    const { registry } = registryFixture();
    await registry.create({
      testId: "style",
      workspaceId: "wsp_one",
      title: "Стиль работы",
      kind: "profile",
      actorGlobalId: "usr_owner",
      dimensions: [
        { key: "planning", label: "Планирование" },
        { key: "action", label: "Действие" },
      ],
      questions: [
        {
          questionId: "q1",
          prompt: "Как начинаете задачу?",
          options: [
            { optionId: "plan", label: "С плана", scores: { planning: 4, action: 1 } },
            { optionId: "go", label: "С действия", scores: { planning: 0, action: 3 } },
          ],
        },
      ],
    });
    await registry.setStatus("style", "active");
    const started = await registry.start({
      testId: "style",
      workspaceId: "wsp_one",
      globalId: "usr_one",
    });
    await expect(
      registry.answer({
        attemptId: started.attempt.attemptId,
        globalId: "usr_one",
        questionId: "q1",
        answer: "plan",
      }),
    ).resolves.toMatchObject({
      status: "completed",
      result: {
        kind: "profile",
        dimensions: [
          { key: "planning", score: 4, maxScore: 4, percent: 100 },
          { key: "action", score: 1, maxScore: 3, percent: 33.33 },
        ],
      },
    });
  });

  it("hides aggregate values until three completed attempts", async () => {
    const { registry } = registryFixture();
    await activeKnowledgeTest(registry, "one_question");
    for (const [index, answer] of ["paris", "rome", "paris"].entries()) {
      const globalId = `usr_${index}`;
      const started = await registry.start({
        testId: "one_question",
        workspaceId: "wsp_one",
        globalId,
      });
      await registry.answer({
        attemptId: started.attempt.attemptId,
        globalId,
        questionId: "q1",
        answer,
      });
      await registry.answer({
        attemptId: started.attempt.attemptId,
        globalId,
        questionId: "q2",
        answer: "rome",
      });
      const stats = await registry.stats("one_question");
      expect(stats.aggregateAvailable).toBe(index >= 2);
      if (index < 2) {
        expect(stats).not.toHaveProperty("knowledgeAveragePercent");
      }
    }
    await expect(registry.stats("one_question")).resolves.toMatchObject({
      completedAttempts: 3,
      distinctParticipants: 3,
      aggregateAvailable: true,
      knowledgeAveragePercent: 86.67,
    });
  });

  it("does not unlock aggregates with repeated attempts from one participant", async () => {
    const { registry } = registryFixture();
    await activeKnowledgeTest(registry);
    for (let index = 0; index < 3; index += 1) {
      const started = await registry.start({
        testId: "capitals",
        workspaceId: "wsp_one",
        globalId: "usr_one",
      });
      await registry.answer({
        attemptId: started.attempt.attemptId,
        globalId: "usr_one",
        questionId: "q1",
        answer: "paris",
      });
      await registry.answer({
        attemptId: started.attempt.attemptId,
        globalId: "usr_one",
        questionId: "q2",
        answer: "rome",
      });
    }
    await expect(registry.stats("capitals")).resolves.toEqual({
      testId: "capitals",
      completedAttempts: 3,
      distinctParticipants: 1,
      aggregateAvailable: false,
    });
  });

  it("rejects invalid definitions and treats activated definitions as immutable", async () => {
    const { registry } = registryFixture();
    await expect(
      registry.create({
        testId: "broken",
        workspaceId: "wsp_one",
        title: "Broken",
        kind: "knowledge",
        actorGlobalId: "usr_owner",
        questions: [
          {
            questionId: "q1",
            prompt: "Question",
            options: [
              { optionId: "a", label: "Same", points: 1 },
              { optionId: "b", label: "same", points: 0 },
            ],
          },
        ],
      }),
    ).rejects.toThrow("sg-test-question-options-duplicate");
    await activeKnowledgeTest(registry);
    await expect(activeKnowledgeTest(registry)).rejects.toThrow("sg-test-id-exists");
    await registry.setStatus("capitals", "closed");
    await expect(registry.setStatus("capitals", "active")).rejects.toThrow("sg-test-closed");
  });

  it("reports corrupt state without exposing entry contents", async () => {
    const { definitions, registry } = registryFixture();
    await definitions.register("test:bad", { version: 9 } as unknown as SgAssessmentDefinition);
    await expect(registry.diagnosticSnapshot()).resolves.toMatchObject({
      definitions: 1,
      corruptEntries: 1,
    });
  });
});
