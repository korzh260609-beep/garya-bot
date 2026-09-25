import { describe, expect, it } from "vitest";
import { buildSemanticReviewPrompt, parseSemanticVerdict } from "./semantic-controller.js";

describe("SG semantic controller", () => {
  it("accepts a strict pass verdict", () => {
    expect(
      parseSemanticVerdict('{"verdict":"pass","violations":[],"reason":"Соответствует"}'),
    ).toEqual({ verdict: "pass", violations: [], reason: "Соответствует" });
  });

  it("accepts a revise verdict with numbered rule violations", () => {
    expect(
      parseSemanticVerdict(
        '{"verdict":"revise","violations":[{"rule":4,"reason":"Предположение выдано за факт"}],"reason":"Исправить утверждение"}',
      ),
    ).toEqual({
      verdict: "revise",
      violations: [{ rule: 4, reason: "Предположение выдано за факт" }],
      reason: "Исправить утверждение",
    });
  });

  it("rejects malformed or out-of-range verdicts", () => {
    expect(parseSemanticVerdict("not json")).toBeUndefined();
    expect(
      parseSemanticVerdict(
        '{"verdict":"revise","violations":[{"rule":18,"reason":"bad"}],"reason":"bad"}',
      ),
    ).toBeUndefined();
  });

  it("builds a bounded review request from the original goal, draft, rules, and tool ledger", () => {
    const prompt = buildSemanticReviewPrompt({
      originalPrompt: "Сделай задачу",
      draft: "Задача выполнена",
      mandatoryRules: "1. Правило один\n2. Правило два",
      toolOutcomes: [{ toolName: "write", outcome: "success" }],
    });

    expect(prompt).toContain("Сделай задачу");
    expect(prompt).toContain("Задача выполнена");
    expect(prompt).toContain("1. Правило один");
    expect(prompt).toContain('"toolName":"write"');
    expect(prompt).toContain('"verdict":"pass|revise"');
  });
});
