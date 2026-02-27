import { getLinkStatus, getLinkStatusV2 } from "../../users/linking.js";
import { getFeatureFlags } from "../../core/config.js";

export async function handleLinkStatus({
  bot,
  chatId,
  senderIdStr,
  provider = "telegram",
}) {
  const flags = getFeatureFlags();
  const fn = flags?.LINKING_V2 ? getLinkStatusV2 : getLinkStatus;

  const res = await fn({
    provider,
    providerUserId: senderIdStr,
  });

  if (!res?.ok) {
    await bot.sendMessage(chatId, `⚠️ Link status error: ${res?.error || "unknown"}`);
    return;
  }

  const row = res.link;
  const pending = res.pending;

  if (!row && !pending) {
    await bot.sendMessage(
      chatId,
      "ℹ️ Для этого аккаунта активной link-записи нет. Запусти /link_start."
    );
    return;
  }

  if (!row && pending) {
    await bot.sendMessage(
      chatId,
      [
        "⏳ Есть активный link-code (ожидает подтверждения)",
        `code: ${pending.code}`,
        `global_user_id: ${pending.global_user_id}`,
        `expires_at: ${new Date(pending.expires_at).toISOString()}`,
        "",
        "Подтверди на другом канале: /link_confirm <code>",
      ].join("\n")
    );
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
