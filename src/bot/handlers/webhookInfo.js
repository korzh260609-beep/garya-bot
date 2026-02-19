// src/bot/handlers/webhookInfo.js
// Admin diagnostic: shows Telegram getWebhookInfo result (token-safe)

function maskTokenInUrl(url, token) {
  try {
    if (!url) return "";
    if (!token) return String(url);
    return String(url).split(token).join("***TOKEN***");
  } catch {
    return String(url || "");
  }
}

export async function handleWebhookInfo({ bot, chatId }) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const baseUrl = process.env.BASE_URL;

  if (!token) {
    await bot.sendMessage(chatId, "⛔ TELEGRAM_BOT_TOKEN not set");
    return;
  }
  if (!baseUrl) {
    await bot.sendMessage(chatId, "⛔ BASE_URL not set");
    return;
  }

  const apiUrl = `https://api.telegram.org/bot${token}/getWebhookInfo`;

  try {
    const r = await fetch(apiUrl, { method: "GET" });
    const data = await r.json();

    const result = data?.result || {};
    const urlMasked = maskTokenInUrl(result?.url, token);

    const lines = [
      "WEBHOOK INFO (token-safe)",
      `ok: ${String(data?.ok)}`,
      `http_status: ${r.status}`,
      `BASE_URL: ${baseUrl}`,
      `telegram_url: ${urlMasked || "(empty)"}`,
      `pending_update_count: ${String(result?.pending_update_count ?? 0)}`,
      `last_error_date: ${String(result?.last_error_date ?? "")}`,
      `last_error_message: ${String(result?.last_error_message ?? "")}`,
      `ip_address: ${String(result?.ip_address ?? "")}`,
      `has_custom_certificate: ${String(result?.has_custom_certificate ?? false)}`,
      `max_connections: ${String(result?.max_connections ?? "")}`,
      `allowed_updates: ${
        Array.isArray(result?.allowed_updates)
          ? JSON.stringify(result.allowed_updates)
          : ""
      }`,
    ];

    await bot.sendMessage(chatId, lines.join("\n"));
  } catch (e) {
    await bot.sendMessage(
      chatId,
      `⛔ /webhook_info failed: ${String(e?.message || e)}`
    );
  }
}
