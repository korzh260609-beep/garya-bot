// ============================================================================
// === src/bot/handlers/stage-check/classification.js
// ============================================================================

export const FUNCTION_NAME_BLOCKLIST = new Set([
  "RULES",
  "NOTES",
  "IMPORTANT",
  "STATUS",
  "STAGE",
  "WORKFLOW",
  "RESULT",
  "RESULTS",
]);

export const SIMPLE_ARG_BLOCKLIST = new Set([
  "user",
  "users",
  "action",
  "actions",
  "context",
  "contexts",
  "data",
  "item",
  "items",
  "value",
  "values",
  "message",
  "messages",
  "chat",
  "result",
  "results",
]);

export function isAllUppercaseWord(token) {
  return /^[A-Z][A-Z0-9_-]+$/.test(String(token || ""));
}

export function isAllowedUppercaseAcronym(token, config) {
  const raw = String(token || "").trim();
  if (!raw || !isAllUppercaseWord(raw) || raw.includes("_")) return false;
  return config.uppercaseAcronymAllowlist.has(raw.toLowerCase());
}

export function isWeakGenericToken(token) {
  const lower = String(token || "").trim().toLowerCase();
  return new Set([
    "context",
    "contexts",
    "read",
    "write",
    "recent",
    "run",
    "fail",
    "ack",
    "enqueue",
    "user",
    "users",
    "action",
    "actions",
    "access",
    "permission",
    "permissions",
    "denied",
    "allowed",
    "interface",
    "interfaces",
    "contract",
    "contracts",
    "minimal",
    "minimals",
    "job",
    "jobs",
    "queue",
    "queues",
    "skeleton",
    "skeletons",
    "exists",
    "disabled",
    "enabled",
  ]).has(lower);
}

export function isWeakInheritedToken(token) {
  const lower = String(token || "").trim().toLowerCase();
  if (!lower) return true;
  if (isWeakGenericToken(lower)) return true;
  if (lower.length <= 4 && !lower.includes("_") && !lower.includes("-")) return true;
  return false;
}

export function isStrongTechnicalToken(token) {
  const raw = String(token || "").trim();
  const lower = raw.toLowerCase();
  if (!raw) return false;

  if (raw.includes("(")) return true;
  if (raw.includes("_")) return true;
  if (raw.includes("-")) return true;
  if (/^[A-Z][a-z0-9]+(?:[A-Z][a-z0-9]+)+$/.test(raw)) return true;
  if (/^[A-Z0-9_]{3,}$/.test(raw)) return true;

  if (
    lower.includes("retry") ||
    lower.includes("fail") ||
    lower.includes("error") ||
    lower.includes("reason") ||
    lower.includes("dlq") ||
    lower.includes("dead_letter") ||
    lower.includes("dead-letter") ||
    lower.includes("_at") ||
    lower.includes("backoff") ||
    lower.includes("jitter") ||
    lower.includes("attempt")
  ) {
    return true;
  }

  return false;
}

export function isUsefulToken(token, config) {
  const raw = String(token || "").trim();
  if (!raw) return false;

  const lower = raw.toLowerCase();
  if (config.stopTokens.has(lower)) return false;
  if (config.basenameBlocklist.has(lower)) return false;
  if (config.genericUppercaseWords.has(lower)) return false;

  if (
    !raw.endsWith("(") &&
    !raw.includes("(") &&
    lower.length < config.minIdentifierLength
  ) {
    return false;
  }

  if (/^[0-9.]+$/.test(lower)) return false;
  if (/^[a-z]$/.test(lower)) return false;
  if (/^[ivxlcdm]+$/i.test(lower)) return false;

  if (isAllUppercaseWord(raw) && !raw.includes("_")) {
    return isAllowedUppercaseAcronym(raw, config);
  }

  return true;
}

export function isPascalCaseToken(token) {
  return /\b[A-Z][a-z0-9]+(?:[A-Z][a-z0-9]+)+\b/.test(String(token || ""));
}

export function classifySignalEvidence(token) {
  const raw = String(token || "").trim();
  const lower = raw.toLowerCase();

  if (!raw) return "generic";

  if (
    raw.includes("/") ||
    raw.endsWith(".js") ||
    raw.endsWith(".ts") ||
    raw.endsWith(".sql") ||
    raw.endsWith(".json") ||
    raw.endsWith(".md")
  ) {
    return "structural";
  }

  if (
    raw.includes("(") ||
    /^[A-Z][a-z0-9]+(?:[A-Z][a-z0-9]+)+$/.test(raw)
  ) {
    return "interface";
  }

  if (
    lower.includes("retry") ||
    lower.includes("backoff") ||
    lower.includes("jitter") ||
    lower.includes("dlq") ||
    lower.includes("dead_letter") ||
    lower.includes("dead-letter")
  ) {
    return "behavioral";
  }

  if (
    lower.includes("fail") ||
    lower.includes("error") ||
    lower.includes("reason") ||
    lower.includes("status") ||
    lower.includes("attempt") ||
    lower.includes("_at") ||
    lower.includes("count")
  ) {
    return "observational";
  }

  if (
    lower.includes("access") ||
    lower.includes("permission") ||
    lower.startsWith("can")
  ) {
    return "relational";
  }

  return "generic";
}