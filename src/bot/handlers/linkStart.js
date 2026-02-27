import { createLinkCode, createLinkCodeV2 } from "../../users/linking.js";
import { getFeatureFlags } from "../../core/config.js";

export async function handleLinkStart({
  bot,
  chatId,
  senderIdStr,
  provider = "telegram",
}) {
  const flags = getFeatureFlags();
  const fn = flags?.LINKING_V2 ? createLinkCodeV2 : createLinkCode;

  const res = await fn({ provider, providerUserId: senderIdStr });

  if (!res?.ok) {
    await bot.sendMessage(
      chatId,
      `⚠️ Не удалось создать link-код: ${res?.error || "unknown"}`
    );
    return;
  }

  await bot.sendMessage(
    chatId,
    [
      "🔗 Link code создан.",
      `code: ${res.code}`,
      `global_user_id: ${res.global_user_id}`,
      `expires_at: ${new Date(res.expires_at).toISOString()}`,
      "",
      "Используй на другом канале: /link_confirm <code>",
    ].join("\n")
  );
}
