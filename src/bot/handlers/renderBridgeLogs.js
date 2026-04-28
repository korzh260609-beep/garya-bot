// src/bot/handlers/renderBridgeLogs.js

import renderBridge from "../../integrations/render/RenderBridge.js";
import renderBridgeStateStore from "../../integrations/render/RenderBridgeStateStore.js";

const DEFAULT_LATEST_LOOKBACK_MINUTES = 1440;

function clampInt(value, fallback, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function parseArgs(rest, defaults = {}) {
  const raw = normalizeString(rest);
  const parts = raw ? raw.split(/\s+/) : [];
  const first = String(parts[0] || "").toLowerCase();

  // /render_bridge_logs 50
  // Meaning for the user: return the last 50 logs by count.
  // Internal note: Render API still needs a bounded lookback window.
  if (!first || Number.isFinite(Number(first))) {
    return {
      target: "latest_count",
      deployId: "",
      minutes: DEFAULT_LATEST_LOOKBACK_MINUTES,
      limit: clampInt(first, defaults.limit ?? 50, 1, 300),
      userMode: "last_logs_by_count",
    };
  }

  // /render_bridge_logs latest 100
  if (first === "latest" || first === "last") {
    return {
      target: "latest_count",
      deployId: "",
      minutes: DEFAULT_LATEST_LOOKBACK_MINUTES,
      limit: clampInt(parts[1], defaults.limit ?? 50, 1, 300),
      userMode: "last_logs_by_count",
    };
  }

  // /render_bridge_logs time 60 100
  // Meaning: return 100 logs from the last 60 minutes.
  if (first === "time" || first === "minutes" || first === "window") {
    return {
      target: "time_window",
      deployId: "",
      minutes: clampInt(parts[1], defaults.minutes ?? 60, 1, 1440),
      limit: clampInt(parts[2], defaults.limit ?? 50, 1, 300),
      userMode: "logs_by_time_window",
    };
  }

  // Backward compatibility: /render_bridge_logs 60m 100
  if (/^\d+m$/i.test(first)) {
    return {
      target: "time_window",
      deployId: "",
      minutes: clampInt(first.replace(/m$/i, ""), defaults.minutes ?? 60, 1, 1440),
      limit: clampInt(parts[1], defaults.limit ?? 50, 1, 300),
      userMode: "logs_by_time_window",
    };
  }

  // /render_bridge_logs latest_deploy 50
  if (first === "latest_deploy" || first === "deploy_latest") {
    return {
      target: "latest_deploy",
      deployId: "",
      minutes: defaults.minutes ?? 60,
      limit: clampInt(parts[1], defaults.limit ?? 50, 1, 300),
      userMode: "logs_from_latest_deploy",
    };
  }

  // /render_bridge_logs deploy <deployId> 50
  if (first === "deploy") {
    return {
      target: "deploy",
      deployId: normalizeString(parts[1] || ""),
      minutes: defaults.minutes ?? 60,
      limit: clampInt(parts[2], defaults.limit ?? 50, 1, 300),
      userMode: "logs_from_specific_deploy",
    };
  }

  return {
    target: "latest_count",
    deployId: "",
    minutes: DEFAULT_LATEST_LOOKBACK_MINUTES,
    limit: defaults.limit ?? 50,
    userMode: "last_logs_by_count",
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
  const n = Date.parse(normalizeString(value));
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

async function resolveDeploy({ serviceId, args }) {
  if (args.target === "latest_deploy") {
    const deploys = await renderBridge.listDeploys({
      serviceId,
      limit: 1,
    });
    return deploys[0] || null;
  }

  if (args.target === "deploy") {
    if (!args.deployId) {
      throw new Error("render_bridge_deploy_id_required");
    }

    return renderBridge.getDeploy({
      serviceId,
      deployId: args.deployId,
    });
  }

  return null;
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

    const deploy = await resolveDeploy({
      serviceId: state.selected_service_id,
      args,
    });
    const explicitWindow = deploy ? buildDeployLogWindow(deploy) : null;

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
      `mode=${args.userMode}`,
      `target=${args.target}`,
      `deployId=${deploy?.id || args.deployId || "-"}`,
      `deployStatus=${deploy?.status || "-"}`,
      `deployCommit=${deploy?.commit || "-"}`,
      `deployCreatedAt=${deploy?.createdAt || "-"}`,
      `deployFinishedAt=${deploy?.finishedAt || "-"}`,
      `internalLookbackMinutes=${args.minutes}`,
      `startTime=${explicitWindow?.startTime || "-"}`,
      `endTime=${explicitWindow?.endTime || "-"}`,
      `requested=${args.limit}`,
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
