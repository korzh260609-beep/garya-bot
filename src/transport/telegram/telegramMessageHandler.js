// AGENT NOTE:
// SG 2.0 Telegram message event handler.
// Purpose: isolate Telegram message event flow from adapter attachment.
// Do not add AI internals, source/task logic, billing, or permission policy here.

import { handleMessage } from "../../core/handleMessage.js";
import { toTelegramMessageContext } from "./telegramContext.js";
import {
  replyTelegram,
  replyTelegramWithGithubApproval,
} from "./telegramReplies.js";

export async function handleTelegramMessage({ bot, message }) {
  const context = toTelegramMessageContext(message);

  try {
    const result = await handleMessage(context);

    if (result?.githubApproval?.approvalId) {
      await replyTelegramWithGithubApproval({
        bot,
        context,
        text: result?.reply || "Подтверждение GitHub-действия требуется.",
        approvalId: result.githubApproval.approvalId,
      });
      return;
    }

    await replyTelegram({
      bot,
      context,
      text: result?.reply || "Я не смог сформировать ответ.",
    });
  } catch (error) {
    console.error("TelegramAdapter message handling failed:", error?.message || String(error));
    await replyTelegram({
      bot,
      context,
      text: "Я не смог обработать сообщение. Нужно проверить внутреннее состояние SG.",
    });
  }
}
