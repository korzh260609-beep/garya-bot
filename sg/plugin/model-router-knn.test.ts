import { describe, expect, it } from "vitest";
import {
  chooseRouterCandidate,
  evaluateRouterCandidate,
  validRouterCorpus,
  type RouterExample,
} from "./model-router-knn.js";

const sample = (index: number, cheapSuccess = true): RouterExample => ({
  taskId: `task-${index}`,
  familyId: `family-${index}`,
  language: ["ru", "en", "ja"][index % 3]!,
  vector: [1, 0.001 * index],
  trials: [
    {
      tier: "cheap",
      succeeded: cheapSuccess,
      quality: cheapSuccess ? 1 : 0,
      totalCost: cheapSuccess ? 1 : 8,
    },
    { tier: "medium", succeeded: true, quality: 1, totalCost: 3 },
    { tier: "expensive", succeeded: true, quality: 1, totalCost: 7 },
  ],
});

describe("paired semantic router", () => {
  it("requires complete validated outcomes and one embedding identity", () => {
    const examples = Array.from({ length: 60 }, (_, index) => sample(index));
    expect(
      validRouterCorpus({
        version: 1,
        embedding: { provider: "openai", model: "text-embedding-3-small" },
        examples,
      }),
    ).toBe(true);
    expect(
      validRouterCorpus({
        version: 1,
        embedding: { provider: "openai", model: "text-embedding-3-small" },
        examples: [...examples, examples[0]],
      }),
    ).toBe(false);
    expect(
      validRouterCorpus({
        version: 1,
        embedding: { provider: "openai", model: "text-embedding-3-small" },
        examples: [{ ...examples[0], trials: examples[0]!.trials.slice(1) }],
      }),
    ).toBe(false);
  });

  it("uses cost per completed task and paired quality, with independent families", () => {
    const examples = Array.from({ length: 60 }, (_, index) => sample(index));
    expect(chooseRouterCandidate({ vector: [1, 0], examples })).toMatchObject({
      tier: "cheap",
      neighbors: 50,
    });
    examples[0] = sample(0, false);
    expect(chooseRouterCandidate({ vector: [1, 0], examples })?.tier).toBe("medium");
    expect(chooseRouterCandidate({ vector: [0, 1], examples })).toBeUndefined();
    expect(
      chooseRouterCandidate({
        vector: [1, 0],
        examples: examples.map((item) => Object.assign({}, item, { familyId: "one" })),
      }),
    ).toBeUndefined();
  });

  it("does not treat 19/20 observed completions as 95% reliable", () => {
    const examples = Array.from({ length: 20 }, (_, index) => sample(index, index !== 0));
    expect(chooseRouterCandidate({ vector: [1, 0], examples, neighborCount: 20 })).toBeUndefined();
  });

  it("holds out whole task families and reports coverage and realized costs", () => {
    const examples = Array.from({ length: 101 }, (_, index) => sample(index));
    const result = evaluateRouterCandidate(examples);
    expect(result).toMatchObject({
      total: 101,
      routed: 101,
      succeeded: 101,
      baselineSucceeded: 101,
      candidateCost: 101,
      terraCost: 303,
      costPerSuccess: 1,
      terraCostPerSuccess: 3,
    });
    expect(evaluateRouterCandidate(examples.slice(0, 50)).routed).toBe(0);
  });
});
