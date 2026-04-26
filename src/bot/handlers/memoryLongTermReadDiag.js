// src/bot/handlers/memoryLongTermReadDiag.js
// STAGE 7.9.2 — confirmed memory read path diagnostic
//
// Purpose:
// - test confirmed long-term memory read path through MemoryService facade
// - verify by key, type, domain, slot, domain+slot, summary, and selector context
// - keep handler thin and service-based
//
// IMPORTANT:
// - This diagnostic writes ONE controlled long-term diagnostic row.
// - No DB schema changes.
// - No direct SQL in this handler.
// - No AI logic.
// - No prompt injection.

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

function hasItemWithKey(result, key) {
  if (!result || !Array.isArray(result.items)) return false;
  return result.items.some((item) => safeStr(item?.rememberKey).trim() === key);
}

function summaryHasDomain(summary, domain) {
  if (!summary || !Array.isArray(summary.byDomain)) return false;
  return summary.byDomain.some(
    (item) => safeStr(item?.remember_domain).trim() === domain
  );
}

function summaryHasDomainSlot(summary, domain, slot) {
  if (!summary || !Array.isArray(summary.byDomainSlot)) return false;
  return summary.byDomainSlot.some(
    (item) =>
      safeStr(item?.remember_domain).trim() === domain &&
      safeStr(item?.remember_slot).trim() === slot
  );
}

function formatReadLine(label, result, key, ok) {
  return [
    `${label}:`,
    `ok=${String(result?.ok === true)}`,
    `total=${Number(result?.total || 0)}`,
    `hasKey=${String(hasItemWithKey(result, key))}`,
    `check=${String(ok)}`,
    `reason=${result?.reason || "-"}`,
  ].join(" ");
}

