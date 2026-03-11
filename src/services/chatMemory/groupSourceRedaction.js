// src/services/chatMemory/groupSourceRedaction.js
// STAGE 7B.10 — GROUP SOURCE REDACTION RULES (SKELETON ONLY)
//
// IMPORTANT:
// - skeleton only
// - NO runtime wiring yet
// - NO recall integration yet
// - NO cross-group retrieval logic yet
// - NO policy enforcement replacement yet
// - NO authority shift from Stage 11.17
//
// Purpose:
// define one safe, explicit redaction contract for future cross-group/group-source
// outputs without changing current production behavior.
//
// Workflow boundary:
// - Stage 7B.10 defines redaction rules contract
// - Stage 11.17 will define policy/visibility gate
// - Stage 8A.8 / 8A.9 may consume this later
//
// Hard rule for this step:
// this file must remain non-authoritative for runtime until a separate approved
// wiring step is done and repo is re-verified.

const DEFAULT_MAX_LEN = 600;

function toSafeString(value) {
  if (typeof value === "string") return value;
  if (value == null) return "";
  return String(value);
}

function normalizeWhitespace(text = "") {
  return toSafeString(text)
    .replace(/\r\n/g, "\n")
    .replace(/\t/g, " ")
    .replace(/[ ]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function stripTelegramMentions(text = "") {
  return toSafeString(text).replace(/(^|[\s(>])@[a-zA-Z0-9_]{3,}\b/g, "$1[redacted_mention]");
}

function stripProfileLinks(text = "") {
  return toSafeString(text)
    .replace(/https?:\/\/t\.me\/[^\s)]+/gi, "[redacted_profile_link]")
    .replace(/https?:\/\/telegram\.me\/[^\s)]+/gi, "[redacted_profile_link]")
    .replace(/https?:\/\/telegram\.dog\/[^\s)]+/gi, "[redacted_profile_link]");
}

function stripEmails(text = "") {
  return toSafeString(text).replace(
    /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[A-Za-z]{2,}\b/g,
    "[redacted_email]"
  );
}

function stripPhones(text = "") {
  return toSafeString(text).replace(
    /(?<!\w)(?:\+?\d[\d\s().-]{7,}\d)(?!\w)/g,
    "[redacted_phone]"
  );
}

function stripExplicitIdentifiers(text = "") {
  let out = toSafeString(text);

  // Common TG/user/profile patterns
  out = out.replace(/\buser_id\s*:\s*\d+\b/gi, "user_id: [redacted_id]");
  out = out.replace(/\bchat_id\s*:\s*-?\d+\b/gi, "chat_id: [redacted_id]");
  out = out.replace(/\bid\s*:\s*-?\d+\b/gi, "id: [redacted_id]");

  return out;
}

function stripQuoteLines(text = "") {
  return toSafeString(text)
    .split("\n")
    .filter((line) => !/^\s*>/.test(line))
    .join("\n");
}

function stripQuotedBlocks(text = "") {
  return toSafeString(text)
    .replace(/[“"][^"\n]{1,400}["”]/g, "[redacted_quote]")
    .replace(/[«][^»\n]{1,400}[»]/g, "[redacted_quote]");
}

function safeTruncate(text = "", maxLen = DEFAULT_MAX_LEN) {
  const source = toSafeString(text);
  const limit = Number.isFinite(maxLen) && maxLen > 0 ? Math.floor(maxLen) : DEFAULT_MAX_LEN;

  if (source.length <= limit) {
    return {
      text: source,
      truncated: false,
      originalLength: source.length,
      finalLength: source.length,
    };
  }

  const sliced = source.slice(0, Math.max(0, limit)).trimEnd();

  return {
    text: `${sliced}…`,
    truncated: true,
    originalLength: source.length,
    finalLength: sliced.length + 1,
  };
}

export function redactGroupSourceText(
  input = "",
  options = {}
) {
  const originalText = toSafeString(input);

  const config = {
    removeMentions: options.removeMentions !== false,
    removeProfileLinks: options.removeProfileLinks !== false,
    removeEmails: options.removeEmails !== false,
    removePhones: options.removePhones !== false,
    removeExplicitIdentifiers: options.removeExplicitIdentifiers !== false,

    // Stage 7B.10.4 hard direction:
    // ban verbatim quotes for cross-group (no quotes)
    // For skeleton we keep this ON by default for safety.
    removeQuotes: options.removeQuotes !== false,

    maxLen:
      Number.isFinite(options.maxLen) && options.maxLen > 0
        ? Math.floor(options.maxLen)
        : DEFAULT_MAX_LEN,
  };

  let text = normalizeWhitespace(originalText);

  const meta = {
    contractVersion: 1,
    skeletonOnly: true,
    runtimeActive: false,
    policyAuthorityDeferredToStage1117: true,

    rulesRequested: {
      removeMentions: config.removeMentions,
      removeProfileLinks: config.removeProfileLinks,
      removeEmails: config.removeEmails,
      removePhones: config.removePhones,
      removeExplicitIdentifiers: config.removeExplicitIdentifiers,
      removeQuotes: config.removeQuotes,
      maxLen: config.maxLen,
    },

    transformations: {
      mentionsRedacted: false,
      profileLinksRedacted: false,
      emailsRedacted: false,
      phonesRedacted: false,
      explicitIdentifiersRedacted: false,
      quotesRedacted: false,
      truncated: false,
    },

    originalLength: originalText.length,
    finalLength: 0,
  };

  if (config.removeMentions) {
    const next = stripTelegramMentions(text);
    if (next !== text) meta.transformations.mentionsRedacted = true;
    text = next;
  }

  if (config.removeProfileLinks) {
    const next = stripProfileLinks(text);
    if (next !== text) meta.transformations.profileLinksRedacted = true;
    text = next;
  }

  if (config.removeEmails) {
    const next = stripEmails(text);
    if (next !== text) meta.transformations.emailsRedacted = true;
    text = next;
  }

  if (config.removePhones) {
    const next = stripPhones(text);
    if (next !== text) meta.transformations.phonesRedacted = true;
    text = next;
  }

  if (config.removeExplicitIdentifiers) {
    const next = stripExplicitIdentifiers(text);
    if (next !== text) meta.transformations.explicitIdentifiersRedacted = true;
    text = next;
  }

  if (config.removeQuotes) {
    let next = stripQuoteLines(text);
    next = stripQuotedBlocks(next);

    if (next !== text) meta.transformations.quotesRedacted = true;
    text = next;
  }

  text = normalizeWhitespace(text);

  const trunc = safeTruncate(text, config.maxLen);
  text = trunc.text;
  meta.transformations.truncated = trunc.truncated;
  meta.finalLength = trunc.finalLength;

  return {
    originalText,
    redactedText: text,
    meta,
  };
}

export function buildGroupSourceRedactionPreview(
  input = "",
  options = {}
) {
  const result = redactGroupSourceText(input, options);

  return {
    previewText: result.redactedText,
    previewMeta: {
      ...result.meta,
      previewOnly: true,
    },
  };
}

export default redactGroupSourceText;