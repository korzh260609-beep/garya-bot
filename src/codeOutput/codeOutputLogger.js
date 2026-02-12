// ============================================================================
// === src/codeOutput/codeOutputLogger.js
// === STAGE 12A / WORKFLOW 4.2: Security logging for CODE OUTPUT (NO DB)
// === IMPORTANT: console-only. No DB writes. No tables. No migrations.
// ============================================================================

/**
 * Normalize any value into a safe short string (for logs).
 */
function toSafeString(value, maxLen = 500) {
  const s =
    value === null || value === undefined
      ? ""
      : typeof value === "string"
      ? value
      : String(value);

  if (s.length <= maxLen) return s;
  return s.slice(0, maxLen) + "…";
}

/**
 * Ensure details is a plain object (safe for JSON/logging).
 */
function toSafeObject(details) {
  if (!details || typeof details !== "object") return {};
  try {
    // avoid circular refs
    return JSON.parse(JSON.stringify(details));
  } catch {
    return { _note: "details_unserializable" };
  }
}

/**
 * Build a normalized refusal event payload.
 * This module MUST remain side-effect-light: console logging only.
 */
export function buildCodeOutputRefusalEvent({
  chatId,
  senderId,
  command,
  reason,
  path = null,
  details = {},
  snapshotId = null,
  mode = "DISABLED",
}) {
  return {
    type: "CODE_OUTPUT_REFUSE",
    ts: new Date().toISOString(),
    chatId: toSafeString(chatId),
    senderId: toSafeString(senderId),
    command: toSafeString(command),
    reason: toSafeString(reason),
    path: path ? toSafeString(path) : null,
    snapshotId: snapshotId !== null ? toSafeString(snapshotId) : null,
    mode: toSafeString(mode),
    details: toSafeObject(details),
  };
}

/**
 * Console-only logging of a CODE OUTPUT refusal.
 * @returns {Promise<object>} the normalized event payload
 */
export async function logCodeOutputRefuse({
  chatId,
  senderId,
  command,
  reason,
  path = null,
  details = {},
  snapshotId = null,
  mode = "DISABLED",
}) {
  const event = buildCodeOutputRefusalEvent({
    chatId,
    senderId,
    command,
    reason,
    path,
    details,
    snapshotId,
    mode,
  });

  // Console logging only (Render logs).
  // Do not write to DB here — by design (Stage 4.2).
  try {
    console.info("🚫 CODE_OUTPUT_REFUSE", {
      ts: event.ts,
      chatId: event.chatId,
      senderId: event.senderId,
      command: event.command,
      reason: event.reason,
      path: event.path,
      snapshotId: event.snapshotId,
      mode: event.mode,
    });
  } catch (err) {
    // last resort: never throw from logger
    console.error("❌ CODE_OUTPUT_REFUSE logger error:", err);
  }

  return event;
}

/**
 * Stub: DB-backed history is NOT allowed until Stage 8.
 * Keep API shape for future use, but return empty data now.
 */
export async function getCodeOutputRefusals(_chatId, _limit = 10) {
  return [];
}

/**
 * Stub: DB-backed stats are NOT allowed until Stage 8.
 */
export async function getCodeOutputRefusalStats(_hoursBack = 24) {
  return [];
}
