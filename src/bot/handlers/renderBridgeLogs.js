// src/bot/handlers/renderBridgeLogs.js

import renderBridge from "../../integrations/render/RenderBridge.js";
import renderBridgeStateStore from "../../integrations/render/RenderBridgeStateStore.js";

function parseArgs(rest, defaults = {}) {
  const raw = typeof rest === "string" ? rest.trim() : "";
  const parts = raw ? raw.split(/\s+/) : [];

  const minutesRaw = Number(parts[0]);
  const limitRaw = Number(parts[1]);

  const minutes = Number.isFinite(minutesRaw)
    ? Math.max(1, Math.min(Math.trunc(minutesRaw), 1440))
    : defaults.minutes ?? 60;

  const limit = Number.isFinite(limitRaw)
    ? Math.max(1, Math.min(Math.trunc(limitRaw), 10))
    : defaults.limit ?? 5;

  return { minutes, limit };
}

function compactLogLine(item, index, maxLen = 220) {
  const ts = item?.timestamp || "-";
  const lvl = item?.level || "-";
  const rawMessage =
    typeof item?.message === "string" ? item.message.trim() : "";
  const oneLine = rawMessage.replace(/\s+/g, " ");
  const message =
    oneLine.length > maxLen ? `${oneLine.slice(0, maxLen)}…` : oneLine || "-";

  return `${index + 1}) [${ts}] [${lvl}] ${message}`;
}

export async function handleRenderBridgeLogs({
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

    if (!state?.selected_owner_id) {
      await bot.sendMessage(
        chatId,
        "Для выбранного Render service не сохранён ownerId. Выбери сервис заново:\n/render_bridge_service <serviceId|name|slug>"
      );
      return;
    }

    const { minutes, limit } = parseArgs(rest, {
      minutes: 60,
      limit: 5,
    });

    const logs = await renderBridge.listRecentLogs({
      ownerId: state.selected_owner_id,
      serviceId: state.selected_service_id,
      level: "all",
      minutes,
      limit,
    });

    if (!logs.length) {
      await bot.sendMessage(
        chatId,
        [
          "Render logs не найдены.",
          `ownerId=${state.selected_owner_id}`,
          `serviceId=${state.selected_service_id}`,
          `windowMinutes=${minutes}`,
          `limit=${limit}`,
        ].join("\n")
      );
      return;
    }

    const previewLines = logs
      .slice(0, limit)
      .map((item, index) => compactLogLine(item, index, 220));

    await bot.sendMessage(
      chatId,
      [
        "✅ Render logs получены.",
        `ownerId=${state.selected_owner_id}`,
        `serviceId=${state.selected_service_id}`,
        `windowMinutes=${minutes}`,
        `returned=${logs.length}`,
        ...previewLines,
      ].join("\n")
    );
  } catch (error) {
    await bot.sendMessage(
      chatId,
      `Ошибка RenderBridge logs: ${error?.message || "unknown_error"}`
    );
  }
}

export default {
  handleRenderBridgeLogs,
};