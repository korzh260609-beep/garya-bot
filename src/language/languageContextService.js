const LANGUAGE_NAMES = Object.freeze({
  en: 'English', uk: 'Ukrainian', ru: 'Russian', pl: 'Polish', de: 'German', fr: 'French', es: 'Spanish', it: 'Italian', pt: 'Portuguese',
  cs: 'Czech', sk: 'Slovak', ro: 'Romanian', nl: 'Dutch', tr: 'Turkish', el: 'Greek', ar: 'Arabic', he: 'Hebrew', fa: 'Persian', hi: 'Hindi',
  ja: 'Japanese', ko: 'Korean', zh: 'Chinese', bg: 'Bulgarian', sr: 'Serbian', hr: 'Croatian'
});

const EXPLICIT_LANGUAGE_PATTERNS = Object.freeze([
  [/\b(?:answer|reply|respond|write|speak)\s+(?:to me\s+)?in\s+english\b/iu, 'en'], [/\b(?:відповідай|пиши|говори)\s+(?:мені\s+)?(?:українською|на українській)\b/iu, 'uk'],
  [/\b(?:отвечай|пиши|говори)\s+(?:мне\s+)?(?:по-русски|на русском)\b/iu, 'ru'], [/\b(?:odpowiadaj|pisz|mów)\s+(?:do mnie\s+)?po polsku\b/iu, 'pl'],
  [/\b(?:antworte|schreibe|sprich)\s+(?:mir\s+)?auf deutsch\b/iu, 'de'], [/\b(?:réponds|écris|parle)\s+(?:moi\s+)?en français\b/iu, 'fr'],
  [/\b(?:responde|escribe|habla)\s+(?:me\s+)?en español\b/iu, 'es'], [/\b(?:responda|escreva|fale)\s+(?:comigo\s+)?em português\b/iu, 'pt']
]);

const LATIN_HINTS = Object.freeze({
  en: ['the','and','you','this','that','what','how','please','with','from','for','is','are'],
  pl: ['jest','nie','tak','jak','proszę','czy','dla','oraz','się','który','moja','moje'],
  de: ['der','die','das','und','ist','nicht','wie','bitte','mit','für','ich','du'],
  fr: ['le','la','les','et','est','pas','comment','avec','pour','je','vous','une'],
  es: ['el','la','los','las','y','es','no','cómo','con','para','yo','usted'],
  it: ['il','la','gli','le','e','è','non','come','con','per','io','tu'],
  pt: ['o','a','os','as','e','é','não','como','com','para','eu','você'],
  cs: ['je','není','jak','prosím','pro','který','že','jsem','jsi','ano','ne'],
  sk: ['je','nie','ako','prosím','pre','ktorý','že','som','si','áno'],
  ro: ['este','nu','cum','vă','pentru','care','și','eu','tu','sunt'],
  nl: ['de','het','een','en','is','niet','hoe','met','voor','ik','jij'],
  tr: ['ve','bir','bu','değil','nasıl','için','ile','ben','sen','lütfen']
});

const CYRILLIC_HINTS = Object.freeze({
  ru: ['привет','как','дела','что','это','пожалуйста','для','мой','моя','моего','проекта','проверь','ответь','мне','сейчас'],
  uk: ['привіт','як','справи','що','це','будь','ласка','для','мій','моя','мого','проєкту','перевір','відповідай','мені','зараз'],
  be: ['прывітанне','як','што','гэта','калі','для','мой','мая','мне']
});

function cleanLocale(locale) {
  const value = String(locale ?? '').trim().replace('_', '-');
  if (!value) return null;
  try { return Intl.getCanonicalLocales(value)[0] ?? null; } catch { return null; }
}

function localeLanguage(locale) {
  const canonical = cleanLocale(locale);
  return canonical ? canonical.split('-')[0].toLowerCase() : null;
}

