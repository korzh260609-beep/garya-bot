// src/bot/handlers/renderBridgeDeploy.js

import renderBridge from "../../integrations/render/RenderBridge.js";
import renderBridgeStateStore from "../../integrations/render/RenderBridgeStateStore.js";
import {
  buildDeploySnapshotFromDeploy,
} from "../../integrations/render/RenderBridgeNormalizer.js";
import { ingestRenderLogSnapshot } from "../../http/renderLogIngestRoute.js";
import { getRenderBridgeConfig } from "../../integrations/render/RenderBridgeConfig.js";

export async function handleRenderBridgeDeploy({
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

  const deployId = typeof rest === "string" ? rest.trim() : "";

  if (!deployId) {
    await bot.sendMessage(chatId, "Используй: /render_bridge_deploy <deployId>");
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

    const deploy = await renderBridge.getDeploy({
      serviceId: state.selected_service_id,
      deployId,
    });

    const cfg = getRenderBridgeConfig();

    const snapshot = buildDeploySnapshotFromDeploy({
      deploy,
      sourceKey: cfg.defaultSourceKey,
      service: {
        id: state.selected_service_id,
        name: state.selected_service_name,
        slug: state.selected_service_slug,
      },
    });

    const stored = await ingestRenderLogSnapshot({
      sourceKey: snapshot.sourceKey,
      mode: snapshot.mode,
      deployId: snapshot.deployId,
      status: snapshot.status,
      logText: snapshot.logText,
      meta: snapshot.meta,
      diagnosisSource: "render_bridge_deploy",
    });

    if (!stored.ok) {
      await bot.sendMessage(
        chatId,
        `RenderBridge deploy: snapshot не сохранён (${stored.error || "unknown"})`
      );
      return;
    }

    await bot.sendMessage(
      chatId,
      [
        "✅ Render deploy получен и сохранён.",
        `serviceId=${state.selected_service_id}`,
        `deployId=${snapshot.deployId}`,
        `status=${snapshot.status}`,
        `storedId=${stored?.payload?.storedId || "-"}`,
        `candidatePath=${stored?.payload?.candidatePath || "-"}`,
        `exactLine=${stored?.payload?.exactLine || "-"}`,
        `confidence=${stored?.payload?.confidence || "-"}`,
      ].join("\n")
    );
  } catch (error) {
    await bot.sendMessage(
      chatId,
      `Ошибка RenderBridge deploy: ${error?.message || "unknown_error"}`
    );
  }
}

export default {
  handleRenderBridgeDeploy,
};