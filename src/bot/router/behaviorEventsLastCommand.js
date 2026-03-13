// src/bot/router/behaviorEventsLastCommand.js

export async function handleBehaviorEventsLastCommand({
  handleBehaviorEventsLast,
  bot,
  chatId,
  rest,
  senderIdStr,
}) {
  await handleBehaviorEventsLast({
    bot,
    chatId,
    rest,
    senderIdStr,
  });
}