// src/bot/handlers/memoryRestoreBeforeAnswerDiag.js
// STAGE 7.9.5 — restore current user/project context before AI answer diagnostic
//
// Purpose:
// - verify controlled long-term memory restore is prepared before AI answer
// - verify restored context is bounded and becomes a system message only through safe bridge
// - verify raw archive and topic digest are not restored into the AI prompt path
// - verify this diagnostic does not use raw dialogue, AI generation, or schema changes
//
// IMPORTANT:
// - This diagnostic uses an isolated diagnostic chat id to avoid touching real user context.
// - It writes one confirmed long-term memory row through MemoryService.remember().
// - It may write one bounded raw archive row only to prove it is not injected.
// - It does not call AI.
// - It does not change production prompt behavior.

import MemoryService from "../../core/MemoryService.js";
import buildLongTermMemoryPromptBridge from "../../core/buildLongTermMemoryPromptBridge.js";

function safeStr(value) {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return "";
  return String(value);
}

function includesText(value, needle) {
  return safeStr(value).includes(safeStr(needle));
}

function hasForbiddenMemoryLayer(items = []) {
  if (!Array.isArray(items)) return true;

  return items.some((item) => {
    const metadata = item?.metadata && typeof item.metadata === "object" ? item.metadata : {};
    const memoryType = safeStr(item?.memoryType || metadata?.memoryType).trim();
    const memoryLayer = safeStr(metadata?.memoryLayer).trim();
    const source = safeStr(item?.source || metadata?.source).trim();

    return (
      memoryType !== "long_term" ||
      memoryLayer === "raw_dialogue_archive" ||
      memoryLayer === "topic_digest" ||
      source === "raw_dialogue_archive" ||
      source === "topic_digest"
    );
  });
}

