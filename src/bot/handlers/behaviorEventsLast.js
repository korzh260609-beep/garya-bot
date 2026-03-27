// ============================================================================
// === src/bot/handlers/behaviorEventsLast.js — show last behavior_events rows
// STAGE 5.16.2 — verification tool (DEV only, monarch-only via router + guard)
// ============================================================================

import pool from "../../../db.js";

async function requireMonarch(bot, chatId, userIdStr) {
  const MONARCH_USER_ID = String(process.env.MONARCH_USER_ID || "").trim();
  if (!MONARCH_USER_ID) return true;

  if (String(userIdStr) !== MONARCH_USER_ID) {
    await bot.sendMessage(chatId, "⛔ Недостаточно прав (monarch-only).");
    return false;
  }

  return true;
}

function parseArgs(rest) {
  const raw = String(rest || "").trim();
  if (!raw) {
    return {
      limit: 5,
      showRaw: false,
    };
  }

  const tokens = raw.split(/\s+/).filter(Boolean);

  let limit = 5;
  let showRaw = false;

  for (const token of tokens) {
    const lower = token.toLowerCase();

    if (lower === "raw") {
      showRaw = true;
      continue;
    }

    const n = Number(token);
    if (Number.isFinite(n)) {
      if (n < 1) limit = 1;
      else if (n > 20) limit = 20;
      else limit = Math.trunc(n);
    }
  }

  return {
    limit,
    showRaw,
  };
}

