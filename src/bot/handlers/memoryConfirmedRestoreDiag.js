// src/bot/handlers/memoryConfirmedRestoreDiag.js
// STAGE 7.9.3 — controlled confirmed memory restore diagnostic
//
// Purpose:
// - test MemoryConfirmedRestoreService skeleton through real MemoryService facade
// - verify bounded structured confirmed-memory restore package
// - verify empty selector is blocked
// - verify raw archive / topic digest are not included
//
// IMPORTANT:
// - This diagnostic writes ONE controlled long-term diagnostic row.
// - No DB schema changes.
// - No direct SQL in this handler.
// - No AI logic.
// - No prompt injection.
// - No production answer behavior change.

import MemoryService from "../../core/MemoryService.js";
import MemoryConfirmedRestoreService from "../../core/memory/MemoryConfirmedRestoreService.js";

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

function hasItemWithKey(result, key) {
  if (!result || !Array.isArray(result.items)) return false;
  return result.items.some((item) => safeStr(item?.key).trim() === key);
}

function hasForbiddenLayers(result) {
  if (!result || !Array.isArray(result.items)) return true;

  return result.items.some((item) => {
    const memoryType = safeStr(item?.memoryType).trim();
    const source = safeStr(item?.source || item?.attribution?.source).trim();
    return (
      memoryType !== "long_term" ||
      source === "raw_dialogue_archive" ||
      source === "topic_digest"
    );
  });
}

