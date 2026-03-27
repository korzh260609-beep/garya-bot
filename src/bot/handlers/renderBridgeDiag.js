// src/bot/handlers/renderBridgeDiag.js

import renderBridge from "../../integrations/render/RenderBridge.js";
import renderBridgeStateStore from "../../integrations/render/RenderBridgeStateStore.js";

export async function handleRenderBridgeDiag({
  bot,
  chatId,
  senderIdStr,
  bypass,
}) {
  if (!bypass) {
    await bot.sendMessage(chatId, "Эта команда доступна только монарху GARYA.");
    return;
  }

  try {
    const diag = renderBridge.getDiag();
    const state = await renderBridgeStateStore.getState(senderIdStr || "global");

    await bot.sendMessage(
      chatId,
      [
        "RenderBridge diag",
        `enabled=${String(diag.enabled)}`,
        `hasApiKey=${String(diag.hasApiKey)}`,
        `ready=${String(diag.ready)}`,
        `apiBaseUrl=${diag.apiBaseUrl}`,
        `timeoutMs=${diag.timeoutMs}`,
        `defaultSourceKey=${diag.defaultSourceKey}`,
        `defaultLogLevel=${diag.defaultLogLevel}`,
        `defaultLogWindowMinutes=${diag.defaultLogWindowMinutes}`,
        `selectedServiceId=${state?.selected_service_id || "-"}`,
        `selectedServiceName=${state?.selected_service_name || "-"}`,
        `selectedServiceSlug=${state?.selected_service_slug || "-"}`,
      ].join("\n")
    );
  } catch (error) {
    await bot.sendMessage(
      chatId,
      `Ошибка RenderBridge diag: ${error?.message || "unknown_error"}`
    );
  }
}

export default {
  handleRenderBridgeDiag,
};