// src/bot/handlers/renderDiag.js
// Handler for /render_diag — diagnose pasted log text via RenderLogDiagnosisService.
// Purpose:
// - give monarch a simple Telegram entrypoint
// - avoid HTTP clients / debug route for basic verification
// - support BOTH:
//   1) /render_diag <inline log text>
//   2) reply to a message containing log text, then send /render_diag

import RenderLogDiagnosisService from "../../logging/RenderLogDiagnosisService.js";

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function extractReplyText(msg) {
  const reply = msg?.reply_to_message;
  if (!reply || typeof reply !== "object") return "";

  const text = normalizeString(reply.text);
  if (text) return text;

  const caption = normalizeString(reply.caption);
  if (caption) return caption;

  return "";
}

function extractInlineLog(rest) {
  return typeof rest === "string" ? rest.trim() : "";
}

function buildUsageText() {
  return [
    "Использование /render_diag:",
    "1) /render_diag <вставь лог после команды>",
    "2) ответь на сообщение с логом и отправь /render_diag",
    "",
    "Пример:",
    "/render_diag SyntaxError: Missing catch or finally after try",
  ].join("\n");
}

function buildMetaText(diagnosis) {
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
    `source=${diagnosis?.source || "telegram_command"}`,
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

export async function handleRenderDiag({
  bot,
  chatId,
  rest,
  bypass,
  msg,
}) {
  if (!bypass) {
    await bot.sendMessage(chatId, "Эта команда доступна только монарху GARYA.");
    return;
  }

  const inlineLog = extractInlineLog(rest);
  const replyLog = extractReplyText(msg);
  const logText = inlineLog || replyLog;

  if (!logText) {
    await bot.sendMessage(chatId, buildUsageText());
    return;
  }

  try {
    const service = new RenderLogDiagnosisService();
    const diagnosis = await service.diagnose(logText, {
      source: "telegram_command",
    });

    const output = [
      diagnosis.shortText,
      buildMetaText(diagnosis),
    ].join("\n");

    await sendChunked(bot, chatId, output);
  } catch (error) {
    const message =
      error?.message && typeof error.message === "string"
        ? error.message
        : "unknown_error";

    await bot.sendMessage(
      chatId,
      `⚠️ /render_diag failed\nmessage=${message}`
    );
  }
}

export default {
  handleRenderDiag,
};