// src/bot/handlers/pmReadSurfaceDiag.js
// ============================================================================
// PROJECT MEMORY READ SURFACE DIAGNOSTIC
// Purpose:
// - verify read-only Project Memory command surface
// - cover /pm_list, /pm_latest, /pm_digest without writing to project_memory
// - keep diagnostic logic out of dispatcher
// ============================================================================

import { handlePmList } from "./pmList.js";
import { handlePmLatest } from "./pmLatest.js";
import { handlePmDigest } from "./pmDigest.js";

const PM_READ_SURFACE_DIAG_BUILD = "pm-read-surface-diag-2026-04-26-01";

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

async function runCaptured({ name, chatId, run }) {
  const captureBot = makeCaptureBot();

  try {
    await run(captureBot);
    const outputText = captureBot.messages.map((item) => item.text).join("\n---\n");

    return {
      name,
      ok: captureBot.messages.length > 0 && !outputText.includes("⚠️ Ошибка"),
      messages: captureBot.messages.length,
      outputText,
      error: null,
    };
  } catch (error) {
    return {
      name,
      ok: false,
      messages: captureBot.messages.length,
      outputText: captureBot.messages.map((item) => item.text).join("\n---\n"),
      error: error?.message || "unknown_error",
    };
  }
}

export async function handlePmReadSurfaceDiag({
  bot,
  chatId,
  globalUserId = null,
  getProjectMemoryList,
} = {}) {
  const hasListReader = typeof getProjectMemoryList === "function";

  const diag = {
    command: "/pm_surface_diag",
    build: PM_READ_SURFACE_DIAG_BUILD,
    readOnly: true,
    dbWrites: false,
    hasListReader,
    checks: [],
    error: null,
  };

  try {
    if (!hasListReader) {
      diag.error = "getProjectMemoryList_missing";
    } else {
      diag.checks.push(await runCaptured({
        name: "/pm_list",
        chatId,
        run: (captureBot) => handlePmList({
          bot: captureBot,
          chatId,
          rest: "",
          getProjectMemoryList,
        }),
      }));

      diag.checks.push(await runCaptured({
        name: "/pm_latest",
        chatId,
        run: (captureBot) => handlePmLatest({
          bot: captureBot,
          chatId,
          rest: "",
          globalUserId,
          getProjectMemoryList,
        }),
      }));

      diag.checks.push(await runCaptured({
        name: "/pm_digest",
        chatId,
        run: (captureBot) => handlePmDigest({
          bot: captureBot,
          chatId,
          rest: "3",
          globalUserId,
          getProjectMemoryList,
        }),
      }));
    }
  } catch (error) {
    diag.error = error?.message || "unknown_error";
  }

  const ok =
    diag.readOnly === true &&
    diag.dbWrites === false &&
    diag.hasListReader === true &&
    diag.checks.length === 3 &&
    diag.checks.every((item) => item.ok === true) &&
    !diag.error;

  try {
    console.log("🧠 PROJECT_MEMORY_READ_SURFACE_DIAG", {
      ...diag,
      checks: diag.checks.map((item) => ({
        name: item.name,
        ok: item.ok,
        messages: item.messages,
        error: item.error,
      })),
    });
  } catch (_) {}

  const lines = [
    "🧠 Project Memory read surface diag",
    "",
    `build: ${diag.build}`,
    `command: ${diag.command}`,
    "",
    `readOnly: ${diag.readOnly ? "yes" : "no"}`,
    `dbWrites: ${diag.dbWrites ? "yes" : "no"}`,
    `getProjectMemoryList: ${diag.hasListReader ? "OK" : "MISSING"}`,
    "",
    "Checks:",
    ...diag.checks.map((item) =>
      `- ${item.name}: ${item.ok ? "OK" : "FAILED"} messages=${item.messages}${item.error ? ` error=${item.error}` : ""}`
    ),
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

export default handlePmReadSurfaceDiag;