export async function handleMemoryConfirmedRestoreDiag({
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
    await bot.sendMessage(chatId, "⚠️ memory confirmed restore diag: missing chatId");
    return {
      ok: false,
      reason: "missing_chatId",
    };
  }

  const memoryService = new MemoryService({ logger });
  await memoryService.init();

  const restoreService = new MemoryConfirmedRestoreService({
    memoryService,
    logger,
    getEnabled: () => true,
    contractVersion: MemoryService.CONTRACT_VERSION,
  });

  const stamp = new Date().toISOString().replace(/[^0-9]/g, "").slice(0, 14);
  const randomPart = Math.random().toString(36).slice(2, 8);
  const key = `diag.memory_confirmed_restore.${stamp}.${randomPart}`;
  const value = `diag_confirmed_restore_value_${stamp}_${randomPart}`;

  const expectedType = "general_fact";
  const expectedDomain = "user_memory";
  const expectedSlot = "generic";

  const baseArgs = {
    chatId: effectiveChatId,
    globalUserId: globalUserId || null,
    transport: "telegram",
    metadata: {
      source: "memory_confirmed_restore_diag",
      diagnostic: true,
      stage: "7.9.3",
      explicit: true,
    },
    schemaVersion: 1,
  };

  const remember = await memoryService.remember({
    ...baseArgs,
    key,
    value,
  });

  const emptySelector = await restoreService.selectConfirmedRestoreContext({
    chatId: effectiveChatId,
    globalUserId: globalUserId || null,
    maxItems: 5,
    maxChars: 500,
    maxItemChars: 120,
    purpose: "diagnostic_empty_selector_check",
  });

  const selected = await restoreService.selectConfirmedRestoreContext({
    chatId: effectiveChatId,
    globalUserId: globalUserId || null,
    rememberKeys: [key],
    rememberTypes: [expectedType],
    rememberDomains: [expectedDomain],
    rememberSlots: [expectedSlot],
    domainSlots: [
      {
        rememberDomain: expectedDomain,
        rememberSlot: expectedSlot,
      },
    ],
    allowedTypes: [expectedType],
    allowedDomains: [expectedDomain],
    maxItems: 5,
    maxChars: 700,
    maxItemChars: 180,
    purpose: "diagnostic_confirmed_restore_check",
  });

  const rememberOk = remember?.ok === true && remember?.stored === true;
  const emptySelectorOk =
    emptySelector?.ok === false &&
    emptySelector?.reason === "empty_restore_selector" &&
    Number(emptySelector?.total || 0) === 0;
  const selectedOk =
    selected?.ok === true &&
    selected?.reason === "confirmed_restore_context_selected" &&
    hasItemWithKey(selected, key) &&
    Number(selected?.total || 0) >= 1;
  const boundedOk =
    Number(selected?.total || 0) <= 5 &&
    Number(selected?.limits?.maxChars || 0) === 700 &&
    Number(selected?.limits?.maxItemChars || 0) === 180;
  const safetyOk =
    selected?.promptFacing === false &&
    selected?.aiLogic === false &&
    selected?.schemaChanges === false &&
    selected?.productionBehaviorChange === false &&
    selected?.rawDialogueIncluded === false &&
    selected?.topicDigestIncluded === false &&
    selected?.archiveIncluded === false &&
    hasForbiddenLayers(selected) === false;

  const validationOk =
    rememberOk && emptySelectorOk && selectedOk && boundedOk && safetyOk;

  const lines = [];
  lines.push("🧪 MEMORY CONFIRMED RESTORE DIAG");
  lines.push(`validation: ${validationOk ? "OK" : "FAILED"}`);
  lines.push(`chat_id: ${effectiveChatId}`);
  lines.push(`globalUserId: ${globalUserId || "NULL"}`);
  lines.push(`key: ${key}`);
  lines.push(`expectedType: ${expectedType}`);
  lines.push(`expectedDomain: ${expectedDomain}`);
  lines.push(`expectedSlot: ${expectedSlot}`);
  lines.push("");
  lines.push(
    `1) remember: ok=${String(remember?.ok === true)} stored=${String(remember?.stored === true)} reason=${remember?.reason || "-"} guard=${remember?.guardDecision || "-"} check=${String(rememberOk)}`
  );
  lines.push(
    `2) emptySelector: ok=${String(emptySelector?.ok === true)} reason=${emptySelector?.reason || "-"} total=${Number(emptySelector?.total || 0)} check=${String(emptySelectorOk)}`
  );
  lines.push(
    `3) selected: ok=${String(selected?.ok === true)} total=${Number(selected?.total || 0)} hasKey=${String(hasItemWithKey(selected, key))} reason=${selected?.reason || "-"} check=${String(selectedOk)}`
  );
  lines.push(
    `4) bounded: maxItems=${Number(selected?.limits?.maxItems || 0)} maxChars=${Number(selected?.limits?.maxChars || 0)} maxItemChars=${Number(selected?.limits?.maxItemChars || 0)} check=${String(boundedOk)}`
  );
  lines.push(
    `5) safety: promptFacing=${String(selected?.promptFacing === true)} raw=${String(selected?.rawDialogueIncluded === true)} digest=${String(selected?.topicDigestIncluded === true)} archive=${String(selected?.archiveIncluded === true)} forbiddenLayers=${String(hasForbiddenLayers(selected))} check=${String(safetyOk)}`
  );
  lines.push("");
  lines.push(
    `checks: remember=${String(rememberOk)} emptySelector=${String(emptySelectorOk)} selected=${String(selectedOk)} bounded=${String(boundedOk)} safety=${String(safetyOk)}`
  );

  if (!validationOk) {
    lines.push("");
    lines.push("debug:");
    lines.push(`remember=${shortJson({ reason: remember?.reason, guardDecision: remember?.guardDecision })}`);
    lines.push(`emptySelector=${shortJson({ ok: emptySelector?.ok, reason: emptySelector?.reason, total: emptySelector?.total })}`);
    lines.push(`selected=${shortJson({ ok: selected?.ok, reason: selected?.reason, total: selected?.total, warnings: selected?.warnings })}`);
  }

  await bot.sendMessage(chatId, lines.join("\n").slice(0, 3800));

  return {
    ok: validationOk,
    key,
    remember,
    emptySelector,
    selected,
    checks: {
      remember: rememberOk,
      emptySelector: emptySelectorOk,
      selected: selectedOk,
      bounded: boundedOk,
      safety: safetyOk,
    },
  };
}

export default {
  handleMemoryConfirmedRestoreDiag,
};
