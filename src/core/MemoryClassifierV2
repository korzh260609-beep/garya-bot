// src/core/MemoryClassifierV2.js
// MEMORY CLASSIFIER V2 — SKELETON
//
// IMPORTANT:
// - this file is NOT wired into runtime yet
// - current explicitRememberKey.js remains active MVP fallback
// - this module prepares hybrid architecture:
//   rules/config first -> legacy fallback -> future semantic layer
//
// Current stage:
// - deterministic only
// - no DB writes
// - no AI
// - safe shadow-mode capable

import { getMemoryClassifierV2Config } from "./memoryClassifierV2Config.js";
import { getMemoryRulesCatalog } from "./memoryRulesCatalog.js";
import { canonicalizeMemoryValue, normalizeMemoryCandidateText } from "./memoryCanonicalizer.js";
import { buildMemoryDecisionLog } from "./MemoryDecisionLog.js";
import { classifyExplicitRemember } from "./explicitRememberKey.js";
import { deriveRememberTypeFromKey } from "./rememberType.js";

function safeStr(value) {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return "";
  return String(value);
}

function normalizeSearchText(value) {
  return normalizeMemoryCandidateText(value).toLowerCase();
}

function matchesRuleByExamples(text, rule) {
  const normalized = normalizeSearchText(text);
  const examples = Array.isArray(rule?.examples) ? rule.examples : [];

  for (const example of examples) {
    const ex = normalizeSearchText(example);
    if (!ex) continue;

    // MVP skeleton:
    // conservative contains-match only
    // future: semantic similarity / embeddings / AI adjudicator
    if (normalized.includes(ex) || ex.includes(normalized)) {
      return true;
    }
  }

  return false;
}

function findMatchingRule(text, rules = []) {
  for (const rule of rules) {
    if (matchesRuleByExamples(text, rule)) {
      return rule;
    }
  }
  return null;
}

export class MemoryClassifierV2 {
  constructor({ config = null, rules = null } = {}) {
    this.config = config || getMemoryClassifierV2Config();
    this.rules = Array.isArray(rules) ? rules : getMemoryRulesCatalog();
  }

  classify({ text } = {}) {
    const rawInput = safeStr(text);
    const normalizedInput = normalizeMemoryCandidateText(rawInput);

    if (!normalizedInput) {
      const finalResult = {
        key: "user_explicit_memory",
        rememberType: "general_fact",
        value: "",
        source: "memory_classifier_v2.empty_input",
      };

      return {
        ok: false,
        reason: "empty_input",
        result: finalResult,
        decisionLog: buildMemoryDecisionLog({
          input: rawInput,
          normalizedInput,
          strategy: this.config.strategy,
          finalResult,
          notes: ["empty input"],
        }),
      };
    }

    const strategy = this.config.strategy || "rules_first";
    const notes = [];
    let matchedRule = null;
    let legacyResult = null;
    let finalResult = null;

    if (strategy === "rules_first") {
      matchedRule = findMatchingRule(normalizedInput, this.rules);

      if (matchedRule) {
        finalResult = {
          key: matchedRule.targetKey,
          rememberType:
            matchedRule.targetType || deriveRememberTypeFromKey(matchedRule.targetKey),
          value: canonicalizeMemoryValue({
            rawValue: rawInput,
            matchedRule,
          }),
          source: "memory_classifier_v2.rules_catalog",
        };

        notes.push(`matched rule: ${matchedRule.id}`);
      } else {
        legacyResult = classifyExplicitRemember(rawInput);
        finalResult = {
          key: safeStr(legacyResult?.key) || "user_explicit_memory",
          rememberType: deriveRememberTypeFromKey(legacyResult?.key),
          value: safeStr(legacyResult?.value),
          source: "memory_classifier_v2.legacy_fallback",
        };
        notes.push("no rule matched -> legacy fallback");
      }
    } else if (strategy === "legacy_only") {
      legacyResult = classifyExplicitRemember(rawInput);
      finalResult = {
        key: safeStr(legacyResult?.key) || "user_explicit_memory",
        rememberType: deriveRememberTypeFromKey(legacyResult?.key),
        value: safeStr(legacyResult?.value),
        source: "memory_classifier_v2.legacy_only",
      };
      notes.push("legacy_only strategy");
    } else {
      // Reserved path for future semantic layer.
      legacyResult = classifyExplicitRemember(rawInput);
      finalResult = {
        key: safeStr(legacyResult?.key) || "user_explicit_memory",
        rememberType: deriveRememberTypeFromKey(legacyResult?.key),
        value: safeStr(legacyResult?.value),
        source: "memory_classifier_v2.semantic_reserved_fallback",
      };
      notes.push("semantic_reserved not implemented -> legacy fallback");
    }

    return {
      ok: true,
      reason: "classified",
      result: finalResult,
      decisionLog: buildMemoryDecisionLog({
        input: rawInput,
        normalizedInput,
        strategy,
        matchedRule,
        legacyResult,
        finalResult,
        notes,
      }),
    };
  }
}

export default MemoryClassifierV2;