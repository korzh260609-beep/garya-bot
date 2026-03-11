// src/core/diagnostics/diagChatMeta.js
import { getChatMeta } from "../../db/chatMetaRepo.js";

function safeText(value) {
  if (value == null || value === "") return "-";
  return String(value);
}

export async function handleDiagChatMeta(ctx = {}) {
  const {
    cmdBase,
    transport,
    chatIdStr,
    replyAndLog,
  } = ctx;

  if (cmdBase !== "/diag_chat_meta") {
    return { handled: false };
  }

  const meta = await getChatMeta(transport, chatIdStr);

  if (!meta) {
    await replyAndLog("chat_meta: not found");
    return { handled: true };
  }

  const lines = [
    "CHAT META",
    "",
    `platform=${safeText(meta.platform)}`,
    `chat_id=${safeText(meta.chat_id)}`,
    `chat_type=${safeText(meta.chat_type)}`,
    `alias=${safeText(meta.alias)}`,
    "title=[hidden service field]",
    `source_enabled=${safeText(meta.source_enabled)}`,
    `privacy_level=${safeText(meta.privacy_level)}`,
    `allow_quotes=${safeText(meta.allow_quotes)}`,
    `allow_raw_snippets=${safeText(meta.allow_raw_snippets)}`,
    `created_at=${safeText(meta.created_at)}`,
  ];

  await replyAndLog(lines.join("\n"));

  return { handled: true };
}

export default handleDiagChatMeta;