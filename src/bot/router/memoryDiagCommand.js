// src/bot/router/memoryDiagCommand.js

export async function handleMemoryDiagCommand({
  accessPack,
  memDiag,
  chatIdStr,
  ctxReply,
  cmdBase,
}) {
  const globalUserId =
    accessPack?.user?.global_user_id || accessPack?.global_user_id || null;

  const out = await memDiag.memoryDiag({
    chatIdStr,
    globalUserId,
  });

  await ctxReply(out, { cmd: cmdBase, handler: "messageRouter" });
}