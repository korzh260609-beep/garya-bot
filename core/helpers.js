// ============================================================================
// === core/helpers.js — чистые helpers (без DB/bot/env) ===
// ============================================================================

/**
 * Парсер команд Telegram:
 * - cmd: "/pm_set"
 * - rest: "roadmap\n...." (сохраняем переносы строк)
 */
function parseCommand(text) {
  if (!text) return null;
  const m = text.match(/^\/(\S+)(?:\s+([\s\S]+))?$/);
  if (!m) return null;
  return { cmd: `/${m[1]}`, rest: (m[2] || "").trim() };
}

function firstWordAndRest(rest) {
  if (!rest) return { first: "", tail: "" };
  const m = rest.match(/^(\S+)(?:\s+([\s\S]+))?$/);
  return { first: (m?.[1] || "").trim(), tail: (m?.[2] || "").trim() };
}

async function callWithFallback(fn, variants) {
  let lastErr = null;
  for (const args of variants) {
    try {
      // eslint-disable-next-line no-await-in-loop
      return await fn(...args);
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error("callWithFallback failed");
}

// === 7.10 helpers: task ownership + stop permissions (V1) ===
function isOwnerTaskRow(taskRow, chatIdStr) {
  const owner = (taskRow?.user_chat_id ?? "").toString();
  return owner === chatIdStr.toString();
}

function canStopTaskV1({ userRole, bypass, taskType, isOwner }) {
  if (bypass) return true;
  if (!isOwner) return false;

  if ((userRole || "guest").toLowerCase() === "guest") {
    // V1 правило: гость не может останавливать price_monitor
    if (taskType === "price_monitor") return false;
    return true;
  }

  return true;
}

// === role-safety helper: sanitize AI reply for non-monarch users ===
function sanitizeNonMonarchReply(text) {
  const t = String(text || "");
  if (!t) return t;

  let out = t;

  // точечные удаления монарших обращений
  out = out.replace(/Мой\s+Монарх[!)]*/gi, "");
  out = out.replace(/Ваше\s+Величество[!)]*/gi, "");
  out = out.replace(/Государ[ь-я]*\s+GARY[!)]*/gi, "");
  out = out.replace(/Монарх\s+GARY[!)]*/gi, "");
  out = out.replace(/Ваше\s+Величество\s+Монарх\s+GARY[!)]*/gi, "");

  // выкидываем строки с утверждениями про монарха
  const lines = out.split("\n");
  const filtered = lines.filter((line) => {
    const s = String(line || "").toLowerCase();
    if (!s.trim()) return true;
    if (s.includes("только один монарх")) return false;
    if (s.includes("вы — монарх")) return false;
    if (s.includes("вы - монарх")) return false;
    if (s.includes("мой монарх")) return false;
    if (s.includes("ваше величество")) return false;
    if (s.includes("государь gary")) return false;
    if (s.includes("монарх gary")) return false;
    return true;
  });

  out = filtered.join("\n").trim();

  // если после чистки пусто — нейтральный ответ
  if (!out) return "Вы гость в этом чате. Чем помочь?";
  return out;
}

/**
 * Health check and diagnostic function
 * @returns {object} System status information
 */
function getSystemHealth() {
  const uptime = process.uptime();
  const memoryUsage = process.memoryUsage();

  const uptimeMinutes = Math.floor(uptime / 60);
  const uptimeSeconds = Math.floor(uptime % 60);
  const heapUsedMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);
  const heapTotalMB = Math.round(memoryUsage.heapTotal / 1024 / 1024);

  return {
    status: "operational",
    uptime: `${uptimeMinutes}m ${uptimeSeconds}s`,
    memory: {
      heapUsed: `${heapUsedMB}MB`,
      heapTotal: `${heapTotalMB}MB`,
    },
    timestamp: new Date().toISOString(),
  };
}

export {
  parseCommand,
  firstWordAndRest,
  callWithFallback,
  isOwnerTaskRow,
  canStopTaskV1,
  sanitizeNonMonarchReply,
  getSystemHealth,
};

