// AGENT NOTE:
// SG 2.0 Telegram callback_query event handler.
// Purpose: isolate Telegram callback event flow from adapter attachment.
// Do not add GitHub approval policy, AI calls, source/task logic, or billing here.

import { handleGithubApprovalCallback } from "../../core/githubApprovalHandler.js";
import { toTelegramCallbackContext } from "./telegramContext.js";
import { answerTelegramCallback, replyTelegram } from "./telegramReplies.js";

export async function handleTelegramCallbackQuery({ bot, callbackQuery }) {
  const context = toTelegramCallbackContext(callbackQuery);

  try {
    const result = await handleGithubApprovalCallback(context, callbackQuery?.data || "");

    if (!result?.handled) {
      await answerTelegramCallback({ bot, callbackQuery, text: "Неизвестное действие." });
      return;
    }

    await answerTelegramCallback({ bot, callbackQuery, text: result.ok ? "Готово" : "Ошибка" });
    await replyTelegram({
      bot,
      context,
      text: result?.reply || "GitHub-действие обработано.",
    });
  } catch (error) {
    console.error("TelegramAdapter callback handling failed:", error?.message || String(error));
    await answerTelegramCallback({ bot, callbackQuery, text: "Ошибка" });
    await replyTelegram({
      bot,
      context,
      text: "Я не смог обработать кнопку. Нужно проверить внутреннее состояние SG.",
    });
  }
}
