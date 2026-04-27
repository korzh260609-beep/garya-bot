// src/bot/handlers/pmSessionsDiag.js
// ============================================================================
// PROJECT MEMORY SESSIONS READ DIAGNOSTIC
// Purpose:
// - verify /pm_sessions and /pm_session_show read-only behavior
// - read existing work_sessions without writing to project_memory
// - keep diagnostic logic out of dispatcher
// ============================================================================

import {
  handlePmSessions,
  handlePmSessionShow,
} from "./pmSessions.js";

const PM_SESSIONS_DIAG_BUILD = "pm-sessions-diag-2026-04-27-01";

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

function firstSessionId(rows = []) {
  const sessions = Array.isArray(rows)
    ? rows.filter((row) => String(row?.entry_type || "") === "session_summary")
    : [];

  const first = sessions.find((row) => Number.isInteger(Number(row?.id)));
  return first ? Number(first.id) : null;
}

export async function handlePmSessionsDiag({
  bot,
  chatId,
  globalUserId = null,
  getProjectMemoryList,
} = {}) {
  const hasListReader = typeof getProjectMemoryList === "function";

  const diag = {
    command: "/pm_sessions_diag",
    build: PM_SESSIONS_DIAG_BUILD,
    readOnly: true,
    dbWrites: false,
    hasListReader,
    sessionsTotal: 0,
    selectedSessionId: null,
    pmSessionsOk: false,
    pmSessionShowOk: false,
    messages: 0,
    outputHasSessionsHeader: false,
    outputHasSessionShowHeader: false,
    outputHasError: false,
    error: null,
  };

  try {
    if (!hasListReader) {
      diag.error = "getProjectMemoryList_missing";
    } else {
      const rows = await getProjectMemoryList(undefined, "work_sessions");
      const sessions = Array.isArray(rows)
        ? rows.filter((row) => String(row?.entry_type || "") === "session_summary")
        : [];

      diag.sessionsTotal = sessions.length;
      diag.selectedSessionId = firstSessionId(rows);

      const captureBot = makeCaptureBot();

      await handlePmSessions({
        bot: captureBot,
        chatId,
        rest: "list 3",
        globalUserId,
        getProjectMemoryList,
      });

      if (diag.selectedSessionId !== null) {
        await handlePmSessionShow({
          bot: captureBot,
          chatId,
          rest: String(diag.selectedSessionId),
          globalUserId,
          getProjectMemoryList,
        });
      }

      const outputText = captureBot.messages.map((item) => item.text).join("\n---\n");

      diag.messages = captureBot.messages.length;
      diag.outputHasSessionsHeader =
        outputText.includes("Work sessions") ||
        outputText.includes("записей пока нет");
      diag.outputHasSessionShowHeader =
        diag.selectedSessionId === null ||
        outputText.includes("Project Memory: work_session") ||
        outputText.includes("🧠 Work session");
      diag.outputHasError = outputText.includes("⚠️ Ошибка");
      diag.pmSessionsOk = diag.messages > 0 && diag.outputHasSessionsHeader && !diag.outputHasError;
      diag.pmSessionShowOk = diag.outputHasSessionShowHeader && !diag.outputHasError;
      diag.outputChars = outputText.length;
    }
  } catch (error) {
    diag.error = error?.message || "unknown_error";
  }

  const ok =
    diag.readOnly === true &&
    diag.dbWrites === false &&
    diag.hasListReader === true &&
    diag.pmSessionsOk === true &&
    diag.pmSessionShowOk === true &&
    !diag.error;

  try {
    console.log("🧠 PROJECT_MEMORY_SESSIONS_DIAG", diag);
  } catch (_) {}

  const lines = [
    "🧠 Project Memory sessions diag",
    "",
    `build: ${diag.build}`,
    `command: ${diag.command}`,
    "",
    `readOnly: ${diag.readOnly ? "yes" : "no"}`,
    `dbWrites: ${diag.dbWrites ? "yes" : "no"}`,
    `getProjectMemoryList: ${diag.hasListReader ? "OK" : "MISSING"}`,
    "",
    `sessionsTotal: ${diag.sessionsTotal}`,
    `selectedSessionId: ${diag.selectedSessionId ?? "-"}`,
    "",
    `/pm_sessions: ${diag.pmSessionsOk ? "OK" : "FAILED"}`,
    `/pm_session_show: ${diag.pmSessionShowOk ? "OK" : "FAILED"}`,
    `messages: ${diag.messages}`,
    `outputHasSessionsHeader: ${diag.outputHasSessionsHeader ? "yes" : "no"}`,
    `outputHasSessionShowHeader: ${diag.outputHasSessionShowHeader ? "yes" : "no"}`,
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

export default handlePmSessionsDiag;
