// AGENT NOTE:
// SG 2.0 Render logs task.
// Purpose: collect N Render logs and publish the sanitized result to the runtime workspace.
// Do not add Telegram parsing, AI calls, polling, deploys, restarts, or env mutation here.

import workspaceChannel from "../../runtime/workspace/workspaceChannel.js";
import { collectLatestRenderLogs } from "../../integrations/render/renderLatestLogs.js";

const LATEST_RENDER_LOGS_PATH = "runtime/render/latest/latest-render-logs.json";
const MAX_LOG_LIMIT = 1000;

function clampLimit(value, fallback = 100) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(1, Math.min(MAX_LOG_LIMIT, Math.trunc(n)));
}

export async function runGetRenderLogsTask({ limit = 100, target = "garya-bot", level = "all" } = {}) {
  const safeLimit = clampLimit(limit, 100);
  const data = await collectLatestRenderLogs({
    limit: safeLimit,
    target,
    level,
  });

  const write = await workspaceChannel.writeJson(LATEST_RENDER_LOGS_PATH, data, {
    message: `render logs: update latest ${data.logs_count || 0}`,
  });

  return {
    ok: true,
    type: "get_render_logs",
    path: LATEST_RENDER_LOGS_PATH,
    logs_count: data.logs_count,
    service: data.service,
    write,
  };
}

export default {
  runGetRenderLogsTask,
};
