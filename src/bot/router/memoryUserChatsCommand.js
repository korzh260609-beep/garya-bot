// src/bot/router/memoryUserChatsCommand.js

export async function handleMemoryUserChatsCommand({
  accessPack,
  memDiag,
  ctxReply,
  cmdBase,
}) {
  const globalUserId =
    accessPack?.user?.global_user_id || accessPack?.global_user_id || null;

  const out = await memDiag.memoryUserChats({ globalUserId });
  await ctxReply(out, { cmd: cmdBase, handler: "messageRouter" });
}