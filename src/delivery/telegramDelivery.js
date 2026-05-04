// AGENT NOTE:
// SG 2.0 Telegram delivery boundary.
// Purpose: send prepared SG replies through Telegram without owning reasoning, memory, sources, tasks, or permissions.
// Do not add AI calls, prompt logic, access checks, or business logic here.

export async function sendTelegramReply({ bot, context, text }) {
  if (!bot) {
    throw new Error("sendTelegramReply: bot is missing");
  }

  const chatId = context?.chatId;

  if (!chatId) {
    throw new Error("sendTelegramReply: context.chatId is missing");
  }

  await bot.sendMessage(chatId, String(text || ""));
}
