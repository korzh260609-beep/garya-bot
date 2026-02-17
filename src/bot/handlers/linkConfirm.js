import { confirmLinkCode } from "../../users/linking.js";

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

  const res = await confirmLinkCode({
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
