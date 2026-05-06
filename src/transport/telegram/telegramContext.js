// AGENT NOTE:
// SG 2.0 Telegram context mapper.
// Purpose: convert Telegram update objects into normalized SG core context.
// Do not add AI, core handling, delivery, or permission logic here.

export function toTelegramMessageContext(message) {
  return {
    transport: "telegram",
    chatId: message?.chat?.id ?? null,
    userId: message?.from?.id ?? null,
    senderId: message?.from?.id ?? null,
    chatType: message?.chat?.type || "unknown",
    text: typeof message?.text === "string" ? message.text : "",
    raw: message,
  };
}

export function toTelegramCallbackContext(callbackQuery) {
  const message = callbackQuery?.message || {};

  return {
    transport: "telegram",
    chatId: message?.chat?.id ?? null,
    userId: callbackQuery?.from?.id ?? null,
    senderId: callbackQuery?.from?.id ?? null,
    chatType: message?.chat?.type || "unknown",
    text: typeof callbackQuery?.data === "string" ? callbackQuery.data : "",
    raw: callbackQuery,
  };
}
