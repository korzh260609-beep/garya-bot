// AGENT NOTE:
// SG 2.0 Telegram delivery boundary.
// Purpose: send prepared SG replies through Telegram without owning reasoning, memory, sources, tasks, or permissions.
// Do not add AI calls, prompt logic, access checks, or business logic here.

export async function sendTelegramReply({ bot, context, text, options = {} }) {
  if (!bot) {
    throw new Error("sendTelegramReply: bot is missing");
  }

  const chatId = context?.chatId;

  if (!chatId) {
    throw new Error("sendTelegramReply: context.chatId is missing");
  }

  await bot.sendMessage(chatId, String(text || ""), options);
}

export async function sendTelegramGithubApprovalReply({ bot, context, text, approvalId }) {
  if (!approvalId) {
    await sendTelegramReply({ bot, context, text });
    return;
  }

  await sendTelegramReply({
    bot,
    context,
    text,
    options: {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "✅ Подтвердить",
              callback_data: `sg_write_confirm:${approvalId}`,
            },
            {
              text: "❌ Отменить",
              callback_data: `sg_write_cancel:${approvalId}`,
            },
          ],
        ],
      },
    },
  });
}
