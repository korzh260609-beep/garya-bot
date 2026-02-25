// src/core/time/currentDateIntent.js
// STAGE 8A.1 — Deterministic CURRENT_DATE intent (no AI)

function normalize(s) {
  return String(s || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\u00a0/g, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hasAny(t, list) {
  return list.some((x) => t.includes(x));
}

function matchesAny(t, regexList) {
  return regexList.some((re) => re.test(t));
}

export function isCurrentDateIntent(inputText) {
  const raw = String(inputText || "");
  const hadQuestionMark = raw.includes("?");

  const t = normalize(raw);
  if (!t) return false;

  // ---- BLACKLIST (avoid “date of birth”, “release date”, etc.) ----
  const blacklistPhrases = [
    "дата рождения",
    "день рождения",
    "date of birth",
    "birthday",
    "release date",
    "дату выхода",
    "дата выхода",
    "год выпуска",
    "production date",
    "invoice date",
    "issue date",
    "expiry date",
    "expiration date",
    "термин",
    "дедлайн",
  ];
  if (hasAny(t, blacklistPhrases)) return false;

  const blacklistRe = [
    /\b(birth|born)\b/i,
    /\brelease\b/i,
    /\bdeadline\b/i,
    /\bexpiry|expiration\b/i,
  ];
  if (matchesAny(t, blacklistRe)) return false;

  // ---- STRONG PATTERNS (instant true) ----
  const strongPatterns = [
    // RU
    /\bкакое\s+сегодня\s+число\b/u,
    /\bкакая\s+сегодня\s+дата\b/u,
    /\bкакое\s+число\s+сегодня\b/u,
    /\bдата\s+сегодня\b/u,

    // UA
    /\bяке\s+сьогодні\s+число\b/u,
    /\bяка\s+сьогодні\s+дата\b/u,
    /\bяке\s+число\s+сьогодні\b/u,
    /\bдата\s+сьогодні\b/u,
    /\bкотра\s+сьогодні\s+дата\b/u,

    // EN
    /\bwhat\s+date\s+is\s+it\b/i,
    /\bwhat\s+is\s+today'?s\s+date\b/i,
    /\bcurrent\s+date\b/i,
    /\btoday'?s\s+date\b/i,
  ];
  if (matchesAny(t, strongPatterns)) return true;

  // ---- SCORE MODEL ----
  let score = 0;

  const dateTerms = ["дата", "число", "date"];
  const todayTerms = ["сегодня", "сьогодні", "today", "current", "now"];
  const questionTerms = ["какое", "какая", "яке", "яка", "котра", "what", "whats", "what's"];
  const hasDate = hasAny(t, dateTerms);
  const hasToday = hasAny(t, todayTerms);
  const hasQuestion = hasAny(t, questionTerms) || hadQuestionMark;

  if (hasDate) score += 3;
  if (hasToday) score += 2;
  if (hasQuestion) score += 1;

  // short question bias
  const wc = t.split(" ").filter(Boolean).length;
  if (wc > 0 && wc <= 6) score += 1;

  return score >= 6; // stricter than TIME_NOW to reduce false positives
}
