// AGENT NOTE:
// SG 2.0 Render sanitizer.
// Purpose: remove obvious secret material from Render logs/responses before any workspace write.
// This is a safety layer, not a permission system.

const SECRET_PATTERNS = Object.freeze([
  /sk-[A-Za-z0-9_-]{12,}/g,
  /ghp_[A-Za-z0-9_]{12,}/g,
  /github_pat_[A-Za-z0-9_]{12,}/g,
  /Bearer\s+[A-Za-z0-9._~+/-]+=*/gi,
  /postgres(?:ql)?:\/\/[^\s]+/gi,
  /mongodb(?:\+srv)?:\/\/[^\s]+/gi,
  /redis:\/\/[^\s]+/gi,
]);

const SECRET_KEYWORDS = Object.freeze([
  "API_KEY",
  "TOKEN",
  "SECRET",
  "PASSWORD",
  "PRIVATE_KEY",
  "DATABASE_URL",
  "CONNECTION_STRING",
]);

function normalizeString(value) {
  return typeof value === "string" ? value : "";
}

export function sanitizeRenderText(value, { maxChars = 2000 } = {}) {
  let out = normalizeString(value);

  for (const pattern of SECRET_PATTERNS) {
    out = out.replace(pattern, "[REDACTED]");
  }

  out = out
    .split(/\r?\n/)
    .map((line) => {
      const upper = line.toUpperCase();
      const hasSecretKeyword = SECRET_KEYWORDS.some((keyword) => upper.includes(keyword));
      if (!hasSecretKeyword) return line;

      const eqIndex = line.indexOf("=");
      if (eqIndex < 0) return line.replace(/:.+$/, ": [REDACTED]");
      return `${line.slice(0, eqIndex + 1)}[REDACTED]`;
    })
    .join("\n");

  const n = Number(maxChars);
  if (Number.isFinite(n) && n > 0 && out.length > n) {
    return `${out.slice(0, n - 1)}…`;
  }

  return out;
}

export function sanitizeRenderLogItem(item = {}, { maxMessageChars = 1200 } = {}) {
  return {
    timestamp: item.timestamp || "",
    level: item.level || "",
    serviceId: item.serviceId || "",
    message: sanitizeRenderText(item.message || "", { maxChars: maxMessageChars }),
  };
}

export function sanitizeRenderLogs(logs = [], options = {}) {
  return logs.map((item) => sanitizeRenderLogItem(item, options));
}

export default {
  sanitizeRenderText,
  sanitizeRenderLogItem,
  sanitizeRenderLogs,
};
