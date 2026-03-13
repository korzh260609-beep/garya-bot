// src/bot/router/ctxReplyCommand.js
// STAGE split — extracted from messageRouter.js
// Responsibility:
// 1) deterministic pair message id
// 2) command reply send + assistant memory write
// NOTE:
// - no behavior change
// - best-effort memory write
// - Telegram send remains authoritative

function forcePairMessageId(metaIn, msg) {
  const meta = metaIn && typeof metaIn === "object" ? { ...metaIn } : {};
  const userMid = msg?.message_id ?? null;

  if (userMid === null || userMid === undefined) return meta;

  const userMidStr = String(userMid);

  if (meta.messageId !== undefined && meta.messageId !== null) {
    const incomingStr = String(meta.messageId);
    if (incomingStr !== userMidStr) {
      meta.originalMessageId = meta.messageId;
    }
  }

  meta.messageId = userMid;
  meta.pairMessageId = userMid;
  return meta;
}

export async function ctxReplyCommand({
  bot,
  chatId,
  chatIdStr,
  msg,
  memory,
  globalUserId,
  text,
  meta = {},
}) {
  const outText = String(text ?? "");

  const sent = await bot.sendMessage(chatId, outText);

  try {
    const forcedMeta = forcePairMessageId(
      {
        ...meta,
        kind: "command_reply",
        assistantMessageId: sent?.message_id ?? null,
      },
      msg
    );

    await memory.write({
      chatId: String(chatIdStr || ""),
      globalUserId: globalUserId ?? null,
      role: "assistant",
      content: outText,
      transport: "telegram",
      metadata: forcedMeta,
      schemaVersion: 2,
    });
  } catch (e) {
    console.error("ctx.reply(command) memory.write failed:", e);
  }

  return sent;
}

export { forcePairMessageId };