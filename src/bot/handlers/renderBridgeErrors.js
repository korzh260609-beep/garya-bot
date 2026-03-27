// src/bot/handlers/renderBridgeErrors.js

import renderBridge from "../../integrations/render/RenderBridge.js";
import renderBridgeStateStore from "../../integrations/render/RenderBridgeStateStore.js";
import {
  buildErrorSnapshotFromLogs,
} from "../../integrations/render/RenderBridgeNormalizer.js";
import { ingestRenderLogSnapshot } from "../../http/renderLogIngestRoute.js";
import { getRenderBridgeConfig } from "../../integrations/render/RenderBridgeConfig.js";

function parseMinutes(rest, fallback = 60) {
  const raw = typeof rest === "string" ? rest.trim() : "";
  if (!raw) return fallback;

  const token = raw.split(/\s+/)[0];
  const n = Number(token);
  if (!Number.isFinite(n)) return fallback;

  return Math.max(1, Math.min(Math.trunc(n), 1440));
}

export async function handleRenderBridgeErrors({
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

    const cfg = getRenderBridgeConfig();
    const minutes = parseMinutes(rest, cfg.defaultLogWindowMinutes);

    const logs = await renderBridge.listRecentLogs({
      ownerId: state.selected_owner_id,
      serviceId: state.selected_service_id,
      level: cfg.defaultLogLevel,
      minutes,
      limit: cfg.defaultLogLimit,
    });

    if (!logs.length) {
      await bot.sendMessage(
        chatId,
        [
          "Render error logs не найдены.",
          `ownerId=${state.selected_owner_id}`,
          `serviceId=${state.selected_service_id}`,
          `windowMinutes=${minutes}`,
        ].join("\n")
      );
      return;
    }

    const snapshot = buildErrorSnapshotFromLogs({
      logs,
      sourceKey: cfg.defaultSourceKey,
      service: {
        id: state.selected_service_id,
        name: state.selected_service_name,
        slug: state.selected_service_slug,
        ownerId: state.selected_owner_id,
      },
      level: cfg.defaultLogLevel,
      minutes,
    });

    const stored = await ingestRenderLogSnapshot({
      sourceKey: snapshot.sourceKey,
      mode: snapshot.mode,
      logText: snapshot.logText,
      meta: snapshot.meta,
      diagnosisSource: "render_bridge_errors",
    });

    if (!stored.ok) {
      await bot.sendMessage(
        chatId,
        `RenderBridge errors: snapshot не сохранён (${stored.error || "unknown"})`
      );
      return;
    }

    await bot.sendMessage(
      chatId,
      [
        "✅ Render error logs получены и сохранены.",
        `ownerId=${state.selected_owner_id}`,
        `serviceId=${state.selected_service_id}`,
        `lines=${logs.length}`,
        `storedId=${stored?.payload?.storedId || "-"}`,
        `candidatePath=${stored?.payload?.candidatePath || "-"}`,
        `exactLine=${stored?.payload?.exactLine || "-"}`,
        `confidence=${stored?.payload?.confidence || "-"}`,
      ].join("\n")
    );
  } catch (error) {
    await bot.sendMessage(
      chatId,
      `Ошибка RenderBridge errors: ${error?.message || "unknown_error"}`
    );
  }
}

export default {
  handleRenderBridgeErrors,
};