export async function handleMemoryLongTermReadDiag({
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
    await bot.sendMessage(chatId, "⚠️ memory long-term read diag: missing chatId");
    return {
      ok: false,
      reason: "missing_chatId",
    };
  }

  const memoryService = new MemoryService({ logger });
  await memoryService.init();

  const stamp = new Date().toISOString().replace(/[^0-9]/g, "").slice(0, 14);
  const randomPart = Math.random().toString(36).slice(2, 8);
  const key = `diag.memory_long_term_read.${stamp}.${randomPart}`;
  const value = `diag_long_term_read_value_${stamp}_${randomPart}`;

  const expectedType = "general_fact";
  const expectedDomain = "user_memory";
  const expectedSlot = "generic";

  const baseArgs = {
    chatId: effectiveChatId,
    globalUserId: globalUserId || null,
    transport: "telegram",
    metadata: {
      source: "memory_long_term_read_diag",
      diagnostic: true,
      stage: "7.9.2",
      explicit: true,
    },
    schemaVersion: 1,
  };

  const remember = await memoryService.remember({
    ...baseArgs,
    key,
    value,
  });

  const byKey = await memoryService.getLongTermByKey({
    chatId: effectiveChatId,
    globalUserId: globalUserId || null,
    rememberKey: key,
    limit: 5,
  });

  const byType = await memoryService.getLongTermByType({
    chatId: effectiveChatId,
    globalUserId: globalUserId || null,
    rememberType: expectedType,
    limit: 20,
  });

  const byDomain = await memoryService.getLongTermByDomain({
    chatId: effectiveChatId,
    globalUserId: globalUserId || null,
    rememberDomain: expectedDomain,
    limit: 20,
  });

  const bySlot = await memoryService.getLongTermBySlot({
    chatId: effectiveChatId,
    globalUserId: globalUserId || null,
    rememberSlot: expectedSlot,
    limit: 20,
  });

  const byDomainSlot = await memoryService.getLongTermByDomainSlot({
    chatId: effectiveChatId,
    globalUserId: globalUserId || null,
    rememberDomain: expectedDomain,
    rememberSlot: expectedSlot,
    limit: 20,
  });

  const summary = await memoryService.getLongTermSummary({
    chatId: effectiveChatId,
    globalUserId: globalUserId || null,
    limit: 100,
  });

  const selected = await memoryService.selectLongTermContext({
    chatId: effectiveChatId,
    globalUserId: globalUserId || null,
    rememberTypes: [expectedType],
    rememberKeys: [key],
    rememberDomains: [expectedDomain],
    rememberSlots: [expectedSlot],
    domainSlots: [
      {
        rememberDomain: expectedDomain,
        rememberSlot: expectedSlot,
      },
    ],
    perTypeLimit: 20,
    perKeyLimit: 5,
    perDomainLimit: 20,
    perSlotLimit: 20,
    perDomainSlotLimit: 20,
    totalLimit: 30,
  });

  const rememberOk = remember?.ok === true && remember?.stored === true;
  const byKeyOk = byKey?.ok === true && Number(byKey?.total || 0) === 1 && hasItemWithKey(byKey, key);
  const byTypeOk = byType?.ok === true && hasItemWithKey(byType, key);
  const byDomainOk = byDomain?.ok === true && hasItemWithKey(byDomain, key);
  const bySlotOk = bySlot?.ok === true && hasItemWithKey(bySlot, key);
  const byDomainSlotOk = byDomainSlot?.ok === true && hasItemWithKey(byDomainSlot, key);
  const summaryOk =
    summary?.ok === true &&
    summaryHasDomain(summary, expectedDomain) &&
    summaryHasDomainSlot(summary, expectedDomain, expectedSlot);
  const selectedOk = selected?.ok === true && hasItemWithKey(selected, key);

  const validationOk =
    rememberOk &&
    byKeyOk &&
    byTypeOk &&
    byDomainOk &&
    bySlotOk &&
    byDomainSlotOk &&
    summaryOk &&
    selectedOk;

  const lines = [];
  lines.push("🧪 MEMORY LONG-TERM READ DIAG");
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
  lines.push(formatReadLine("2) byKey", byKey, key, byKeyOk));
  lines.push(formatReadLine("3) byType", byType, key, byTypeOk));
  lines.push(formatReadLine("4) byDomain", byDomain, key, byDomainOk));
  lines.push(formatReadLine("5) bySlot", bySlot, key, bySlotOk));
  lines.push(formatReadLine("6) byDomainSlot", byDomainSlot, key, byDomainSlotOk));
  lines.push(
    `7) summary: ok=${String(summary?.ok === true)} hasDomain=${String(summaryHasDomain(summary, expectedDomain))} hasDomainSlot=${String(summaryHasDomainSlot(summary, expectedDomain, expectedSlot))} check=${String(summaryOk)} reason=${summary?.reason || "-"}`
  );
  lines.push(formatReadLine("8) selectLongTermContext", selected, key, selectedOk));
  lines.push("");
  lines.push(
    `checks: remember=${String(rememberOk)} byKey=${String(byKeyOk)} byType=${String(byTypeOk)} byDomain=${String(byDomainOk)} bySlot=${String(bySlotOk)} byDomainSlot=${String(byDomainSlotOk)} summary=${String(summaryOk)} selected=${String(selectedOk)}`
  );

  if (!validationOk) {
    lines.push("");
    lines.push("debug:");
    lines.push(`remember=${shortJson({ reason: remember?.reason, guardDecision: remember?.guardDecision })}`);
    lines.push(`byKey=${shortJson({ reason: byKey?.reason, total: byKey?.total })}`);
    lines.push(`byType=${shortJson({ reason: byType?.reason, total: byType?.total })}`);
    lines.push(`byDomain=${shortJson({ reason: byDomain?.reason, total: byDomain?.total })}`);
    lines.push(`bySlot=${shortJson({ reason: bySlot?.reason, total: bySlot?.total })}`);
    lines.push(`byDomainSlot=${shortJson({ reason: byDomainSlot?.reason, total: byDomainSlot?.total })}`);
    lines.push(`summary=${shortJson({ reason: summary?.reason })}`);
    lines.push(`selected=${shortJson({ reason: selected?.reason, total: selected?.total })}`);
  }

  await bot.sendMessage(chatId, lines.join("\n").slice(0, 3800));

  return {
    ok: validationOk,
    key,
    remember,
    byKey,
    byType,
    byDomain,
    bySlot,
    byDomainSlot,
    summary,
    selected,
  };
}

export default {
  handleMemoryLongTermReadDiag,
};
