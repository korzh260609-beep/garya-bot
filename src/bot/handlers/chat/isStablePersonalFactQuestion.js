// src/bot/handlers/chat/isStablePersonalFactQuestion.js

function safeStr(value) {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return "";
  return String(value);
}

function normalizeText(value) {
  return safeStr(value).trim().toLowerCase();
}

function hasAny(text, patterns) {
  return patterns.some((pattern) => pattern.test(text));
}

function looksLikeQuestion(text) {
  if (!text) return false;

  return (
    text.includes("?") ||
    hasAny(text, [
      /^(как|какой|какая|какие|каково|кто|что|где|почему|зачем|сколько)\b/i,
      /^(what|who|which|where|why|how)\b/i,
      /\bскажи\b/i,
      /\bнапомни\b/i,
      /\btell me\b/i,
      /\bremind me\b/i,
      /\bdo you remember\b/i,
    ])
  );
}

function refersToUserSelf(text) {
  if (!text) return false;

  return hasAny(text, [
    /\bя\b/i,
    /\bменя\b/i,
    /\bмне\b/i,
    /\bмой\b/i,
    /\bмоя\b/i,
    /\bмоё\b/i,
    /\bмое\b/i,
    /\bмои\b/i,
    /\bу меня\b/i,
    /\bобо мне\b/i,
    /\bпро меня\b/i,
    /\bmy\b/i,
    /\bme\b/i,
    /\bi\b/i,
    /\babout me\b/i,
  ]);
}

function isTemporalOrSessionBoundQuestion(text) {
  if (!text) return false;

  return hasAny(text, [
    /\bсейчас\b/i,
    /\bсегодня\b/i,
    /\bвчера\b/i,
    /\bзавтра\b/i,
    /\bнедавно\b/i,
    /\bтолько что\b/i,
    /\bмы обсуждали\b/i,
    /\bмы говорили\b/i,
    /\bв этом чате\b/i,
    /\blast message\b/i,
    /\btoday\b/i,
    /\byesterday\b/i,
    /\brecent\b/i,
    /\bin this chat\b/i,
  ]);
}

function isActionRequest(text) {
  if (!text) return false;

  return hasAny(text, [
    /\bсделай\b/i,
    /\bсоздай\b/i,
    /\bнапиши\b/i,
    /\bпереведи\b/i,
    /\bпокажи\b/i,
    /\bнайди\b/i,
    /\bрасскажи\b/i,
    /\banalyze\b/i,
    /\bcreate\b/i,
    /\bwrite\b/i,
    /\bfind\b/i,
    /\bshow\b/i,
    /\btranslate\b/i,
  ]);
}

function mentionsStableFactDomain(text) {
  if (!text) return false;

  return hasAny(text, [
    /\bимя\b/i,
    /\bзовут\b/i,
    /\bname\b/i,
    /\bstyle\b/i,
    /\bстиль\b/i,
    /\bпредпочита/i,
    /\bpreference\b/i,
    /\bроль\b/i,
    /\brole\b/i,
    /\bпрофиль\b/i,
    /\bprofile\b/i,
    /\bмашин/i,
    /\bавто\b/i,
    /\bcar\b/i,
    /\bfreelander\b/i,
  ]);
}

export function isStablePersonalFactQuestion(text) {
  const normalized = normalizeText(text);

  if (!normalized) return false;
  if (!looksLikeQuestion(normalized)) return false;
  if (!refersToUserSelf(normalized)) return false;
  if (isTemporalOrSessionBoundQuestion(normalized)) return false;
  if (isActionRequest(normalized)) return false;

  // Консервативно:
  // либо явно есть домен стабильного факта,
  // либо это короткий вопрос о себе без признаков временного/операционного запроса.
  if (mentionsStableFactDomain(normalized)) return true;

  const words = normalized.split(/\s+/).filter(Boolean);
  return words.length <= 10;
}

export default isStablePersonalFactQuestion;