// src/bot/handlers/renderBridgeDiagnose.js

import renderBridge from "../../integrations/render/RenderBridge.js";
import renderBridgeStateStore from "../../integrations/render/RenderBridgeStateStore.js";
import { getRenderBridgeConfig } from "../../integrations/render/RenderBridgeConfig.js";
import {
  buildErrorSnapshotFromLogs,
} from "../../integrations/render/RenderBridgeNormalizer.js";
import RenderLogDiagnosisService from "../../logging/RenderLogDiagnosisService.js";

function parseMinutes(rest, fallback = 60) {
  const raw = typeof rest === "string" ? rest.trim() : "";
  if (!raw) return fallback;

  const token = raw.split(/\s+/)[0];
  const n = Number(token);
  if (!Number.isFinite(n)) return fallback;

  return Math.max(1, Math.min(Math.trunc(n), 1440));
}

function buildPreviewLines(logs, maxLines = 2, maxLen = 220) {
  return logs.slice(0, maxLines).map((item, index) => {
    const ts = item?.timestamp || "-";
    const lvl = item?.level || "-";
    const rawMessage = typeof item?.message === "string" ? item.message.trim() : "";
    const oneLine = rawMessage.replace(/\s+/g, " ");
    const message =
      oneLine.length > maxLen ? `${oneLine.slice(0, maxLen)}…` : oneLine || "-";

    return `preview${index + 1}=[${ts}] [${lvl}] ${message}`;
  });
}

export async function handleRenderBridgeDiagnose({
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

    const diagnosisService = new RenderLogDiagnosisService();
    const diagnosis = await diagnosisService.diagnose(snapshot.logText, {
      source: "render_bridge_diagnose",
      serviceId: state.selected_service_id,
      ownerId: state.selected_owner_id,
      serviceName: state.selected_service_name,
      serviceSlug: state.selected_service_slug,
    });

    const fingerprint = diagnosis?.fingerprint || {};
    const correlation = diagnosis?.correlation || {};
    const topCandidate = correlation?.topCandidate || null;
    const lineWindow = correlation?.lineWindow || null;

    const previewLines = buildPreviewLines(logs, 2, 220);

    await bot.sendMessage(
      chatId,
      [
        "✅ Render diagnosis готов.",
        `ownerId=${state.selected_owner_id}`,
        `serviceId=${state.selected_service_id}`,
        `windowMinutes=${minutes}`,
        `lines=${logs.length}`,
        `error=${fingerprint?.errorHeadline || "unknown"}`,
        `kind=${fingerprint?.kind || "unknown"}`,
        `candidatePath=${topCandidate?.path || "-"}`,
        `exactLine=${lineWindow?.exactLine || "-"}`,
        `lineWindow=${lineWindow ? `${lineWindow.startLine || "-"}-${lineWindow.endLine || "-"}` : "-"}`,
        `likelyCause=${fingerprint?.likelyCause || "нужна дополнительная проверка"}`,
        `firstCheck=${diagnosis?.shortText ? "-" : "-"}`,
        `confidence=${correlation?.confidence || fingerprint?.confidence || "very_low"}`,
        "",
        "Короткий диагноз:",
        diagnosis?.shortText || "не удалось построить short diagnosis",
        "",
        ...previewLines,
      ].join("\n")
    );
  } catch (error) {
    await bot.sendMessage(
      chatId,
      `Ошибка RenderBridge diagnose: ${error?.message || "unknown_error"}`
    );
  }
}

export default {
  handleRenderBridgeDiagnose,
};