function safeLine(value, max = 500) {
  const s = value === null || value === undefined ? "" : String(value);
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

function safeJson(value, max = 900) {
  try {
    return safeLine(JSON.stringify(value || {}), max);
  } catch {
    return "{}";
  }
}

function formatKyivTs(d) {
  try {
    const dt = d instanceof Date ? d : new Date(d);
    if (Number.isNaN(dt.getTime())) return "unknown";

    const parts = new Intl.DateTimeFormat("uk-UA", {
      timeZone: "Europe/Kyiv",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).format(dt);

    return `${parts} (Kyiv)`;
  } catch (_) {
    try {
      const dt = d instanceof Date ? d : new Date(d);
      return dt.toISOString() + " (UTC)";
    } catch {
      return "unknown";
    }
  }
}

async function sendChunked(bot, chatId, text) {
  const MAX = 3500;
  const full = String(text || "");

  if (full.length <= MAX) {
    await bot.sendMessage(chatId, full);
    return;
  }

  const lines = full.split("\n");
  let chunk = "";

  for (const line of lines) {
    const candidate = chunk ? chunk + "\n" + line : line;

    if (candidate.length > MAX) {
      if (chunk) {
        await bot.sendMessage(chatId, chunk);
        chunk = line;
      } else {
        await bot.sendMessage(chatId, line.slice(0, MAX - 1) + "…");
        chunk = "";
      }
    } else {
      chunk = candidate;
    }
  }

  if (chunk) {
    await bot.sendMessage(chatId, chunk);
  }
}

function toReadableScalar(value) {
  if (value === null) return "NULL";
  if (value === undefined) return "undefined";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return safeLine(value, 240);

  try {
    return safeLine(JSON.stringify(value), 240);
  } catch {
    return "[unserializable]";
  }
}

function isObjectRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

function formatBehaviorSnapshotCompactLines(metadata, opts = {}) {
  const meta = isObjectRecord(metadata) ? metadata : {};
  const showRaw = Boolean(opts?.showRaw);

  const version = toReadableScalar(meta.behaviorVersion);
  const styleAxis = toReadableScalar(meta.styleAxis);
  const styleAxisSource = toReadableScalar(meta.styleAxisSource);
  const softStyleAskDetected = toReadableScalar(meta.softStyleAskDetected);
  const criticality = toReadableScalar(meta.criticality);
  const criticalitySource = toReadableScalar(meta.criticalitySource);
  const noNodding = toReadableScalar(meta.noNodding);

  const lines = [];
  lines.push("behavior_snapshot:");
  lines.push(`  - version: ${version}`);
  lines.push(
    `  - style: axis=${styleAxis} | source=${styleAxisSource} | softAsk=${softStyleAskDetected}`
  );
  lines.push(
    `  - criticality: level=${criticality} | source=${criticalitySource}`
  );
  lines.push(`  - noNodding: ${noNodding}`);

  const preferredKeys = new Set([
    "behaviorVersion",
    "styleAxis",
    "styleAxisSource",
    "softStyleAskDetected",
    "criticality",
    "criticalitySource",
    "noNodding",
  ]);

  const extraKeys = Object.keys(meta)
    .filter((key) => !preferredKeys.has(key))
    .sort((a, b) => a.localeCompare(b));

  if (extraKeys.length > 0) {
    lines.push("extra_meta:");
    for (const key of extraKeys) {
      lines.push(`  - ${key}: ${toReadableScalar(meta[key])}`);
    }
  }

  if (showRaw) {
    lines.push(`raw: ${safeJson(meta, 1200)}`);
  }

  return lines;
}

function formatMetadataLines(metadata, opts = {}) {
  const meta = isObjectRecord(metadata) ? metadata : {};
  const showRaw = Boolean(opts?.showRaw);

  const preferredOrder = [
    "behaviorVersion",
    "styleAxis",
    "styleAxisSource",
    "softStyleAskDetected",
    "criticality",
    "criticalitySource",
    "noNodding",
    "detectorVersion",
    "reason",
    "replyChars",
    "questionCount",
    "lineCount",
  ];

  const lines = [];
  const seen = new Set();

  for (const key of preferredOrder) {
    if (Object.prototype.hasOwnProperty.call(meta, key)) {
      lines.push(`  - ${key}: ${toReadableScalar(meta[key])}`);
      seen.add(key);
    }
  }

  const restKeys = Object.keys(meta)
    .filter((key) => !seen.has(key))
    .sort((a, b) => a.localeCompare(b));

  for (const key of restKeys) {
    lines.push(`  - ${key}: ${toReadableScalar(meta[key])}`);
  }

  if (lines.length === 0) {
    lines.push("  - (empty)");
  }

  if (showRaw) {
    lines.push(`  - raw: ${safeJson(meta, 1200)}`);
  }

  return lines;
}

function formatEventBlock(r, opts = {}) {
  const at = r?.created_at ? formatKyivTs(r.created_at) : "unknown";
  const eventType = safeLine(r?.event_type || "unknown", 80);
  const g = r?.global_user_id ? String(r.global_user_id) : "NULL";
  const chat = r?.chat_id ? String(r.chat_id) : "NULL";
  const transport = safeLine(r?.transport || "unknown", 20);
  const schemaVersion =
    r?.schema_version === null || r?.schema_version === undefined
      ? "NULL"
      : String(r.schema_version);

  const block = [];
  block.push(`#${r.id} | ${eventType}`);
  block.push(`time: ${at}`);
  block.push(
    `scope: g=${g} | chat=${chat} | transport=${transport} | schema=${schemaVersion}`
  );

  if (eventType === "behavior_snapshot_used") {
    block.push(...formatBehaviorSnapshotCompactLines(r?.metadata, opts));
    return block.join("\n");
  }

  block.push("meta:");
  block.push(...formatMetadataLines(r?.metadata, opts));

  return block.join("\n");
}

export async function handleBehaviorEventsLast({
  bot,
  chatId,
  rest,
  senderIdStr,
}) {
  const effectiveUserIdStr = senderIdStr ? String(senderIdStr) : String(chatId);
  const ok = await requireMonarch(bot, chatId, effectiveUserIdStr);
  if (!ok) return;

  const { limit, showRaw } = parseArgs(rest);

  try {
    const res = await pool.query(
      `
      SELECT
        id,
        created_at,
        event_type,
        global_user_id,
        chat_id,
        transport,
        schema_version,
        metadata
      FROM behavior_events
      ORDER BY id DESC
      LIMIT $1
      `,
      [limit]
    );

    const rows = res?.rows || [];

    if (rows.length === 0) {
      await sendChunked(bot, chatId, `behavior_events (n=${limit})\n(no records)`);
      return;
    }

    const blocks = [];
    blocks.push(
      `behavior_events (last ${rows.length}${showRaw ? ", raw=on" : ""})`
    );

    for (const r of rows) {
      blocks.push("");
      blocks.push(formatEventBlock(r, { showRaw }));
    }

    await sendChunked(bot, chatId, blocks.join("\n"));
  } catch (e) {
    console.error("❌ handleBehaviorEventsLast failed:", e);

    const msg = `behavior_events\n⚠️ cannot read behavior_events (${safeLine(
      e?.message || "unknown error",
      180
    )})`;

    try {
      await sendChunked(bot, chatId, msg);
    } catch (_) {
      // avoid crash loop
    }
  }
}