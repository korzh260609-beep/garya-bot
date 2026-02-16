import { getLinkStatus } from "../../users/linking.js";

export async function handleLinkStatus({ bot, chatId, senderIdStr }) {
  const res = await getLinkStatus({ provider: "telegram", providerUserId: senderIdStr });
  if (!res?.ok) {
    await bot.sendMessage(chatId, `⚠️ Link status error: ${res?.error || "unknown"}`);
    return;
  }

  const row = res.link;
  if (!row) {
    await bot.sendMessage(chatId, "ℹ️ Для этого аккаунта активной link-записи нет. Запусти /link_start.");
    return;
  }

  await bot.sendMessage(
    chatId,
    [
      "🔎 Link status",
      `global_user_id: ${row.global_user_id}`,
      `provider: ${row.provider}`,
      `provider_user_id: ${row.provider_user_id}`,
      `status: ${row.status}`,
      `updated_at: ${new Date(row.updated_at).toISOString()}`,
    ].join("\n")
  );
}
