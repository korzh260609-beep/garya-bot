// AGENT NOTE:
// SG 2.0 Telegram reply helpers.
// Purpose: isolate Telegram delivery calls used by the adapter.
// Do not add AI, core handling, callback parsing, or permission logic here.

import {
  sendTelegramGithubApprovalReply,
  sendTelegramReply,
} from "../../delivery/telegramDelivery.js";

export async function replyTelegram({ bot, context, text, options = {} }) {
  await sendTelegramReply({
    bot,
    context,
    text,
    options,
  });
}

export async function replyTelegramWithGithubApproval({ bot, context, text, approvalId }) {
  await sendTelegramGithubApprovalReply({
    bot,
    context,
    text,
    approvalId,
  });
}

export async function answerTelegramCallback({ bot, callbackQuery, text = "" }) {
  if (!callbackQuery?.id) return;

  try {
    await bot.answerCallbackQuery(callbackQuery.id, {
      text: String(text || ""),
      show_alert: false,
    });
  } catch (error) {
    console.warn("TelegramAdapter callback answer failed:", error?.message || String(error));
  }
}
