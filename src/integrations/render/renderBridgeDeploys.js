// src/bot/handlers/renderBridgeDeploys.js

import renderBridge from "../../integrations/render/RenderBridge.js";
import renderBridgeStateStore from "../../integrations/render/RenderBridgeStateStore.js";

export async function handleRenderBridgeDeploys({
  bot,
  chatId,
  senderIdStr,
  rest,
  bypass,
}) {
  if (!bypass) {
    await bot.sendMessage(chatId, "Эта команда доступна только монарху GARYA.");
    return;
  }

  try {
    const state = await renderBridgeStateStore.getState(senderIdStr || "global");

    if (!state?.selected_service_id) {
      await bot.sendMessage(
        chatId,
        "Сначала выбери Render service:\n/render_bridge_service <serviceId|name|slug>"
      );
      return;
    }

    const n = Math.max(
      1,
      Math.min(Math.trunc(Number((rest || "").trim()) || 5), 20)
    );

    const items = await renderBridge.listDeploys({
      serviceId: state.selected_service_id,
      limit: n,
    });

    if (!items.length) {
      await bot.sendMessage(chatId, "Deploys не найдены.");
      return;
    }

    let out = `🧱 Render deploys (${items.length})\n`;
    out += `serviceId=${state.selected_service_id}\n\n`;

    for (const item of items) {
      out += `deployId=${item.id || "-"}\n`;
      out += `status=${item.status || "-"}\n`;
      out += `createdAt=${item.createdAt || "-"}\n`;
      out += `finishedAt=${item.finishedAt || "-"}\n`;
      out += `commit=${item.commit || "-"}\n\n`;
    }

    await bot.sendMessage(chatId, out);
  } catch (error) {
    await bot.sendMessage(
      chatId,
      `Ошибка RenderBridge deploys: ${error?.message || "unknown_error"}`
    );
  }
}

export default {
  handleRenderBridgeDeploys,
};