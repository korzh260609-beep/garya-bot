// src/bot/router/memoryStatusCommand.js

export async function handleMemoryStatusCommand({
  memory,
  memDiag,
  ctxReply,
  getPublicEnvSnapshot,
  cmdBase,
}) {
  const status = await memory.status();
  const v2Cols = await memDiag.getChatMemoryV2Columns();

  const pub = getPublicEnvSnapshot();
  const buildCommit =
    String(pub.RENDER_GIT_COMMIT || "").trim() ||
    String(pub.GIT_COMMIT || "").trim() ||
    "";
  const buildService = String(pub.RENDER_SERVICE_ID || "").trim();
  const buildInstance =
    String(pub.RENDER_INSTANCE_ID || "").trim() ||
    String(pub.HOSTNAME || "").trim();

  await ctxReply(
    [
      "🧠 MEMORY STATUS",
      `enabled: ${status.enabled}`,
      `mode: ${status.mode}`,
      `hasDb: ${status.hasDb}`,
      `hasLogger: ${status.hasLogger}`,
      `hasChatAdapter: ${status.hasChatAdapter}`,
      `configKeys: ${status.configKeys.join(", ")}`,
      "",
      "DB chat_memory V2 columns:",
      `global_user_id: ${v2Cols.global_user_id}`,
      `transport: ${v2Cols.transport}`,
      `metadata: ${v2Cols.metadata}`,
      `schema_version: ${v2Cols.schema_version}`,
      "",
      "ENV (public allowlist):",
      `MEMORY_ENABLED: ${String(pub.MEMORY_ENABLED || "")}`,
      `MEMORY_MODE: ${String(pub.MEMORY_MODE || "")}`,
      `NODE_ENV: ${String(pub.NODE_ENV || "")}`,
      "",
      "BUILD:",
      `commit: ${buildCommit}`,
      `service: ${buildService}`,
      `instance: ${buildInstance}`,
    ].join("\n"),
    { cmd: cmdBase, handler: "messageRouter" }
  );
}