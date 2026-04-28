// src/bot/handlers/renderBridgeLogs.js

import renderBridge from "../../integrations/render/RenderBridge.js";
import renderBridgeStateStore from "../../integrations/render/RenderBridgeStateStore.js";

function clampInt(value, fallback, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

function parseArgs(rest, defaults = {}) {
  const raw = typeof rest === "string" ? rest.trim() : "";
  const parts = raw ? raw.split(/\s+/) : [];
  const first = String(parts[0] || "").toLowerCase();

  if (first === "latest" || first === "latest_deploy") {
    return {
      target: "latest_deploy",
      minutes: defaults.minutes ?? 60,
      limit: clampInt(parts[1], defaults.limit ?? 50, 1, 300),
    };
  }

  if (parts.length === 1 && Number.isFinite(Number(parts[0]))) {
    return {
      target: "time",
      minutes: defaults.minutes ?? 60,
      limit: clampInt(parts[0], defaults.limit ?? 50, 1, 300),
    };
  }

  return {
    target: "time",
    minutes: clampInt(parts[0], defaults.minutes ?? 60, 1, 1440),
    limit: clampInt(parts[1], defaults.limit ?? 50, 1, 300),
  };
}

function normalizeLogMessage(value) {
  return typeof value === "string" ? value.replace(/\r/g, "").trim() : "";
}

function formatRawLogLine(item, index) {
  const ts = item?.timestamp || "-";
  const lvl = item?.level || "-";
  const message = normalizeLogMessage(item?.message) || "-";
  return `${index + 1}) [${ts}] [${lvl}] ${message}`;
}

function parseIsoMs(value) {
  const n = Date.parse(typeof value === "string" ? value.trim() : "");
  return Number.isFinite(n) ? n : 0;
}

function isoFromMs(ms) {
  return Number.isFinite(ms) && ms > 0 ? new Date(ms).toISOString() : "";
}

function buildDeployLogWindow(deploy = null) {
  const createdMs = parseIsoMs(deploy?.createdAt);
  if (!createdMs) {
    return { startTime: "", endTime: "" };
  }

  const finishedMs = parseIsoMs(deploy?.finishedAt);
  const startMs = Math.max(0, createdMs - 30_000);
  const endMs = Math.max(finishedMs || Date.now(), createdMs + 60_000) + 30_000;

  return {
    startTime: isoFromMs(startMs),
    endTime: isoFromMs(endMs),
  };
}

async function sendLongMessage(bot, chatId, text) {
  const max = 3600;
  const lines = String(text || "").split("\n");
  let chunk = "";

  for (const line of lines) {
    const next = chunk ? `${chunk}\n${line}` : line;
    if (next.length <= max) {
      chunk = next;
      continue;
    }

    if (chunk) {
      await bot.sendMessage(chatId, chunk);
      chunk = "";
    }

    if (line.length <= max) {
      chunk = line;
      continue;
    }

    for (let i = 0; i < line.length; i += max) {
      await bot.sendMessage(chatId, line.slice(i, i + max));
    }
  }

  if (chunk) {
    await bot.sendMessage(chatId, chunk);
  }
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

    const args = parseArgs(rest, {
      minutes: 60,
      limit: 50,
    });

    let deploy = null;
    let explicitWindow = null;

    if (args.target === "latest_deploy") {
      const deploys = await renderBridge.listDeploys({
        serviceId: state.selected_service_id,
        limit: 1,
      });
      deploy = deploys[0] || null;
      explicitWindow = buildDeployLogWindow(deploy);
    }

    const logs = await renderBridge.listRecentLogs({
      ownerId: state.selected_owner_id,
      serviceId: state.selected_service_id,
      level: "all",
      minutes: args.minutes,
      limit: args.limit,
      startTime: explicitWindow?.startTime || "",
      endTime: explicitWindow?.endTime || "",
    });

    const lines = logs.map((item, index) => formatRawLogLine(item, index));

    const output = [
      "✅ RAW RENDER LOGS",
      `ownerId=${state.selected_owner_id}`,
      `serviceId=${state.selected_service_id}`,
      `target=${args.target}`,
      `deployId=${deploy?.id || "-"}`,
      `deployStatus=${deploy?.status || "-"}`,
      `deployCommit=${deploy?.commit || "-"}`,
      `deployCreatedAt=${deploy?.createdAt || "-"}`,
      `deployFinishedAt=${deploy?.finishedAt || "-"}`,
      `windowMinutes=${args.minutes}`,
      `startTime=${explicitWindow?.startTime || "-"}`,
      `endTime=${explicitWindow?.endTime || "-"}`,
      `limit=${args.limit}`,
      `returned=${logs.length}`,
      "",
      "```text",
      lines.length ? lines.join("\n") : "-",
      "```",
    ].join("\n");

    await sendLongMessage(bot, chatId, output);
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
