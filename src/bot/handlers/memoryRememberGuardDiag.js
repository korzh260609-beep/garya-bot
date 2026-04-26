// src/bot/handlers/memoryRememberGuardDiag.js
// STAGE 7.9.1 — confirmed facts write path diagnostic
//
// Purpose:
// - test MemoryService.remember() runtime guard path through the real service facade
// - verify new fact write, duplicate NOOP, and conflict BLOCK behavior
// - keep handler thin and service-based
//
// IMPORTANT:
// - This diagnostic writes ONE controlled long-term diagnostic row.
// - No DB schema changes.
// - No direct SQL in this handler.
// - No archive/digest runtime changes.

import MemoryService from "../../core/MemoryService.js";

function safeStr(value) {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return "";
  return String(value);
}

function shortJson(value) {
  try {
    return JSON.stringify(value || {});
  } catch (_) {
    return "{}";
  }
}

function formatResultLine(label, result) {
  return [
    `${label}:`,
    `ok=${String(result?.ok === true)}`,
    `stored=${String(result?.stored === true)}`,
    `reason=${result?.reason || "-"}`,
    `guard=${result?.guardDecision || "-"}`,
  ].join(" ");
}

export async function handleMemoryRememberGuardDiag({
  bot,
  chatId,
  chatIdStr = null,
  globalUserId = null,
  logger = console,
} = {}) {
  const effectiveChatId = safeStr(chatIdStr || chatId).trim();

  if (!bot || !chatId) {
    return {
      ok: false,
      reason: "missing_bot_or_chatId",
    };
  }

  if (!effectiveChatId) {
    await bot.sendMessage(chatId, "⚠️ memory remember guard diag: missing chatId");
    return {
      ok: false,
      reason: "missing_chatId",
    };
  }

  const memoryService = new MemoryService({ logger });
  await memoryService.init();

  const stamp = new Date().toISOString().replace(/[^0-9]/g, "").slice(0, 14);
  const randomPart = Math.random().toString(36).slice(2, 8);
  const key = `diag.memory_remember_guard.${stamp}.${randomPart}`;
  const value = `diag_value_${stamp}_${randomPart}`;
  const conflictValue = `diag_conflict_${stamp}_${randomPart}`;

  const baseArgs = {
    chatId: effectiveChatId,
    globalUserId: globalUserId || null,
    transport: "telegram",
    metadata: {
      source: "memory_remember_guard_diag",
      diagnostic: true,
      stage: "7.9.1",
      explicit: true,
    },
    schemaVersion: 1,
  };

  const first = await memoryService.remember({
    ...baseArgs,
    key,
    value,
  });

  const duplicate = await memoryService.remember({
    ...baseArgs,
    key,
    value,
  });

  const conflict = await memoryService.remember({
    ...baseArgs,
    key,
    value: conflictValue,
  });

  const fetch = await memoryService.getLongTermByKey({
    chatId: effectiveChatId,
    globalUserId: globalUserId || null,
    rememberKey: key,
    limit: 5,
  });

  const firstOk = first?.ok === true && first?.stored === true;
  const duplicateOk =
    duplicate?.ok === true &&
    duplicate?.stored === false &&
    duplicate?.reason === "duplicate_confirmed_memory_noop";
  const conflictOk =
    conflict?.ok === false &&
    conflict?.stored === false &&
    conflict?.reason === "confirmed_memory_guard_blocked";
  const fetchOk = fetch?.ok === true && Number(fetch?.total || 0) === 1;

  const validationOk = firstOk && duplicateOk && conflictOk && fetchOk;

  const lines = [];
  lines.push("🧪 MEMORY REMEMBER GUARD DIAG");
  lines.push(`validation: ${validationOk ? "OK" : "FAILED"}`);
  lines.push(`chat_id: ${effectiveChatId}`);
  lines.push(`globalUserId: ${globalUserId || "NULL"}`);
  lines.push(`key: ${key}`);
  lines.push("");
  lines.push(formatResultLine("1) new", first));
  lines.push(formatResultLine("2) duplicate", duplicate));
  lines.push(formatResultLine("3) conflict", conflict));
  lines.push(
    `4) fetch: ok=${String(fetch?.ok === true)} total=${Number(fetch?.total || 0)} reason=${fetch?.reason || "-"}`
  );
  lines.push("");
  lines.push(`checks: new=${String(firstOk)} duplicate=${String(duplicateOk)} conflict=${String(conflictOk)} fetch=${String(fetchOk)}`);

  if (!validationOk) {
    lines.push("");
    lines.push("debug:");
    lines.push(`first=${shortJson({ reason: first?.reason, guardDecision: first?.guardDecision, guardErrors: first?.guardErrors })}`);
    lines.push(`duplicate=${shortJson({ reason: duplicate?.reason, guardDecision: duplicate?.guardDecision, guardErrors: duplicate?.guardErrors })}`);
    lines.push(`conflict=${shortJson({ reason: conflict?.reason, guardDecision: conflict?.guardDecision, guardErrors: conflict?.guardErrors })}`);
    lines.push(`fetch=${shortJson({ reason: fetch?.reason, error: fetch?.error, total: fetch?.total })}`);
  }

  await bot.sendMessage(chatId, lines.join("\n").slice(0, 3800));

  return {
    ok: validationOk,
    key,
    first,
    duplicate,
    conflict,
    fetch,
  };
}

export default {
  handleMemoryRememberGuardDiag,
};
