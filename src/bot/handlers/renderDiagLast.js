// src/bot/handlers/renderDiagLast.js
// Handler for /render_diag_last — diagnose latest saved log snapshot from RenderLogInbox.

import RenderLogDiagnosisService from "../../logging/RenderLogDiagnosisService.js";
import renderLogInbox from "../../logging/RenderLogInbox.js";

function buildMetaText(diagnosis, inboxEntry) {
  const fp = diagnosis?.fingerprint || {};
  const corr = diagnosis?.correlation || {};

  const candidatePath = corr?.topCandidate?.path || "не определён";
  const exactLine =
    Number.isFinite(corr?.lineWindow?.exactLine) && corr.lineWindow.exactLine > 0
      ? String(corr.lineWindow.exactLine)
      : "не определена";

  return [
    "",
    "—",
    `source=${diagnosis?.source || inboxEntry?.source || "telegram_saved_snapshot"}`,
    `savedAt=${inboxEntry?.updatedAt || "unknown"}`,
    `kind=${fp?.kind || "unknown"}`,
    `severity=${fp?.severity || "unknown"}`,
    `candidate=${candidatePath}`,
    `line=${exactLine}`,
    `confidence=${corr?.confidence || fp?.confidence || "very_low"}`,
  ].join("\n");
}

async function sendChunked(bot, chatId, text) {
  const MAX = 3500;
  const full = String(text || "");

  if (full.length <= MAX) {
    await bot.sendMessage(chatId, full);
    return;
  }

  const lines = full.split("\n");
  let chunk = "";

  for (const line of lines) {
    const candidate = chunk ? `${chunk}\n${line}` : line;

    if (candidate.length > MAX) {
      if (chunk) {
        await bot.sendMessage(chatId, chunk);
        chunk = line;
      } else {
        await bot.sendMessage(chatId, line.slice(0, MAX - 1) + "…");
        chunk = "";
      }
    } else {
      chunk = candidate;
    }
  }

  if (chunk) {
    await bot.sendMessage(chatId, chunk);
  }
}

export async function handleRenderDiagLast({
  bot,
  chatId,
  senderIdStr,
  bypass,
}) {
  if (!bypass) {
    await bot.sendMessage(chatId, "Эта команда доступна только монарху GARYA.");
    return;
  }

  const inboxEntry = renderLogInbox.getLatest({
    chatId: String(chatId),
    senderIdStr: String(senderIdStr || ""),
  });

  if (!inboxEntry?.logText) {
    await bot.sendMessage(
      chatId,
      [
        "⚠️ Последний log snapshot не найден.",
        "Сначала отправь /render_log_set с логом",
        "или ответь на сообщение с логом и отправь /render_log_set",
      ].join("\n")
    );
    return;
  }

  try {
    const service = new RenderLogDiagnosisService();
    const diagnosis = await service.diagnose(inboxEntry.logText, {
      source: "telegram_saved_snapshot",
    });

    const output = [
      diagnosis.shortText,
      buildMetaText(diagnosis, inboxEntry),
    ].join("\n");

    await sendChunked(bot, chatId, output);
  } catch (error) {
    const message =
      error?.message && typeof error.message === "string"
        ? error.message
        : "unknown_error";

    await bot.sendMessage(
      chatId,
      `⚠️ /render_diag_last failed\nmessage=${message}`
    );
  }
}

export default {
  handleRenderDiagLast,
};