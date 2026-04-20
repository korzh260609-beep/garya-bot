// src/core/projectIntent/semantic/projectIntentSemanticText.js

export function safeText(value) {
  return String(value ?? "").trim();
}

export function normalizeText(value) {
  return safeText(value)
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export function tokenizeText(value) {
  const normalized = normalizeText(value)
    .replace(/[.,!?;:()[\]{}<>\\|"'`~@#$%^&*+=]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) return [];
  return normalized.split(" ").filter(Boolean);
}

export function unique(values) {
  return [...new Set((Array.isArray(values) ? values : []).filter(Boolean))];
}

export function collectPrefixHits(tokens, prefixes) {
  const hits = [];

  for (const token of tokens) {
    for (const prefix of prefixes) {
      if (token.startsWith(prefix)) {
        hits.push(token);
        break;
      }
    }
  }

  return unique(hits);
}

export function safeJsonParse(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export function pickFirstNonEmpty(values = []) {
  for (const value of values) {
    const v = safeText(value);
    if (v) return v;
  }
  return "";
}

export function levenshtein(a, b) {
  const s = safeText(a).toLowerCase();
  const t = safeText(b).toLowerCase();

  if (!s) return t.length;
  if (!t) return s.length;

  const dp = Array.from({ length: s.length + 1 }, () => new Array(t.length + 1).fill(0));

  for (let i = 0; i <= s.length; i += 1) dp[i][0] = i;
  for (let j = 0; j <= t.length; j += 1) dp[0][j] = j;

  for (let i = 1; i <= s.length; i += 1) {
    for (let j = 1; j <= t.length; j += 1) {
      const cost = s[i - 1] === t[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }

  return dp[s.length][t.length];
}