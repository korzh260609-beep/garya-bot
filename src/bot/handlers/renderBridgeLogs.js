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

function normalizePreviewMessage(value) {
  const rawMessage = typeof value === "string" ? value.trim() : "";
  return rawMessage.replace(/\s+/g, " ").trim();
}

function stripPreviewPrefix(message) {
  const msg = normalizePreviewMessage(message);
  if (!msg) return "";

  return msg
    .replace(/^(==>|=>)\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isNoiseLogMessage(message) {
  const msg = normalizePreviewMessage(message);
  if (!msg) return true;

  const lower = msg.toLowerCase();

  if (lower === "==>" || lower === "=>") {
    return true;
  }

  if (/^[=/\\\-_|. ]+$/.test(msg)) {
    return true;
  }

  if (/^==>\s*[=/\\\-_|. ]+$/.test(msg)) {
    return true;
  }

  return false;
}

function selectRenderableLogs(logs, limit) {
  const cleaned = [];
  let skippedNoise = 0;

  for (const item of logs) {
    const normalized = normalizePreviewMessage(item?.message);

    if (isNoiseLogMessage(normalized)) {
      skippedNoise += 1;
      continue;
    }

    const message = stripPreviewPrefix(normalized);
    if (!message) {
      skippedNoise += 1;
      continue;
    }

    cleaned.push({
      ...item,
      message,
    });

    if (cleaned.length >= limit) {
      break;
    }
  }

  return {
    cleaned,
    skippedNoise,
  };
}

function compactLogLine(item, index, maxLen = 220) {
  const ts = item?.timestamp || "-";
  const lvl = item?.level || "-";
  const message = stripPreviewPrefix(item?.message);
  const compact =
    message.length > maxLen ? `${message.slice(0, maxLen)}…` : message || "-";

  return `${index + 1}) [${ts}] [${lvl}] ${compact}`;
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

    const fetchLimit = Math.max(limit * 3, 15);

    const logs = await renderBridge.listRecentLogs({
      ownerId: state.selected_owner_id,
      serviceId: state.selected_service_id,
      level: "all",
      minutes,
      limit: fetchLimit,
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

    const { cleaned, skippedNoise } = selectRenderableLogs(logs, limit);

    if (!cleaned.length) {
      await bot.sendMessage(
        chatId,
        [
          "Render logs получены, но это только шумные runtime-строки.",
          `ownerId=${state.selected_owner_id}`,
          `serviceId=${state.selected_service_id}`,
          `windowMinutes=${minutes}`,
          `fetched=${logs.length}`,
          `skippedNoise=${skippedNoise}`,
        ].join("\n")
      );
      return;
    }

    const previewLines = cleaned.map((item, index) =>
      compactLogLine(item, index, 220)
    );

    await bot.sendMessage(
      chatId,
      [
        "✅ Render logs получены.",
        `ownerId=${state.selected_owner_id}`,
        `serviceId=${state.selected_service_id}`,
        `windowMinutes=${minutes}`,
        `fetched=${logs.length}`,
        `shown=${cleaned.length}`,
        `skippedNoise=${skippedNoise}`,
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