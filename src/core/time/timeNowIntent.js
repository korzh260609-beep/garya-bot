// src/core/time/timeNowIntent.js
// STAGE 8C — Deterministic TIME_NOW intent (no AI)

function normalize(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hasAny(text, list) {
  return list.some((w) => text.includes(w));
}

export function isTimeNowIntent(inputText) {
  const t = normalize(inputText);

  if (!t) return false;

  // --- blacklist (avoid false positives) ---
  const blacklist = [
    "таймер",
    "секундомер",
    "обратный отсчет",
    "сколько времени осталось",
    "время в пути",
    "времени в пути",
    "погода",
    "температура",
  ];
  if (hasAny(t, blacklist)) return false;

  // --- strong phrase patterns (RU/UA/EN) ---
  const strongPatterns = [
    /\bкоторый\s+час\b/u,
    /\bсколько\s+сейчас\s+времени\b/u,
    /\bскільки\s+зараз\s+годин\b/u,
    /\bкотра\s+зараз\s+година\b/u,
    /\bwhat\s+time\s+is\s+it\b/i,
    /\btime\s+now\b/i,
    /\bcurrent\s+time\b/i,
  ];
  if (strongPatterns.some((re) => re.test(t))) return true;

  // --- soft logic: need (time word) + (now word) ---
  const timeWords = ["время", "час", "година", "time", "clock"];
  const nowWords = ["сейчас", "щас", "зараз", "now", "current", "at the moment"];

  const hasTime = hasAny(t, timeWords);
  const hasNow = hasAny(t, nowWords);

  return hasTime && hasNow;
}
