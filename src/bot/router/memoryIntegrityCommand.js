// src/bot/router/memoryIntegrityCommand.js

export async function handleMemoryIntegrityCommand({
  memDiag,
  chatIdStr,
  ctxReply,
  cmdBase,
}) {
  const out = await memDiag.memoryIntegrity({ chatIdStr });
  await ctxReply(out, { cmd: cmdBase, handler: "messageRouter" });
}