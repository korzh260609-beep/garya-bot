import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { openSgAssessmentStores, SgAssessmentRegistry } from "./wsp6-assessments.js";

describe("WSP6 SQLite storage", () => {
  it("persists an in-progress attempt across registry and database reopen", async () => {
    const stateDir = await mkdtemp(path.join(os.tmpdir(), "sg-wsp6-sqlite-"));
    const scope = { kind: "resource" as const, resourceScopeId: "wsp_one" };
    const first = new SgAssessmentRegistry(openSgAssessmentStores(stateDir));
    await first.create({
      testId: "durable",
      scope,
      title: "Durable test",
      kind: "knowledge",
      actorGlobalId: "usr_owner",
      questions: [
        {
          questionId: "q1",
          prompt: "First?",
          options: [
            { optionId: "a", label: "A", points: 1 },
            { optionId: "b", label: "B", points: 0 },
          ],
        },
        {
          questionId: "q2",
          prompt: "Second?",
          options: [
            { optionId: "a", label: "A", points: 1 },
            { optionId: "b", label: "B", points: 0 },
          ],
        },
      ],
    });
    await first.setStatus("durable", "active", scope);
    const started = await first.start({
      testId: "durable",
      scope,
      globalId: "usr_one",
    });
    await first.answer({
      attemptId: started.attempt.attemptId,
      globalId: "usr_one",
      questionId: "q1",
      answer: "a",
    });

    const reopened = new SgAssessmentRegistry(openSgAssessmentStores(stateDir));
    await expect(reopened.resume(started.attempt.attemptId, "usr_one")).resolves.toMatchObject({
      status: "active",
      question: { questionId: "q2", questionNumber: 2 },
    });
    await expect(
      reopened.answer({
        attemptId: started.attempt.attemptId,
        globalId: "usr_one",
        questionId: "q2",
        answer: "a",
      }),
    ).resolves.toMatchObject({
      status: "completed",
      result: { kind: "knowledge", score: 2, maxScore: 2, percent: 100 },
    });
  });
});
