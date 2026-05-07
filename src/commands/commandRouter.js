// AGENT NOTE:
// SG 2.0 command router.
// Purpose: route explicit monarch/system commands to registered tasks before AI.
// Do not add provider-specific logic here; task execution must stay in task modules.

import { runGetRenderLogsTask } from "../tasks/render/getRenderLogsTask.js";

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function parseLimit(text, fallback = 100) {
  const match = normalizeString(text).match(/\b(\d{1,4})\b/);
  if (!match) return fallback;

  const n = Number(match[1]);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(1, Math.min(1000, Math.trunc(n)));
}

function isRenderLogsCommand(text) {
  const value = normalizeString(text).toLowerCase();
  if (!value) return false;

  return (
    value.startsWith("/render_logs") ||
    value.startsWith("/render-logs") ||
    value.startsWith("/рендер_логи") ||
    value.includes("render logs") ||
    value.includes("рендер логи") ||
    value.includes("логи render") ||
    value.includes("логи рендер")
  );
}

function buildRenderLogsReply(result) {
  return [
    `Готово. Render logs: ${result.logs_count}.`,
    `Файл: ${result.path}`,
    `Ветка: ${result.write?.branch || "-"}`,
    "Секреты/env values не выводились.",
  ].join("\n");
}

export function canHandleCommand({ text, identity } = {}) {
  if (!identity?.isMonarch) return false;
  return isRenderLogsCommand(text);
}

export async function handleCommand({ text, identity } = {}) {
  if (!identity?.isMonarch) {
    return {
      handled: false,
      ok: false,
      reply: "Команда доступна только монарху.",
      reason: "not_monarch",
    };
  }

  if (isRenderLogsCommand(text)) {
    const result = await runGetRenderLogsTask({
      limit: parseLimit(text, 100),
      target: "garya-bot",
      level: "all",
    });

    return {
      handled: true,
      ok: true,
      reply: buildRenderLogsReply(result),
      task: result,
    };
  }

  return {
    handled: false,
    ok: false,
    reason: "command_not_matched",
  };
}

export default {
  canHandleCommand,
  handleCommand,
};
