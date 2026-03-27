// src/bot/handlers/renderBridgeService.js

import renderBridge from "../../integrations/render/RenderBridge.js";
import renderBridgeStateStore from "../../integrations/render/RenderBridgeStateStore.js";

export async function handleRenderBridgeService({
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

  const raw = typeof rest === "string" ? rest.trim() : "";

  if (!raw) {
    const state = await renderBridgeStateStore.getState(senderIdStr || "global");

    if (!state?.selected_service_id) {
      await bot.sendMessage(
        chatId,
        "Активный Render service не выбран.\nИспользуй: /render_bridge_service <serviceId|name|slug>"
      );
      return;
    }

    await bot.sendMessage(
      chatId,
      [
        "Текущий Render service:",
        `id=${state.selected_service_id || "-"}`,
        `name=${state.selected_service_name || "-"}`,
        `slug=${state.selected_service_slug || "-"}`,
        `ownerId=${state.selected_owner_id || "-"}`,
      ].join("\n")
    );
    return;
  }

  if (raw.toLowerCase() === "clear") {
    const cleared = await renderBridgeStateStore.clearSelectedService(
      senderIdStr || "global"
    );

    await bot.sendMessage(
      chatId,
      [
        "Активный Render service очищен.",
        `updatedAt=${cleared?.updated_at || "-"}`,
      ].join("\n")
    );
    return;
  }

  try {
    const resolved = await renderBridge.resolveService(raw);

    if (!resolved.ok) {
      if (resolved.error === "service_not_found") {
        await bot.sendMessage(chatId, `Render service не найден: ${raw}`);
        return;
      }

      if (resolved.error === "service_ambiguous") {
        const lines = ["Найдено несколько сервисов. Уточни выбор:"];

        for (const item of resolved.matches || []) {
          lines.push(
            `- ${item.name || "-"} | slug=${item.slug || "-"} | id=${item.id || "-"} | ownerId=${item.ownerId || "-"}`
          );
        }

        await bot.sendMessage(chatId, lines.join("\n"));
        return;
      }

      await bot.sendMessage(chatId, `Не удалось определить сервис: ${resolved.error}`);
      return;
    }

    const saved = await renderBridgeStateStore.setSelectedService({
      ownerKey: senderIdStr || "global",
      serviceId: resolved.service.id,
      serviceName: resolved.service.name,
      serviceSlug: resolved.service.slug,
      ownerId: resolved.service.ownerId,
    });

    await bot.sendMessage(
      chatId,
      [
        "✅ Render service сохранён.",
        `id=${saved?.selected_service_id || "-"}`,
        `name=${saved?.selected_service_name || "-"}`,
        `slug=${saved?.selected_service_slug || "-"}`,
        `ownerId=${saved?.selected_owner_id || "-"}`,
      ].join("\n")
    );
  } catch (error) {
    await bot.sendMessage(
      chatId,
      `Ошибка RenderBridge service: ${error?.message || "unknown_error"}`
    );
  }
}

export default {
  handleRenderBridgeService,
};