// src/services/chatMemory/redactMessage.js

function safePolicy(policy = {}) {
  return {
    sourceEnabled: policy?.sourceEnabled === true,
    privacyLevel: String(policy?.privacyLevel || "private_only"),
    allowQuotes: policy?.allowQuotes === true,
    allowRawSnippets: policy?.allowRawSnippets === true,
  };
}

export function redactMessage(input, policy = {}) {
  if (input === null || input === undefined) {
    return "";
  }

  const cfg = safePolicy(policy);
  let text = String(input);

  // remove telegram mentions / username-like handles
  text = text.replace(/(^|\s)@[\p{L}\p{N}_]{2,64}/gu, "$1[mention]");

  // remove emails
  text = text.replace(
    /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/giu,
    "[email]"
  );

  // remove phone-like values
  text = text.replace(
    /(?<!\w)(\+?\d[\d\s().\-]{7,}\d)(?!\w)/g,
    "[phone]"
  );

  // remove t.me links
  text = text.replace(
    /\bhttps?:\/\/t\.me\/[^\s]+/giu,
    "[telegram_link]"
  );

  // remove generic links
  text = text.replace(
    /\bhttps?:\/\/[^\s]+/giu,
    "[link]"
  );

  // 7B.10 — source policy rules
  if (cfg.sourceEnabled && !cfg.allowQuotes) {
    // common quote-like patterns
    text = text.replace(/(^|\n)\s*>[^\n]*/g, "$1[quote]");
    text = text.replace(/[«“"][^"”»\n]{1,500}["”»]/gu, "[quote]");
  }

  if (cfg.sourceEnabled && !cfg.allowRawSnippets) {
    return "[redacted_source_snippet]";
  }

  // privacyLevel is kept for future stricter policies.
  // Current minimal safe behavior:
  // - links/mentions already removed above
  // - raw snippet access governed by allowRawSnippets
  // - quote access governed by allowQuotes
  void cfg.privacyLevel;

  return text.trim();
}

export default redactMessage;