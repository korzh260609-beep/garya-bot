// src/bot/handlers/memoryTopicDigestDiag.js
// STAGE 7.9.4 — topic digest skeleton diagnostic
//
// Purpose:
// - test MemoryService topic digest facade through real runtime
// - verify topic digest remains skeleton/no-storage at this stage
// - verify digest metadata is separated from raw archive and confirmed memory
// - verify digest is not prompt-facing and does not inject raw dialogue into context
//
// IMPORTANT:
// - No DB schema changes.
// - No digest storage activation.
// - No AI digest generation.
// - No prompt injection.

import MemoryService from "../../core/MemoryService.js";

function safeStr(value) {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return "";
  return String(value);
}

function contextContainsNeedle(context, needle) {
  if (!context || !Array.isArray(context.memories)) return false;
  return context.memories.some((item) => safeStr(item?.content).includes(needle));
}

export async function handleMemoryTopicDigestDiag({
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
    await bot.sendMessage(chatId, "⚠️ memory topic digest diag: missing chatId");
    return {
      ok: false,
      reason: "missing_chatId",
    };
  }

  const memoryService = new MemoryService({ logger });
  await memoryService.init();

  const stamp = new Date().toISOString().replace(/[^0-9]/g, "").slice(0, 14);
  const randomPart = Math.random().toString(36).slice(2, 8);
  const needle = `diag_topic_digest_${stamp}_${randomPart}`;
  const topicKey = `diag.topic_digest.${stamp}.${randomPart}`;

  const upsert = await memoryService.upsertTopicDigest({
    chatId: effectiveChatId,
    globalUserId: globalUserId || null,
    topicKey,
    summary: `Controlled topic digest skeleton summary ${needle}`,
    sourceRefs: ["diag:stage-7.9.4"],
    metadata: {
      source: "memory_topic_digest_diag",
      diagnostic: true,
      stage: "7.9.4",
    },
    schemaVersion: 1,
  });

  const selected = await memoryService.selectTopicDigestForRestore({
    chatId: effectiveChatId,
    globalUserId: globalUserId || null,
    topicKey,
    limit: 5,
  });

  const listed = await memoryService.listTopicDigests({
    chatId: effectiveChatId,
    globalUserId: globalUserId || null,
    limit: 5,
  });

  const status = await memoryService.topicDigestStatus();

  const context = await memoryService.context({
    chatId: effectiveChatId,
    globalUserId: globalUserId || null,
    limit: 20,
  });

  const skeletonOk =
    upsert?.ok === true &&
    upsert?.stored === false &&
    upsert?.reason === "topic_digest_skeleton_no_storage" &&
    selected?.ok === true &&
    selected?.total === 0 &&
    selected?.reason === "topic_digest_restore_skeleton_no_storage" &&
    listed?.ok === true &&
    listed?.total === 0 &&
    listed?.reason === "topic_digest_list_skeleton_no_storage";

  const separationOk =
    upsert?.digestLayer === "topic_digest" &&
    upsert?.metadata?.memoryLayer === "topic_digest" &&
    upsert?.confirmedMemory === false &&
    upsert?.archiveMemory === false &&
    upsert?.metadata?.promptFacing === false &&
    upsert?.metadata?.rawPromptInjectionAllowed === false;

  const safetyOk =
    upsert?.promptFacing === false &&
    upsert?.rawPromptInjectionAllowed === false &&
    upsert?.aiGenerationActive === false &&
    upsert?.storageActive === false &&
    status?.promptFacing === false &&
    status?.aiGenerationActive === false &&
    status?.storageActive === false;

  const contextOk =
    context?.enabled === true &&
    contextContainsNeedle(context, needle) === false;

  const validationOk = skeletonOk && separationOk && safetyOk && contextOk;

  const lines = [];
  lines.push("🧪 MEMORY TOPIC DIGEST DIAG");
  lines.push(`validation: ${validationOk ? "OK" : "FAILED"}`);
  lines.push(`chat_id: ${effectiveChatId}`);
  lines.push(`globalUserId: ${globalUserId || "NULL"}`);
  lines.push(`topicKey: ${topicKey}`);
  lines.push(`needle: ${needle}`);
  lines.push("");
  lines.push(
    `1) skeleton: upsertStored=${String(upsert?.stored === true)} selectTotal=${Number(selected?.total || 0)} listTotal=${Number(listed?.total || 0)} check=${String(skeletonOk)}`
  );
  lines.push(
    `2) separation: digestLayer=${upsert?.digestLayer || "-"} metadataLayer=${upsert?.metadata?.memoryLayer || "-"} confirmedMemory=${String(upsert?.confirmedMemory === true)} archiveMemory=${String(upsert?.archiveMemory === true)} check=${String(separationOk)}`
  );
  lines.push(
    `3) safety: storageActive=${String(upsert?.storageActive === true)} aiGenerationActive=${String(upsert?.aiGenerationActive === true)} promptFacing=${String(upsert?.promptFacing === true)} rawPromptInjectionAllowed=${String(upsert?.rawPromptInjectionAllowed === true)} check=${String(safetyOk)}`
  );
  lines.push(
    `4) context: enabled=${String(context?.enabled === true)} containsDigestNeedle=${String(contextContainsNeedle(context, needle))} memories=${Number(context?.memories?.length || 0)} check=${String(contextOk)}`
  );
  lines.push("");
  lines.push(
    `checks: skeleton=${String(skeletonOk)} separation=${String(separationOk)} safety=${String(safetyOk)} context=${String(contextOk)}`
  );

  await bot.sendMessage(chatId, lines.join("\n").slice(0, 3800));

  return {
    ok: validationOk,
    topicKey,
    needle,
    upsert,
    selected: {
      ok: selected?.ok === true,
      total: selected?.total || 0,
      reason: selected?.reason || null,
    },
    listed: {
      ok: listed?.ok === true,
      total: listed?.total || 0,
      reason: listed?.reason || null,
    },
    context: {
      enabled: context?.enabled === true,
      memories: context?.memories?.length || 0,
      containsDigestNeedle: contextContainsNeedle(context, needle),
    },
    checks: {
      skeleton: skeletonOk,
      separation: separationOk,
      safety: safetyOk,
      context: contextOk,
    },
  };
}

export default {
  handleMemoryTopicDigestDiag,
};