export async function handleMemoryRestoreBeforeAnswerDiag({
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
    await bot.sendMessage(chatId, "⚠️ memory restore before answer diag: missing chatId");
    return {
      ok: false,
      reason: "missing_chatId",
    };
  }

  const memoryService = new MemoryService({ logger });
  await memoryService.init();

  const stamp = new Date().toISOString().replace(/[^0-9]/g, "").slice(0, 14);
  const randomPart = Math.random().toString(36).slice(2, 8);
  const isolatedChatId = `${effectiveChatId}:restore_before_answer:${stamp}:${randomPart}`;
  const confirmedNeedle = `diag_restore_confirmed_${stamp}_${randomPart}`;
  const archiveNeedle = `diag_restore_archive_${stamp}_${randomPart}`;
  const digestNeedle = `diag_restore_digest_${stamp}_${randomPart}`;

  const remember = await memoryService.remember({
    chatId: isolatedChatId,
    globalUserId: globalUserId || null,
    key: "task_schedule",
    value: confirmedNeedle,
    transport: "telegram",
    metadata: {
      source: "memory_restore_before_answer_diag",
      diagnostic: true,
      stage: "7.9.5",
      explicit: true,
    },
    schemaVersion: 1,
  });

  const archive = await memoryService.archiveMessage({
    chatId: isolatedChatId,
    globalUserId: globalUserId || null,
    role: "user",
    content: archiveNeedle,
    transport: "telegram",
    metadata: {
      source: "memory_restore_before_answer_diag",
      diagnostic: true,
      stage: "7.9.5",
    },
    schemaVersion: 1,
    maxChars: 120,
  });

  const digest = await memoryService.upsertTopicDigest({
    chatId: isolatedChatId,
    globalUserId: globalUserId || null,
    topicKey: `diag.restore_before_answer.${stamp}.${randomPart}`,
    summary: digestNeedle,
    sourceRefs: ["diag:stage-7.9.5"],
    metadata: {
      source: "memory_restore_before_answer_diag",
      diagnostic: true,
      stage: "7.9.5",
    },
    schemaVersion: 1,
  });

  const bridge = await buildLongTermMemoryPromptBridge({
    chatId: isolatedChatId,
    globalUserId: globalUserId || null,
    rememberTypes: ["task_intent"],
    rememberKeys: ["task_schedule"],
    rememberDomains: ["task"],
    rememberSlots: ["schedule"],
    domainSlots: [
      {
        rememberDomain: "task",
        rememberSlot: "schedule",
      },
    ],
    perTypeLimit: 1,
    perKeyLimit: 1,
    perDomainLimit: 1,
    perSlotLimit: 1,
    perDomainSlotLimit: 1,
    totalLimit: 1,
    header: "LONG_TERM_MEMORY",
    maxItems: 1,
    maxValueLength: 120,
    memoryService,
  });

  const systemMessage = bridge?.ok === true && bridge?.block
    ? {
        role: "system",
        content:
          "LONG-TERM MEMORY:\n" +
          "Primary stable memory. Prefer this over recall/history unless user corrects it now.\n\n" +
          `${bridge.block}`,
      }
    : null;

  const restoreOk =
    remember?.ok === true &&
    remember?.stored === true &&
    bridge?.ok === true &&
    bridge?.reason === "memory_prompt_block_built" &&
    Boolean(systemMessage?.content) &&
    includesText(systemMessage?.content, confirmedNeedle);

  const boundedOk =
    Number(bridge?.total || 0) === 1 &&
    Number(bridge?.limits?.totalLimit || 0) === 1 &&
    Number(bridge?.limits?.maxItems || 0) === 1 &&
    Number(bridge?.limits?.maxValueLength || 0) === 120;

  const separationOk =
    hasForbiddenMemoryLayer(bridge?.items || []) === false &&
    includesText(systemMessage?.content, archiveNeedle) === false &&
    includesText(systemMessage?.content, digestNeedle) === false;

  const safetyOk =
    systemMessage?.role === "system" &&
    archive?.promptFacing === false &&
    archive?.rawPromptInjectionAllowed === false &&
    digest?.promptFacing === false &&
    digest?.rawPromptInjectionAllowed === false &&
    digest?.storageActive === false &&
    digest?.aiGenerationActive === false;

  const validationOk = restoreOk && boundedOk && separationOk && safetyOk;

  const lines = [];
  lines.push("🧪 MEMORY RESTORE BEFORE ANSWER DIAG");
  lines.push(`validation: ${validationOk ? "OK" : "FAILED"}`);
  lines.push(`chat_id: ${effectiveChatId}`);
  lines.push(`isolatedChatId: ${isolatedChatId}`);
  lines.push(`globalUserId: ${globalUserId || "NULL"}`);
  lines.push(`confirmedNeedle: ${confirmedNeedle}`);
  lines.push(`archiveNeedle: ${archiveNeedle}`);
  lines.push(`digestNeedle: ${digestNeedle}`);
  lines.push("");
  lines.push(
    `1) restore: rememberStored=${String(remember?.stored === true)} bridgeOk=${String(bridge?.ok === true)} hasSystemMessage=${String(Boolean(systemMessage?.content))} containsConfirmed=${String(includesText(systemMessage?.content, confirmedNeedle))} check=${String(restoreOk)}`
  );
  lines.push(
    `2) bounded: total=${Number(bridge?.total || 0)} totalLimit=${Number(bridge?.limits?.totalLimit || 0)} maxItems=${Number(bridge?.limits?.maxItems || 0)} maxValueLength=${Number(bridge?.limits?.maxValueLength || 0)} check=${String(boundedOk)}`
  );
  lines.push(
    `3) separation: forbiddenLayers=${String(hasForbiddenMemoryLayer(bridge?.items || []))} containsArchive=${String(includesText(systemMessage?.content, archiveNeedle))} containsDigest=${String(includesText(systemMessage?.content, digestNeedle))} check=${String(separationOk)}`
  );
  lines.push(
    `4) safety: systemRole=${systemMessage?.role || "-"} archivePromptFacing=${String(archive?.promptFacing === true)} digestPromptFacing=${String(digest?.promptFacing === true)} digestStorageActive=${String(digest?.storageActive === true)} digestAiGeneration=${String(digest?.aiGenerationActive === true)} check=${String(safetyOk)}`
  );
  lines.push("");
  lines.push(
    `checks: restore=${String(restoreOk)} bounded=${String(boundedOk)} separation=${String(separationOk)} safety=${String(safetyOk)}`
  );

  await bot.sendMessage(chatId, lines.join("\n").slice(0, 3800));

  return {
    ok: validationOk,
    isolatedChatId,
    confirmedNeedle,
    archiveNeedle,
    digestNeedle,
    remember: {
      ok: remember?.ok === true,
      stored: remember?.stored === true,
      reason: remember?.reason || null,
      guardDecision: remember?.guardDecision || null,
    },
    archive: {
      ok: archive?.ok === true,
      stored: archive?.stored === true,
      reason: archive?.reason || null,
    },
    digest: {
      ok: digest?.ok === true,
      stored: digest?.stored === true,
      reason: digest?.reason || null,
    },
    bridge: {
      ok: bridge?.ok === true,
      total: bridge?.total || 0,
      reason: bridge?.reason || null,
    },
    checks: {
      restore: restoreOk,
      bounded: boundedOk,
      separation: separationOk,
      safety: safetyOk,
    },
  };
}

export default {
  handleMemoryRestoreBeforeAnswerDiag,
};
