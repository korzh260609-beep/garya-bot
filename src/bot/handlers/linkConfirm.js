import { confirmLinkCode, confirmLinkCodeV2 } from "../../users/linking.js";
import { getFeatureFlags } from "../../core/config.js";

export async function handleLinkConfirm({
  bot,
  chatId,
  senderIdStr,
  rest,
  provider = "telegram",
}) {
  const code = String(rest || "").trim();
  if (!code) {
    await bot.sendMessage(chatId, "Использование: /link_confirm <code>");
    return;
  }

  const flags = getFeatureFlags();
  const fn = flags?.LINKING_V2 ? confirmLinkCodeV2 : confirmLinkCode;

  const res = await fn({
    code,
    provider,
    providerUserId: senderIdStr,
  });

  if (!res?.ok) {
    await bot.sendMessage(chatId, `⚠️ Link confirm failed: ${res?.error || "unknown"}`);
    return;
  }

  await bot.sendMessage(
    chatId,
    [
      "✅ Link подтверждён.",
      `global_user_id: ${res.global_user_id}`,
      `provider: ${res.linked_provider}`,
      `provider_user_id: ${res.linked_provider_user_id}`,
    ].join("\n")
  );
}
