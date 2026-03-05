// src/core/time/timeNowIntent.js
// STAGE 8C — Deterministic TIME_NOW intent (score + blacklist, no AI)
//
// ✅ FIX (2026-03-02): universal BUT safe
// - NEVER trigger by "сейчас/now" alone
// - Require explicit time-term presence (время/час/time/...) unless strong pattern matches
// - Handle imperative-now phrases safely:
//    * "ответь сейчас коротко" => NOT time
//    * "скажи сейчас который час" => time (has time + question)

// NOTE: keep this module deterministic and cheap.

function normalize(s) {
  return String(s || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\u00a0/g, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function countWords(t) {
  if (!t) return 0;
  return t.split(" ").filter(Boolean).length;
}

function hasAny(t, list) {
  return list.some((x) => t.includes(x));
}

function matchesAny(t, regexList) {
  return regexList.some((re) => re.test(t));
}

export function isTimeNowIntent(inputText) {
  const raw = String(inputText || "");
  const hadQuestionMark = raw.includes("?");

  const t = normalize(raw);
  if (!t) return false;

  // --- BLACKLIST (block false positives) ---
  const blacklistPhrases = [
    "таймер",
    "секундомер",
    "будильник",
    "обратный отсчет",
    "обратний відлік",
    "відлік",
    "сколько времени осталось",
    "скільки часу залишилось",
    "скiльки часу залишилось",
    "время в пути",
    "времени в пути",
    "час у дорозі",
    "час в дорозі",
    "время приготовления",
    "час приготування",
    "таймкод",
    "timestamp",
    "время работы",
    "час роботи",
  ];
  if (hasAny(t, blacklistPhrases)) return false;

  const blacklistRe = [
    /\b(remind|reminder)\b/i,
    /\balarm\b/i,
    /\btimer\b/i,
    /\bcountdown\b/i,
  ];
  if (matchesAny(t, blacklistRe)) return false;

  // --- HIGH-CONFIDENCE (instant true) ---
  const strongPatterns = [
    // ✅ Unicode-aware boundaries (JS \b is NOT Cyrillic-safe)
    /(?<![\p{L}\p{N}_])котор(ый|ая)\s+час(?![\p{L}\p{N}_])/u,
    /(?<![\p{L}\p{N}_])сколько\s+(сейчас\s+)?времен[иь](?![\p{L}\p{N}_])/u,
    /(?<![\p{L}\p{N}_])скільки\s+(зараз\s+)?(годин|часу)(?![\p{L}\p{N}_])/u,
    /(?<![\p{L}\p{N}_])котра\s+(зараз\s+)?година(?![\p{L}\p{N}_])/u,

    /\bwhat\s+time\s+is\s+it\b/i,
    /\bwhat\s+is\s+the\s+time\b/i,
    /\bcurrent\s+time\b/i,
    /\btime\s+is\s+it\b/i,
  ];
  if (matchesAny(t, strongPatterns)) return true;

  // --- Imperative-now detector (safe handling) ---
  // We do NOT auto-classify as time.
  // It only blocks false positives unless explicit time indicators exist.
  const imperativeNowRe = [
    // RU
    /\b(ответь|ответьте|отвечай|отвечайте|напиши|напишите|сделай|сделайте|объясни|объясните|поясни|поясните|дай|дайте|скажи|скажите)\s+сейчас\b/u,
    // UA
    /\b(відповідай|відповідайте|напиши|напишіть|зроби|зробіть|поясни|поясніть|скажи|скажіть)\s+зараз\b/u,
    // EN
    /\b(please\s+)?(reply|answer|explain|do|tell)\s+now\b/i,
  ];
  const imperativeNow = matchesAny(t, imperativeNowRe);

  // --- CORE RULE: must contain a TIME TERM ---
  // IMPORTANT: word-boundary-safe regex to avoid substring bug: "сейчас" contains "час".
  // We use Unicode property escapes to define "word chars" as letters/digits/underscore.
  const timeTermsRe = [
    // RU
    /(?<![\p{L}\p{N}_])время(?![\p{L}\p{N}_])/u,
    /(?<![\p{L}\p{N}_])час(?![\p{L}\p{N}_])/u,
    /(?<![\p{L}\p{N}_])часов(?![\p{L}\p{N}_])/u,

    // UA
    /(?<![\p{L}\p{N}_])година(?![\p{L}\p{N}_])/u,
    /(?<![\p{L}\p{N}_])годин(?![\p{L}\p{N}_])/u,

    // EN
    /(?<![\p{L}\p{N}_])time(?![\p{L}\p{N}_])/iu,
    /(?<![\p{L}\p{N}_])clock(?![\p{L}\p{N}_])/iu,

    // DE/FR/ES minimal
    /(?<![\p{L}\p{N}_])uhr(?![\p{L}\p{N}_])/iu,
    /(?<![\p{L}\p{N}_])zeit(?![\p{L}\p{N}_])/iu,
    /(?<![\p{L}\p{N}_])heure(?![\p{L}\p{N}_])/iu,
    /(?<![\p{L}\p{N}_])hora(?![\p{L}\p{N}_])/iu,
  ];

  const hasTime = matchesAny(t, timeTermsRe);

  // ✅ Hard safety: if it’s an imperative-now phrase but NO time term => NOT a time intent.
  // This directly fixes: "Ответь сейчас коротко" / "Отвечай сейчас коротко"
  if (imperativeNow && !hasTime) return false;

  // Without time-term -> never time intent (except strongPatterns already returned true).
  if (!hasTime) return false;

  // --- SCORE MODEL ---
  let score = 0;

  const nowTerms = ["сейчас", "щас", "зараз", "now", "current", "currently", "rn"];

  const questionTerms = [
    // RU/UA stems
    "котор",
    "сколько",
    "скільки",
    "котра",
    // EN
    "what",
    "whats",
    "what's",
    // DE/FR/ES minimal
    "wie",
    "quel",
    "quelle",
    "que",
    "qué",
  ];

  const hasNow = hasAny(t, nowTerms);
  const hasQuestion = hasAny(t, questionTerms) || hadQuestionMark;

  // Base: time term exists
  score += 3;

  if (hasNow) score += 2;
  if (hasQuestion) score += 1;

  const wc = countWords(t);
  if (wc > 0 && wc <= 4) score += 1;

  const loosePatterns = [
    /\bвремя\s+сейчас\b/u,
    /\bсейчас\s+время\b/u,
    /\bчас\s+зараз\b/u,
    /\bсколько\s+часов\b/u,
    /\bwhat\s+time\b/i,
    /\btime\s+now\b/i,
    /\bhora\s+es\b/i,
    /\bquelle\s+heure\b/i,
    /\bwie\s+spät\b/i,
  ];
  if (matchesAny(t, loosePatterns)) score += 1;

  // ✅ Additional safety:
  // If imperative-now is present AND time term exists, require question-ness.
  // This avoids misfiring on: "скажи сейчас время" (could be command to respond now),
  // but still allows: "скажи сейчас который час?".
  if (imperativeNow && !hasQuestion) return false;

  return score >= 5;
}