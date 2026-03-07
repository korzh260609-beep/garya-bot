import { getChatMeta } from "../../db/chatMetaRepo.js";

export async function handleDiagChatMeta(ctx = {}) {

  const { cmdBase, transport, chatIdStr, replyAndLog } = ctx;

  if (cmdBase !== "/diag_chat_meta") {
    return { handled:false };
  }

  const meta = await getChatMeta(transport, chatIdStr);

  if (!meta) {
    await replyAndLog("chat_meta: not found");
    return { handled:true };
  }

  const lines = [
    "CHAT META",
    "",
    `platform=${meta.platform}`,
    `chat_id=${meta.chat_id}`,
    `chat_type=${meta.chat_type}`,
    `alias=${meta.alias || "-"}`,
    `title=${meta.title || "-"}`,
    `created_at=${meta.created_at}`,
  ];

  await replyAndLog(lines.join("\n"));

  return { handled:true };
}