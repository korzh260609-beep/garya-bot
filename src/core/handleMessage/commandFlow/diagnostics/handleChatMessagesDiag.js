// src/core/handleMessage/commandFlow/diagnostics/handleChatMessagesDiag.js

import { queryChatMessagesDiag } from "./chatMessagesDiagQuery.js";
import { formatChatMessagesDiag } from "./chatMessagesDiagFormatter.js";

export async function handleChatMessagesDiag({
  cmdBase,
  chatIdStr,
  globalUserId,
  isMonarchUser,
  isPrivateChat,
  replyAndLog,
}) {
  if (cmdBase !== "/chat_messages_diag") {
    return { handled: false };
  }

  if (!isPrivateChat) {
    await replyAndLog("⛔ /chat_messages_diag доступна только в личке.", {
      cmd: cmdBase,
      event: "private_only_block",
    });

    return {
      handled: true,
      response: { ok: true, stage: "7B.diag", result: "private_only_block", cmdBase },
    };
  }

  if (!isMonarchUser) {
    await replyAndLog("⛔ Недостаточно прав (monarch-only).", {
      cmd: cmdBase,
      event: "monarch_only_block",
    });

    return {
      handled: true,
      response: { ok: true, stage: "7B.diag", result: "monarch_only_block", cmdBase },
    };
  }

  try {
    const diagData = await queryChatMessagesDiag(chatIdStr);

    const text = formatChatMessagesDiag({
      chatIdStr,
      globalUserId,
      ...diagData,
    });

    await replyAndLog(text, {
      cmd: cmdBase,
      event: "chat_messages_diag",
    });

    return {
      handled: true,
      response: {
        ok: true,
        stage: "7B.diag",
        result: "chat_messages_diag_replied",
        cmdBase,
      },
    };
  } catch (e) {
    console.error("handleMessage(/chat_messages_diag) failed:", e);

    await replyAndLog(
      "⚠️ /chat_messages_diag failed. Проверь Render logs и схему таблиц.",
      {
        cmd: cmdBase,
        event: "chat_messages_diag_failed",
      }
    );

    return {
      handled: true,
      response: { ok: false, reason: "chat_messages_diag_failed", cmdBase },
    };
  }
}