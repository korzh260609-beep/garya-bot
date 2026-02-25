// src/core/time/timeNowIntent.js
// STAGE 8C — Deterministic TIME_NOW intent (score + blacklist, no AI)

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

  // Extra blacklist patterns
  const blacklistRe = [
    /\b(remind|reminder)\b/i,
    /\balarm\b/i,
    /\btimer\b/i,
    /\bcountdown\b/i,
  ];
  if (matchesAny(t, blacklistRe)) return false;

  // --- HIGH-CONFIDENCE (instant true) ---
  // These should be super safe.
  const strongPatterns = [
    /\bкотор(ый|ая)\s+час\b/u,
    /\bсколько\s+(сейчас\s+)?времен[иь]\b/u,
    /\bскільки\s+(зараз\s+)?(годин|часу)\b/u,
    /\bкотра\s+(зараз\s+)?година\b/u,
    /\bwhat\s+time\s+is\s+it\b/i,
    /\bwhat\s+is\s+the\s+time\b/i,
    /\btime\s+now\b/i,
    /\bcurrent\s+time\b/i,
  ];
  if (matchesAny(t, strongPatterns)) return true;

  // --- SCORE MODEL ---
  // Goal: catch most natural variants without AI.
  let score = 0;

  const timeTerms = [
    "время",
    "час",
    "година",
    "time",
    "clock",
    "heure", // optional FR
    "zeit", // optional DE
  ];

  const nowTerms = ["сейчас", "щас", "зараз", "now", "current", "currently", "moment", "rn"];

  const questionTerms = [
    "котор", // catches который/которая/котрої etc (rough stem)
    "сколько",
    "скільки",
    "котра",
    "what",
    "whats",
    "what's",
    "tell",
    "say",
  ];

  const hasTime = hasAny(t, timeTerms);
  const hasNow = hasAny(t, nowTerms);
  const hasQuestion = hasAny(t, questionTerms) || hadQuestionMark;

  if (hasTime) score += 3;
  if (hasNow) score += 2;
  if (hasQuestion) score += 1;

  // Short direct questions are more likely to be TIME_NOW
  const wc = countWords(t);
  if (wc > 0 && wc <= 5) score += 1;

  // Common constructions (loose)
  const loosePatterns = [
    /\bчас\s+зараз\b/u,
    /\bвремя\s+сейчас\b/u,
    /\bсейчас\s+время\b/u,
    /\bсколько\s+часов\b/u,
    /\bкотор(ый|ая)\b/u,
    /\bwhat\s+time\b/i,
  ];
  if (matchesAny(t, loosePatterns)) score += 1;

  // Threshold chosen to reduce false positives:
  // - time + now => 3+2 = 5 (instant pass)
  // - "который час" often hits time + question (+short bonus) => pass
  // - "time?" hits time + question + short => 3+1+1=5 => pass
  return score >= 5;
}
