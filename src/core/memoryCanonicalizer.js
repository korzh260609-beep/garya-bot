// src/core/memoryCanonicalizer.js
// MEMORY CLASSIFIER V2 — CANONICALIZER SKELETON
//
// Goal:
// - normalize text deterministically
// - apply catalog canonical values when present
// - keep value logic OUTSIDE legacy classifier when possible
// - no DB
// - no side effects

function safeStr(value) {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return "";
  return String(value);
}

function oneLine(value) {
  return safeStr(value).replace(/\s+/g, " ").trim();
}

function cleanExtractedValue(value) {
  return safeStr(value)
    .replace(/^[\s:=-]+/, "")
    .replace(/[\s.]+$/, "")
    .trim();
}

function extractNameValue(rawValue) {
  const text = safeStr(rawValue);

  const patterns = [
    /м[оё]е имя\s+(.+)/i,
    /меня зовут\s+(.+)/i,
    /my name is\s+(.+)/i,
    /my name\s+(.+)/i,
    /i am\s+(.+)/i,
    /i'm\s+(.+)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match || !match[1]) continue;

    const extracted = cleanExtractedValue(match[1]);
    if (extracted) return extracted;
  }

  return null;
}

function canonicalizeByRuleId({ rawValue, matchedRule } = {}) {
  const ruleId = String(matchedRule?.id || "").trim();

  if (!ruleId) {
    return null;
  }

  if (ruleId === "user_profile.name") {
    return extractNameValue(rawValue);
  }

  return null;
}

export function normalizeMemoryCandidateText(value) {
  return oneLine(value);
}

export function canonicalizeMemoryValue({
  rawValue,
  matchedRule = null,
} = {}) {
  const raw = normalizeMemoryCandidateText(rawValue);

  if (
    matchedRule &&
    typeof matchedRule.canonicalValue === "string" &&
    matchedRule.canonicalValue.trim()
  ) {
    return matchedRule.canonicalValue.trim();
  }

  const extractedByRule = canonicalizeByRuleId({
    rawValue,
    matchedRule,
  });

  if (typeof extractedByRule === "string" && extractedByRule.trim()) {
    return extractedByRule.trim();
  }

  return raw;
}

export default canonicalizeMemoryValue;