function words(text) {
  return String(text ?? '').toLowerCase().match(/[\p{L}\p{M}']+/gu) ?? [];
}

function scoreHints(tokens, groups) {
  const set = new Set(tokens);
  let best = null;
  for (const [language, hints] of Object.entries(groups)) {
    const score = hints.reduce((sum, hint) => sum + (set.has(hint) ? 1 : 0), 0);
    if (!best || score > best.score) best = { language, score };
  }
  return best;
}

function scriptLanguage(text) {
  if (/\p{Script=Arabic}/u.test(text)) return 'ar';
  if (/\p{Script=Hebrew}/u.test(text)) return 'he';
  if (/\p{Script=Devanagari}/u.test(text)) return 'hi';
  if (/\p{Script=Hiragana}|\p{Script=Katakana}/u.test(text)) return 'ja';
  if (/\p{Script=Hangul}/u.test(text)) return 'ko';
  if (/\p{Script=Han}/u.test(text)) return 'zh';
  if (/\p{Script=Greek}/u.test(text)) return 'el';
  return null;
}

function cyrillicLanguage(text) {
  if (!/\p{Script=Cyrillic}/u.test(text)) return null;
  if (/[іїєґ]/iu.test(text)) return { language: 'uk', confidence: 0.98 };
  if (/[ыэъё]/iu.test(text)) return { language: 'ru', confidence: 0.96 };
  if (/[ў]/iu.test(text)) return { language: 'be', confidence: 0.96 };
  const hint = scoreHints(words(text), CYRILLIC_HINTS);
  if (hint?.score >= 2) return { language: hint.language, confidence: Math.min(0.95, 0.66 + hint.score * 0.07) };
  return { language: 'und', confidence: 0.35 };
}

export function detectLanguageDeterministically(text, { platformLocale = null } = {}) {
  const source = String(text ?? '').trim();
  if (!source || !/\p{L}/u.test(source)) return Object.freeze({ language: 'und', confidence: 0, source: 'no-language-signal' });
  const script = scriptLanguage(source);
  if (script) return Object.freeze({ language: script, confidence: 0.98, source: 'unicode-script' });
  const cyrillic = cyrillicLanguage(source);
  if (cyrillic && cyrillic.language !== 'und') return Object.freeze({ ...cyrillic, source: 'cyrillic-detection' });
  const tokenList = words(source);
  const hint = scoreHints(tokenList, LATIN_HINTS);
  if (hint?.score >= 2) return Object.freeze({ language: hint.language, confidence: Math.min(0.98, 0.65 + hint.score * 0.07), source: 'lexical-hints' });
  const platformLanguage = localeLanguage(platformLocale);
  if (platformLanguage) return Object.freeze({ language: platformLanguage, confidence: 0.45, source: 'platform-locale-fallback' });
  if (cyrillic) return Object.freeze({ ...cyrillic, source: 'ambiguous-cyrillic' });
  return Object.freeze({ language: 'und', confidence: 0.2, source: 'insufficient-signal' });
}

export function detectExplicitResponseLanguage(text) {
  const source = String(text ?? '');
  for (const [pattern, language] of EXPLICIT_LANGUAGE_PATTERNS) if (pattern.test(source)) return language;
  return null;
}

export function createInMemoryLanguageStore() {
  const preferences = new Map();
  return Object.freeze({
    async get(globalUserId) { return preferences.get(String(globalUserId)) ?? null; },
    async set(globalUserId, record) {
      const value = Object.freeze({ language: String(record.language), locale: cleanLocale(record.locale), source: record.source ?? 'user', provenance: record.provenance ?? null, updatedAt: new Date().toISOString() });
      preferences.set(String(globalUserId), value); return value;
    }
  });
}

export function createLanguageContextService({ store = createInMemoryLanguageStore(), detector = null, fallbackLanguage = 'en' } = {}) {
  if (!store?.get || !store?.set) throw new TypeError('language store with get/set is required');
  async function detect(text, options = {}) {
    if (detector?.detect) {
      try {
        const result = await detector.detect(text, options);
        if (result?.language) return Object.freeze({ language: String(result.language).toLowerCase(), confidence: Number(result.confidence ?? 0), source: result.source ?? 'ai-router' });
      } catch {}
    }
    return detectLanguageDeterministically(text, options);
  }
  async function resolve({ globalUserId, text, platformLocale = null, conversationLanguage = null } = {}) {
    const preferred = globalUserId ? await store.get(globalUserId) : null;
    const detected = await detect(text, { platformLocale });
    const explicit = detectExplicitResponseLanguage(text);
    const platformLanguage = localeLanguage(platformLocale);
    const responseLanguage = explicit || (detected.language !== 'und' && detected.confidence >= 0.6 ? detected.language : null) || conversationLanguage || preferred?.language || platformLanguage || fallbackLanguage;
    return Object.freeze({
      messageLanguage: detected.language,
      preferredLanguage: preferred?.language ?? null,
      conversationLanguage: conversationLanguage ?? (detected.language !== 'und' && detected.confidence >= 0.6 ? detected.language : null),
      platformLocale: cleanLocale(platformLocale),
      locale: preferred?.locale ?? cleanLocale(platformLocale),
      responseLanguage,
      confidence: detected.confidence,
      detectionSource: detected.source,
      responseLanguageSource: explicit ? 'explicit-user-instruction' : detected.language !== 'und' && detected.confidence >= 0.6 ? 'message-detection' : conversationLanguage ? 'conversation' : preferred?.language ? 'preferred-language' : platformLanguage ? 'platform-locale' : 'system-fallback'
    });
  }
  async function setPreferred(globalUserId, language, { locale = null, source = 'explicit-user-setting', provenance = null } = {}) {
    return store.set(globalUserId, { language: String(language).toLowerCase(), locale, source, provenance });
  }
  return Object.freeze({ resolve, detect, setPreferred, getPreferred: (id) => store.get(id), languageName: (code) => LANGUAGE_NAMES[code] ?? code });
}
