// src/core/time/timeNowIntent.js
// STAGE 8C — Deterministic TIME_NOW intent (score + blacklist, no AI)
//
// ✅ FIX (2026-03-02): make intent universal BUT safe:
// - NEVER trigger by "сейчас/now" alone
// - Require explicit time-term presence (время/час/time/...) unless strong pattern matches
// - Add imperative-now anti-patterns: "ответь сейчас", "сделай сейчас" etc

function normalize(s) {
  // Normalize unicode + collapse any whitespace (incl. NBSP)
  return String(s || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\u00a0/g, " ") // NBSP -> space
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
  // If any matched -> NOT time-now.
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

  // Imperative-now anti-patterns (the exact bug from screenshot)
  // Examples: "Ответь сейчас коротко", "Сделай сейчас", "Объясни сейчас"
  const imperativeNowRe = [
    /\b(ответь|ответьте|напиши|напишите|сделай|сделайте|объясни|объясните|поясни|поясните|дай|дайте)\s+сейчас\b/u,
    /\b(скажите|скажи)\s+сейчас\b/u,
    /\b(please)\s+(reply|answer|explain|do)\s+now\b/i,
    /\b(answer|reply|explain|do)\s+now\b/i,
  ];
  if (matchesAny(t, imperativeNowRe)) return false;

  // Extra blacklist patterns
  const blacklistRe = [
    /\b(remind|reminder)\b/i,
    /\balarm\b/i,
    /\btimer\b/i,
    /\bcountdown\b/i,
  ];
  if (matchesAny(t, blacklistRe)) return false;

  // --- HIGH-CONFIDENCE (instant true) ---
  // Strong patterns that clearly mean "current time"
  const strongPatterns = [
    /\bкотор(ый|ая)\s+час\b/u,
    /\bсколько\s+(сейчас\s+)?времен[иь]\b/u,
    /\bскільки\s+(зараз\s+)?(годин|часу)\b/u,
    /\bкотра\s+(зараз\s+)?година\b/u,
    /\bwhat\s+time\s+is\s+it\b/i,
    /\bwhat\s+is\s+the\s+time\b/i,
    /\bcurrent\s+time\b/i,
    /\btime\s+is\s+it\b/i,
  ];
  if (matchesAny(t, strongPatterns)) return true;

  // --- CORE RULE: must contain a TIME TERM ---
  // Without a time-term, do NOT treat as time intent (prevents "сейчас" bug).
  const timeTerms = [
    // RU/UA
    "время",
    "час",
    "часов",
    "година",
    "годин",
    // EN
    "time",
    "clock",
    // DE/FR/ES (optional, cheap coverage)
    "uhr",
    "zeit",
    "heure",
    "hora",
  ];

  const hasTime = hasAny(t, timeTerms);
  if (!hasTime) return false;

  // --- SCORE MODEL ---
  // Goal: catch many variants, but only when time-term exists.
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
    "tell",
    "say",
    // DE/FR/ES minimal
    "wie",
    "quel",
    "quelle",
    "que",
    "qué",
  ];

  const hasNow = hasAny(t, nowTerms);
  const hasQuestion = hasAny(t, questionTerms) || hadQuestionMark;

  // Base
  score += 3; // hasTime is true here (mandatory)

  if (hasNow) score += 2;
  if (hasQuestion) score += 1;

  // Very short requests often mean time-now: "время?", "time?", "час?"
  const wc = countWords(t);
  if (wc > 0 && wc <= 4) score += 1;

  // Loose constructions (still require time-term due to earlier guard)
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

  // Threshold:
  // - "время?" => hasTime(3) + questionMark(1) + short(1) = 5 => true
  // - "время сейчас" => 3 + now(2) = 5 => true
  // - "ответь сейчас коротко" => no time term => false (fixed)
  return score >= 5;
}
