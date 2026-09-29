import { describe, expect, it } from "vitest";
import { chooseRouterCandidate, evaluateRouterCandidate, type RouterExample } from "./model-router-knn.js";

const sample = (taskId: string, language: string, vector: number[], cheapSuccess = true): RouterExample => ({
  taskId,
  familyId: taskId,
  language,
  vector,
  trials: [
    { tier: "cheap", succeeded: cheapSuccess, totalCost: cheapSuccess ? 1 : 8 },
    { tier: "medium", succeeded: true, totalCost: 3 },
    { tier: "expensive", succeeded: true, totalCost: 7 },
  ],
});

describe("offline model router candidate", () => {
  it("compares the full cost of successful tasks across language labels", () => {
    const examples = [sample("a", "en", [1, 0]), sample("b", "uk", [0.99, 0.01])];
    expect(chooseRouterCandidate({ vector: [1, 0], examples, neighborCount: 2 }))
      .toMatchObject({ tier: "cheap", estimatedCost: 1, estimatedSuccess: 1 });
    examples[1] = sample("b", "uk", [0.99, 0.01], false);
    expect(chooseRouterCandidate({ vector: [1, 0], examples, neighborCount: 2 }))
      .toMatchObject({ tier: "medium", estimatedCost: 3 });
  });

  it("abstains without sufficient comparable trials or matching embeddings", () => {
    const examples = [sample("a", "en", [1, 0]), sample("b", "ja", [0, 1])];
    expect(chooseRouterCandidate({ vector: [1, 0], examples, neighborCount: 2 })).toBeUndefined();
    expect(chooseRouterCandidate({ vector: [1, 0], examples: [examples[0]], neighborCount: 2 }))
      .toBeUndefined();
    expect(chooseRouterCandidate({ vector: [1, 0], examples: [
      { ...examples[0], trials: examples[0].trials.slice(1) },
      sample("c", "es", [1, 0]),
    ], neighborCount: 2 })).toBeUndefined();
    expect(chooseRouterCandidate({ vector: [1, 0], examples: [
      sample("a", "en", [1, 0]), sample("b", "es", [Number.NaN, 0]),
    ], neighborCount: 2 })).toBeUndefined();
  });

  it("excludes a held-out task and reports coverage with actual recorded cost", () => {
    const examples = [sample("a", "en", [1, 0]), sample("b", "uk", [1, 0]),
      sample("c", "es", [1, 0])];
    expect(evaluateRouterCandidate(examples, 2)).toEqual({
      total: 3, routed: 3, succeeded: 3, candidateCost: 3, terraCost: 9,
    });
    expect(evaluateRouterCandidate(examples.slice(0, 2), 2).routed).toBe(0);
    expect(evaluateRouterCandidate([
      { ...examples[0], familyId: "translated-task" },
      { ...examples[1], familyId: "translated-task" },
      examples[2],
    ], 2).routed).toBe(0);
  });
});
