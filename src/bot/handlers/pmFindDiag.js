// src/bot/handlers/pmFindDiag.js
// ============================================================================
// PROJECT MEMORY FIND DIAGNOSTIC
// Purpose:
// - verify /pm_find read-only search behavior
// - search existing work_sessions without writing to project_memory
// - keep diagnostic logic out of dispatcher
// ============================================================================

import { handlePmFind } from "./pmFind.js";

const PM_FIND_DIAG_BUILD = "pm-find-diag-2026-04-26-01";
const DEFAULT_FIND_QUERY = "Runtime";

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function makeCaptureBot() {
  const messages = [];

  return {
    messages,
    async sendMessage(chatId, text, options = {}) {
      messages.push({
        chatId,
        text: String(text ?? ""),
        options,
      });
      return {
        ok: true,
        message_id: messages.length,
        chat: { id: chatId },
        text: String(text ?? ""),
      };
    },
  };
}

export async function handlePmFindDiag({
  bot,
  chatId,
  rest = "",
  globalUserId = null,
  getProjectMemoryList,
} = {}) {
  const query = normalizeString(rest) || DEFAULT_FIND_QUERY;
  const hasListReader = typeof getProjectMemoryList === "function";

  const diag = {
    command: "/pm_find_diag",
    build: PM_FIND_DIAG_BUILD,
    query,
    readOnly: true,
    dbWrites: false,
    hasListReader,
    handlerOk: false,
    messages: 0,
    outputHasFindHeader: false,
    outputHasError: false,
    error: null,
  };

  try {
    if (!hasListReader) {
      diag.error = "getProjectMemoryList_missing";
    } else {
      const captureBot = makeCaptureBot();

      await handlePmFind({
        bot: captureBot,
        chatId,
        rest: query,
        globalUserId,
        getProjectMemoryList,
      });

      const outputText = captureBot.messages.map((item) => item.text).join("\n---\n");

      diag.messages = captureBot.messages.length;
      diag.outputHasFindHeader = outputText.includes("Project Memory find");
      diag.outputHasError = outputText.includes("⚠️ Ошибка");
      diag.handlerOk = diag.messages > 0 && diag.outputHasFindHeader && !diag.outputHasError;
      diag.outputChars = outputText.length;
    }
  } catch (error) {
    diag.error = error?.message || "unknown_error";
  }

  const ok =
    diag.readOnly === true &&
    diag.dbWrites === false &&
    diag.hasListReader === true &&
    diag.handlerOk === true &&
    !diag.error;

  try {
    console.log("🧠 PROJECT_MEMORY_FIND_DIAG", diag);
  } catch (_) {}

  const lines = [
    "🧠 Project Memory find diag",
    "",
    `build: ${diag.build}`,
    `command: ${diag.command}`,
    `query: ${diag.query}`,
    "",
    `readOnly: ${diag.readOnly ? "yes" : "no"}`,
    `dbWrites: ${diag.dbWrites ? "yes" : "no"}`,
    `getProjectMemoryList: ${diag.hasListReader ? "OK" : "MISSING"}`,
    "",
    `handlerOk: ${diag.handlerOk ? "yes" : "no"}`,
    `messages: ${diag.messages}`,
    `outputHasFindHeader: ${diag.outputHasFindHeader ? "yes" : "no"}`,
    `outputHasError: ${diag.outputHasError ? "yes" : "no"}`,
    `outputChars: ${diag.outputChars || 0}`,
    "",
    `Result: ${ok ? "OK" : "FAILED"}`,
  ];

  if (diag.error) {
    lines.push(`error: ${diag.error}`);
  }

  await bot.sendMessage(chatId, lines.join("\n"));

  return {
    ok,
    diag,
  };
}

export default handlePmFindDiag;
