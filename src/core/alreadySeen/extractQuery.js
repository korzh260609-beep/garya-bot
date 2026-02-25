// src/core/alreadySeen/extractQuery.js
// STAGE 8B.1 — ExtractQuery (3–7 keywords, normalized)
// Goal: deterministic lightweight keyword extraction for Already-Seen detector.

const STOPWORDS = new Set([
  // EN
  "the","a","an","and","or","but","if","then","else","this","that","these","those",
  "is","are","was","were","be","been","being","to","of","in","on","at","for","from",
  "with","about","as","it","its","i","you","we","they","he","she","them","me","my",
  "your","our","their","can","could","should","would","do","did","does","not","no",
  // RU
  "и","или","но","если","то","это","эта","эти","тот","та","те",
  "я","ты","вы","мы","они","он","она","оно","меня","мне","мои","мой","моя","твой","твоя",
  "к","ко","в","во","на","по","за","из","у","от","для","с","со","о","об","про",
  "не","нет","да","же","ли","бы","как","что","чтобы","когда","где","почему","зачем"
]);

function normalizeText(input) {
  const s = String(input || "").toLowerCase();
  // keep letters/digits/spaces, drop punctuation/emojis
  return s
    .replace(/[\u2010-\u2015]/g, "-")
    .replace(/[^a-z0-9а-яіїєґ\s-]+/giu, " ")
    .replace(/[-_]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function extractQuery(input, opts = {}) {
  const minKeywords = Number.isFinite(opts.minKeywords) ? opts.minKeywords : 3;
  const maxKeywords = Number.isFinite(opts.maxKeywords) ? opts.maxKeywords : 7;

  const text = normalizeText(input);
  if (!text) return { ok: false, keywords: [], normalized: "" };

  const parts = text.split(/\s+/).filter(Boolean);

  const keywords = [];
  const seen = new Set();

  for (const w0 of parts) {
    const w = w0.trim();
    if (!w) continue;

    // drop very short tokens
    if (w.length < 3) continue;

    // drop pure numbers (but keep mixed like "gpt5")
    if (/^\d+$/.test(w)) continue;

    if (STOPWORDS.has(w)) continue;
    if (seen.has(w)) continue;

    seen.add(w);
    keywords.push(w);

    if (keywords.length >= maxKeywords) break;
  }

  if (keywords.length < minKeywords) {
    return { ok: false, keywords, normalized: keywords.join(" ") };
  }

  return {
    ok: true,
    keywords,
    normalized: keywords.join(" "),
  };
}

export default extractQuery;
