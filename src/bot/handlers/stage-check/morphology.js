// ============================================================================
// === src/bot/handlers/stage-check/morphology.js
// ============================================================================

import { uniq } from "./common.js";
import { isUsefulToken } from "./classification.js";

const MORPH_SINGULAR_BLOCKLIST = new Set([
  "access",
  "process",
  "class",
  "ress",
  "ness",
  "ous",
  "iss",
  "ass",
  "ess",
]);

function splitPhraseWords(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[`"'()[\]{}:;,.!?]/g, " ")
    .replace(/[\/\\]/g, " ")
    .replace(/-/g, " ")
    .split(/\s+/)
    .map((x) => x.trim())
    .filter(Boolean);
}

function toPascalCase(words) {
  return words
    .map((word) => word ? word[0].toUpperCase() + word.slice(1).toLowerCase() : "")
    .join("");
}

function addMorphVariants(base, add) {
  const lower = String(base || "").toLowerCase();
  if (!lower) return;

  add(lower);

  if (lower.endsWith("ies") && lower.length > 4) {
    add(lower.slice(0, -3) + "y");
  }

  if (lower.endsWith("s") && lower.length > 4) {
    const stem = lower.slice(0, -1);
    if (stem.length >= 3 && !MORPH_SINGULAR_BLOCKLIST.has(lower)) {
      add(stem);
    }
  } else if (!lower.endsWith("ss")) {
    add(`${lower}s`);
  }

  if (lower.endsWith("ed") && lower.length > 4) {
    add(lower.slice(0, -2));
  }

  if (lower.endsWith("ing") && lower.length > 5) {
    add(lower.slice(0, -3));
  }
}

function isTechnicalPhraseWord(word) {
  const lower = String(word || "").toLowerCase();
  if (!lower) return false;

  if ([
    "retry",
    "retries",
    "fail",
    "failed",
    "failure",
    "failures",
    "reason",
    "reasons",
    "error",
    "errors",
    "dlq",
    "dead",
    "letter",
    "backoff",
    "jitter",
    "attempt",
    "attempts",
    "status",
    "count",
    "counts",
    "lock",
    "dedupe",
  ].includes(lower)) {
    return true;
  }

  if (lower.includes("_") || lower.includes("-")) return true;
  if (/^[a-z]+[0-9]+$/.test(lower)) return true;

  return false;
}

function addDelimiterVariants(parts, add) {
  const tokens = parts.map((x) => String(x || "").trim().toLowerCase()).filter(Boolean);
  if (!tokens.length) return;

  const allTechnical = tokens.every(isTechnicalPhraseWord);
  if (!allTechnical) return;

  add(tokens.join("_"));
  add(tokens.join("-"));

  if (tokens.length <= 2) {
    add(tokens.join(""));
    add(tokens.join(" "));
    add(toPascalCase(tokens));
  }
}

function addConceptFamilies(token, add) {
  const lower = String(token || "").toLowerCase();
  if (!lower) return;

  if (lower === "retry" || lower === "retries" || lower === "retried" || lower === "retrying") {
    [
      "retry",
      "retries",
      "retry_policy",
      "max_retries",
      "retry_count",
      "retry_at",
      "next_retry_at",
      "backoff",
      "jitter",
      "retryable",
      "retried_at",
      "computeBackoffDelayMs",
      "shouldRetry",
      "getRetryPolicy",
      "maxRetries",
    ].forEach(add);
  }

  if (
    lower === "fail" ||
    lower === "failed" ||
    lower === "failure" ||
    lower === "failures" ||
    lower === "failing"
  ) {
    [
      "fail",
      "failed",
      "failure",
      "failures",
      "fail_reason",
      "fail_reasons",
      "fail_code",
      "failure_reason",
      "error_reason",
      "failed_at",
      "last_error_at",
      "error_code",
      "markTaskRunFailed",
      "normalizeFailCode",
    ].forEach(add);
  }

  if (lower === "reason" || lower === "reasons") {
    [
      "reason",
      "reasons",
      "fail_reason",
      "fail_reasons",
      "failure_reason",
      "error_reason",
    ].forEach(add);
  }

  if (lower === "error" || lower === "errors") {
    [
      "error",
      "errors",
      "error_code",
      "last_error_at",
      "failure_reason",
      "fail_reason",
      "fail_code",
    ].forEach(add);
  }

  if (lower === "permission" || lower === "permissions") {
    [
      "permission",
      "permissions",
      "allowed",
      "denied",
      "access",
      "can",
      "can(",
      "permission_denied",
    ].forEach(add);
  }

  if (lower === "access") {
    [
      "access",
      "allowed",
      "denied",
      "permission",
      "permissions",
      "can",
      "can(",
    ].forEach(add);
  }

  if (lower === "can") {
    [
      "can",
      "can(",
      "allowed",
      "denied",
      "permission",
      "permissions",
      "access",
    ].forEach(add);
  }

  if (lower === "enqueue" || lower === "run" || lower === "ack" || lower === "fail") {
    [
      "enqueue",
      "run",
      "ack",
      "fail",
      "JobRunner",
      "enqueue(",
      "run(",
      "ack(",
      "fail(",
    ].forEach(add);
  }

  if (lower === "write" || lower === "read" || lower === "context" || lower === "recent") {
    [
      "write",
      "read",
      "context",
      "recent",
      "write(",
      "read(",
      "context(",
      "recent(",
    ].forEach(add);
  }

  if (lower === "dlq") {
    [
      "dlq",
      "dlqs",
      "dead_letter",
      "dead_letter_queue",
      "dead-letter",
      "dead-letter-queue",
      "dead_letter_queue_enabled",
      "move_to_dlq",
      "moveToDlq",
      "dlq_jobs",
      "DlqRepo",
      "JOB_DLQ_ENABLED",
      "_moveToDLQ",
      "getDLQ",
      "enableDLQ",
      "_dlqEnabled",
    ].forEach(add);
  }

  if (lower === "dead" || lower === "letter") {
    [
      "dead_letter",
      "dead_letter_queue",
      "dead-letter",
      "dead-letter-queue",
      "dlq",
      "dlq_jobs",
      "move_to_dlq",
      "moveToDlq",
      "DlqRepo",
      "_moveToDLQ",
    ].forEach(add);
  }

  if (lower === "count" || lower === "counts") {
    [
      "count",
      "counts",
      "total",
      "hits",
      "attempts",
    ].forEach(add);
  }

  if (lower === "status" || lower === "statuses") {
    [
      "status",
      "statuses",
      "state",
      "states",
      "completed",
      "failed",
      "running",
      "queued",
    ].forEach(add);
  }
}

export function buildConceptualVariants(token, config) {
  const raw = String(token || "").trim();
  if (!raw) return [];

  const out = new Set();
  const lower = raw.toLowerCase();

  function add(value) {
    const text = String(value || "").trim();
    if (!text) return;
    if (isUsefulToken(text, config)) out.add(text);
  }

  add(raw);
  add(lower);

  if (raw.includes("-")) {
    add(raw.replace(/-/g, "_"));
    add(raw.replace(/-/g, ""));
    add(raw.replace(/-/g, " "));
  }

  if (raw.includes("_")) {
    add(raw.replace(/_/g, "-"));
    add(raw.replace(/_/g, ""));
    add(raw.replace(/_/g, " "));
  }

  addMorphVariants(lower, add);

  if (lower.includes("retries")) {
    add(lower.replace(/retries/g, "retry"));
  }
  if (lower.includes("retry")) {
    add(lower.replace(/retry/g, "retries"));
    add("retry_at");
    add("max_retries");
    add("retry_policy");
    add("retry_count");
    add("maxRetries");
    add("computeBackoffDelayMs");
    add("shouldRetry");
  }

  if (lower.includes("fail")) {
    add("fail_reason");
    add("fail_reasons");
    add("fail_code");
    add("failed_at");
    add("last_error_at");
    add("failure_reason");
    add("error_code");
    add("markTaskRunFailed");
    add("normalizeFailCode");
  }

  if (lower.includes("reason")) {
    add("fail_reason");
    add("fail_reasons");
    add("failure_reason");
    add("error_reason");
  }

  if (lower.includes("error")) {
    add("error_code");
    add("last_error_at");
    add("fail_reason");
    add("fail_code");
  }

  if (lower === "dlq" || lower.includes("dead_letter") || lower.includes("dead-letter")) {
    [
      "dead_letter",
      "dead_letter_queue",
      "dead-letter",
      "dead-letter-queue",
      "move_to_dlq",
      "moveToDlq",
      "dlq_jobs",
      "DlqRepo",
      "JOB_DLQ_ENABLED",
      "_moveToDLQ",
      "getDLQ",
      "enableDLQ",
      "_dlqEnabled",
    ].forEach(add);
  }

  addConceptFamilies(lower, add);

  return uniq(Array.from(out));
}

export function buildPhraseSemanticSignals(text, config) {
  const source = String(text || "");
  const out = new Set();

  function add(value) {
    const token = String(value || "").trim();
    if (!token) return;
    if (isUsefulToken(token, config)) out.add(token);
  }

  function addExpanded(value) {
    for (const variant of buildConceptualVariants(value, config)) {
      add(variant);
    }
  }

  const words = splitPhraseWords(source);

  for (const word of words) {
    addExpanded(word);
  }

  for (let i = 0; i < words.length; i += 1) {
    const two = words.slice(i, i + 2);
    const three = words.slice(i, i + 3);

    if (two.length === 2) {
      addDelimiterVariants(two, addExpanded);
    }

    if (three.length === 3) {
      addDelimiterVariants(three, addExpanded);
    }

    const one = words[i];

    if (one === "dead" && words[i + 1] === "letter") {
      addExpanded("dead_letter");
      addExpanded("dead_letter_queue");
      addExpanded("dlq");
    }

    if (one === "fail" && words[i + 1] === "reasons") {
      addExpanded("fail_reasons");
      addExpanded("fail_reason");
    }

    if (one === "retry" && words[i + 1] === "policy") {
      addExpanded("retry_policy");
      addExpanded("max_retries");
      addExpanded("computeBackoffDelayMs");
      addExpanded("shouldRetry");
    }

    if (one === "retries" && words[i + 1] === "fail") {
      addExpanded("retry");
      addExpanded("retries");
      addExpanded("fail");
      addExpanded("retry_at");
      addExpanded("max_retries");
      addExpanded("fail_reason");
      addExpanded("fail_code");
      addExpanded("last_error_at");
    }

    if (one === "retries" && words[i + 1] === "fail" && words[i + 2] === "reasons") {
      addExpanded("retry");
      addExpanded("retries");
      addExpanded("fail_reason");
      addExpanded("fail_reasons");
      addExpanded("retry_at");
      addExpanded("max_retries");
      addExpanded("fail_code");
      addExpanded("last_error_at");
      addExpanded("computeBackoffDelayMs");
      addExpanded("shouldRetry");
    }
  }

  return uniq(Array.from(out));
}