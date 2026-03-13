// src/bot/router/memoryBackfillCommand.js

export async function handleMemoryBackfillCommand({
  accessPack,
  memDiag,
  chatIdStr,
  rest,
  ctxReply,
  cmdBase,
}) {
  const globalUserId =
    accessPack?.user?.global_user_id || accessPack?.global_user_id || null;

  const rawN = Number(String(rest || "").trim() || "200");
  const limit = Number.isFinite(rawN)
    ? Math.max(1, Math.min(500, rawN))
    : 200;

  const out = await memDiag.memoryBackfill({
    chatIdStr,
    globalUserId,
    limit,
  });

  await ctxReply(out, { cmd: cmdBase, handler: "messageRouter" });
}