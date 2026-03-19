// src/bot/handlers/recall.js
// STAGE 8A — RECALL ENGINE (MVP, no embeddings)
// Minimal: date/range + keyword filter over chat_messages
// Logs observability into interaction_logs via src/logging/interactionLogs.js
//
// CONTROLLED WIRING STEP:
// - default scope = local_only
// - supports scope flags: --local / --groups
// - cross-group runtime is NOT enabled yet
// - --groups is monarch-private gated and returns safe controlled response
// - local recall behavior remains unchanged
//
// CONTROLLED BRIDGE STEP:
// - /recall --groups calls dedicated group-source helpers
// - candidate helper may return chat_meta-only safe candidates
// - preview bridge may receive those candidates
// - no cross-group message retrieval is enabled here
//
// CONTROLLED FORMATTER BRIDGE STEP:
// - group flow calls renderGroupSourceRecallCards()
// - renderer works only on anon-card-like structures
// - no author identity / quotes / raw snippets are exposed
//
// CONTROLLED ORCHESTRATION BRIDGE STEP:
// - group flow calls getGroupSourceRecallPreview()
// - preview bridge may pass safe metadata candidates into orchestrator
// - still no chat_messages reads, no RecallEngine cross-group wiring
//
// CONTROLLED RESPONSE ASSEMBLY STEP:
// - group flow delegates final text assembly
//   to buildGroupSourceRecallStubResponse()
// - recall.js keeps orchestration only
// - no real cross-group payload is exposed yet
//
// CONTROLLED PAGING STEP:
// - /recall returns next_cursor for local scope when more rows exist
// - /recall_more <cursor> loads next page for local scope
// - cursor is stateless base64url JSON
// - paging uses created_at + id to avoid duplicate/missing rows
//
// CONTROLLED CURSOR STORE STEP:
// - /recall stores last local next_cursor in in-memory store
// - /recall_more without arg may use stored cursor automatically
// - manual cursor in command args has priority
// - store is per-instance only and may be lost on restart
//
// STAGE 11.14 — dedicated rate-limit for /recall
// IMPORTANT:
// - in-memory / per-instance only
// - NOT global across multi-instance
// - monarch bypass is controlled by env flag
// - dedicated limits for /recall and /recall_more

// pool нужен только для передачи в RecallEngine (не для прямых запросов)
import pool from "../../../db.js";
import { logInteraction } from "../../logging/interactionLogs.js";
import { getRecallEngine } from "../../core/recallEngineFactory.js"; // ✅ 8A + 7.7.2
import { getGroupSourceRecallCandidates } from "../../services/chatMemory/getGroupSourceRecallCandidates.js";
import { renderGroupSourceRecallCards } from "../../services/chatMemory/renderGroupSourceRecallCards.js";
import { getGroupSourceRecallPreview } from "../../services/chatMemory/getGroupSourceRecallPreview.js";
import { buildGroupSourceRecallStubResponse } from "../../services/chatMemory/buildGroupSourceRecallStubResponse.js";
import { checkRateLimit } from "../rateLimiter.js";
import { envIntRange, envStr } from "../../core/config.js";

const RECALL_RL_WINDOW_MS = envIntRange("RECALL_RL_WINDOW_MS", 30000, {
  min: 1000,
  max: 300000,
});

const RECALL_RL_MAX = envIntRange("RECALL_RL_MAX", 5, {
  min: 1,
  max: 50,
});

const RECALL_MORE_RL_WINDOW_MS = envIntRange("RECALL_MORE_RL_WINDOW_MS", 30000, {
  min: 1000,
  max: 300000,
});

const RECALL_MORE_RL_MAX = envIntRange("RECALL_MORE_RL_MAX", 8, {
  min: 1,
  max: 100,
});

const RECALL_RL_BYPASS_MONARCH = ["1", "true", "yes", "on"].includes(
  envStr("RECALL_RL_BYPASS_MONARCH", "true").trim().toLowerCase()
);

// in-memory / per-instance cursor store for local recall paging
const recallCursorStore = new Map();

function safeInt(n, def) {
  const x = Number(n);
  return Number.isFinite(x) ? Math.trunc(x) : def;
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function safeText(s, max = 200) {
  const t = String(s ?? "").trim();
  if (!t) return "";
  return t.length > max ? t.slice(0, max) + "…" : t;
}

function toBase64Url(text) {
  return Buffer.from(String(text ?? ""), "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function fromBase64Url(token) {
  const normalized = String(token ?? "")
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  const padLen = (4 - (normalized.length % 4)) % 4;
  const padded = normalized + "=".repeat(padLen);

  return Buffer.from(padded, "base64").toString("utf8");
}

function buildRecallCursor({
  scope,
  days,
  limit,
  keyword,
  lastCreatedAt,
  lastId,
}) {
  const payload = {
    v: 1,
    s: String(scope || "local_only"),
    d: clamp(safeInt(days, 1), 1, 30),
    l: clamp(safeInt(limit, 5), 1, 20),
    k: safeText(keyword || "", 120),
    t: String(lastCreatedAt || ""),
    i: safeInt(lastId, 0),
  };

  return toBase64Url(JSON.stringify(payload));
}

function parseRecallCursor(cursorRaw) {
  try {
    const raw = String(cursorRaw ?? "").trim();
    if (!raw) return null;

    const decoded = fromBase64Url(raw);
    const parsed = JSON.parse(decoded);

    const scope = String(parsed?.s || "local_only");
    const days = clamp(safeInt(parsed?.d, 1), 1, 30);
    const limit = clamp(safeInt(parsed?.l, 5), 1, 20);
    const keyword = safeText(parsed?.k || "", 120);
    const lastCreatedAt = String(parsed?.t || "").trim();
    const lastId = safeInt(parsed?.i, 0);

    if (!lastCreatedAt || !lastId) {
      return null;
    }

    return {
      scope,
      days,
      limit,
      keyword,
      lastCreatedAt,
      lastId,
    };
  } catch (_) {
    return null;
  }
}

function formatRecallRows(rows = []) {
  const lines = [];

  for (const row of [...rows].reverse()) {
    const role = String(row.role || "").toLowerCase();
    const prefix =
      role === "assistant" ? "A:" : role === "user" ? "U:" : `${role}:`;
    const text = safeText(row.content, 400);
    const ts = row.created_at
      ? new Date(row.created_at).toISOString().slice(0, 16)
      : "";
    lines.push(`${ts} ${prefix} ${text}`.trim());
  }

  return lines;
}

// /recall [keyword]
// /recall --days 1 [keyword]
// /recall --limit 5 [keyword]
// /recall --local [keyword]
// /recall --groups [keyword]
function parseArgs(restRaw) {
  const rest = String(restRaw ?? "").trim();
  const parts = rest ? rest.split(/\s+/) : [];

  let days = 1;
  let limit = 5;
  let scope = "local_only";

  const keywords = [];

  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];

    if (p === "--days" && parts[i + 1]) {
      days = safeInt(parts[i + 1], days);
      i++;
      continue;
    }

    if (p === "--limit" && parts[i + 1]) {
      limit = safeInt(parts[i + 1], limit);
      i++;
      continue;
    }

    if (p === "--groups") {
      scope = "include_groups";
      continue;
    }

    if (p === "--local") {
      scope = "local_only";
      continue;
    }

    keywords.push(p);
  }

  days = clamp(days, 1, 30);
  limit = clamp(limit, 1, 20);

  const keyword = keywords.join(" ").trim();

  return { days, limit, keyword, scope };
}

// /recall_more [cursor]
// /recall_more --groups [cursor]
// /recall_more --local [cursor]
function parseRecallMoreArgs(restRaw) {
  const rest = String(restRaw ?? "").trim();
  const parts = rest ? rest.split(/\s+/) : [];

  let scope = "local_only";
  let cursor = "";

  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];

    if (p === "--groups") {
      scope = "include_groups";
      continue;
    }

    if (p === "--local") {
      scope = "local_only";
      continue;
    }

    if (!cursor) {
      cursor = p;
    }
  }

  return {
    scope,
    cursor: String(cursor || "").trim(),
  };
}

function isPrivateChatCtx(ctx = {}) {
  const chatType =
    ctx?.chatType ||
    ctx?.identityCtx?.chat_type ||
    ctx?.identityCtx?.chatType ||
    null;

  const fromId = String(ctx?.senderIdStr ?? "");
  const effectiveChatIdStr = String(ctx?.chatIdStr ?? ctx?.chatId ?? "");

  return (
    ctx?.isPrivateChat === true ||
    ctx?.identityCtx?.isPrivateChat === true ||
    chatType === "private" ||
    (effectiveChatIdStr && fromId && effectiveChatIdStr === fromId)
  );
}

function buildRecallMoreStubText({ scope, cursor }) {
  const lines = [
    "RECALL MORE: preview_only",
    `scope=${scope}`,
    `cursor=${cursor || "—"}`,
    "paging_enabled=false",
    "reason=scope_aware_stub_only",
    "",
    "No real paging yet.",
    "No cursor store yet.",
    "No cross-group retrieval enabled.",
  ];

  return lines.join("\n");
}

function buildRecallRateLimitKey({
  kind,
  chatIdStr,
  senderIdStr,
  identityCtx,
}) {
  const globalUserId =
    identityCtx?.global_user_id ||
    identityCtx?.globalUserId ||
    null;

  if (globalUserId) {
    return `recall:${kind}:gu:${String(globalUserId)}`;
  }

  if (senderIdStr) {
    return `recall:${kind}:sender:${String(senderIdStr)}`;
  }

  return `recall:${kind}:chat:${String(chatIdStr || "unknown")}`;
}

function buildRecallCursorStoreKey({
  chatIdStr,
  senderIdStr,
  identityCtx,
}) {
  const globalUserId =
    identityCtx?.global_user_id ||
    identityCtx?.globalUserId ||
    null;

  if (globalUserId) {
    return `recall_cursor:gu:${String(globalUserId)}`;
  }

  if (senderIdStr) {
    return `recall_cursor:sender:${String(senderIdStr)}`;
  }

  return `recall_cursor:chat:${String(chatIdStr || "unknown")}`;
}

function setStoredRecallCursor({
  chatIdStr,
  senderIdStr,
  identityCtx,
  cursor,
}) {
  const key = buildRecallCursorStoreKey({
    chatIdStr,
    senderIdStr,
    identityCtx,
  });

  const value = String(cursor || "").trim();

  if (!value) {
    recallCursorStore.delete(key);
    return;
  }

  recallCursorStore.set(key, value);
}

function getStoredRecallCursor({
  chatIdStr,
  senderIdStr,
  identityCtx,
}) {
  const key = buildRecallCursorStoreKey({
    chatIdStr,
    senderIdStr,
    identityCtx,
  });

  return String(recallCursorStore.get(key) || "").trim();
}

function clearStoredRecallCursor({
  chatIdStr,
  senderIdStr,
  identityCtx,
}) {
  const key = buildRecallCursorStoreKey({
    chatIdStr,
    senderIdStr,
    identityCtx,
  });

  recallCursorStore.delete(key);
}

async function applyRecallRateLimit({
  bot,
  chatId,
  chatIdStr,
  senderIdStr,
  identityCtx,
  bypass,
  kind,
}) {
  if (bypass && RECALL_RL_BYPASS_MONARCH) {
    return { allowed: true, retryAfterMs: 0 };
  }

  const key = buildRecallRateLimitKey({
    kind,
    chatIdStr,
    senderIdStr,
    identityCtx,
  });

  const windowMs =
    kind === "recall_more" ? RECALL_MORE_RL_WINDOW_MS : RECALL_RL_WINDOW_MS;

  const max =
    kind === "recall_more" ? RECALL_MORE_RL_MAX : RECALL_RL_MAX;

  const rl = checkRateLimit({
    key,
    windowMs,
    max,
  });

  if (rl.allowed) {
    return rl;
  }

  const sec = Math.max(1, Math.ceil(rl.retryAfterMs / 1000));

  await logInteraction(chatIdStr, {
    taskType: kind === "recall_more" ? "recall_more_rate_limited" : "recall_rate_limited",
    aiCostLevel: "low",
  });

  await bot.sendMessage(
    chatId,
    [
      "⛔ recall_rate_limited",
      `kind=${kind}`,
      `retry_after_sec=${sec}`,
      `window_ms=${windowMs}`,
      `max=${max}`,
    ].join("\n")
  );

  return rl;
}

export async function handleRecall({
  bot,
  chatId,
  chatIdStr,
  rest,
  bypass = false,
  isPrivateChat = false,
  senderIdStr = null,
  chatType = null,
  identityCtx = null,
}) {
  const { days, limit, keyword, scope } = parseArgs(rest);

  const privateChat = isPrivateChatCtx({
    isPrivateChat,
    senderIdStr,
    chatIdStr,
    chatId,
    chatType,
    identityCtx,
  });

  const rl = await applyRecallRateLimit({
    bot,
    chatId,
    chatIdStr,
    senderIdStr,
    identityCtx,
    bypass,
    kind: "recall",
  });

  if (!rl.allowed) {
    return;
  }

  await logInteraction(chatIdStr, {
    taskType: scope === "include_groups" ? "recall_request_groups" : "recall_request",
    aiCostLevel: "low",
  });

  if (scope === "include_groups" && !bypass) {
    await bot.sendMessage(
      chatId,
      [
        "⛔ recall_groups_forbidden",
        "scope=include_groups",
        "reason=monarch_only_initially",
      ].join("\n")
    );
    return;
  }

  if (scope === "include_groups" && !privateChat) {
    await bot.sendMessage(
      chatId,
      [
        "⛔ recall_groups_forbidden",
        "scope=include_groups",
        "reason=private_chat_required",
      ].join("\n")
    );
    return;
  }

  if (scope === "include_groups") {
    try {
      const requestRole = bypass ? "monarch" : "guest";
      const requesterGlobalUserId =
        identityCtx?.global_user_id ||
        identityCtx?.globalUserId ||
        null;

      const candidateResult = await getGroupSourceRecallCandidates({
        role: requestRole,
        requesterChatId: chatIdStr,
        requesterGlobalUserId,
        days,
        limit,
        keyword,
      });

      const safeCandidates = Array.isArray(candidateResult?.candidates)
        ? candidateResult.candidates
        : [];

      const previewResult = await getGroupSourceRecallPreview({
        role: requestRole,
        requesterChatId: chatIdStr,
        requesterGlobalUserId,
        days,
        limit,
        keyword,
        candidates: safeCandidates,
      });

      const renderedResult = renderGroupSourceRecallCards(
        Array.isArray(previewResult?.cards) ? previewResult.cards : []
      );

      const stubResponse = buildGroupSourceRecallStubResponse({
        days,
        limit,
        keyword,
        candidateResult,
        previewResult,
        renderedResult,
      });

      await bot.sendMessage(
        chatId,
        safeText(stubResponse?.text || "RECALL GROUPS: not_enabled_yet", 4000)
      );
      return;
    } catch (e) {
      await logInteraction(chatIdStr, {
        taskType: "recall_error_groups",
        aiCostLevel: "low",
      });

      await bot.sendMessage(
        chatId,
        `⛔ recall_error: ${safeText(e?.message || "unknown", 160)}`
      );
      return;
    }
  }

  try {
    const engine = getRecallEngine({ db: pool, logger: console });
    const page = await engine.searchPage({
      chatId: chatIdStr,
      days,
      limit,
      keyword,
    });

    const rows = Array.isArray(page?.rows) ? page.rows : [];
    const hasMore = page?.hasMore === true;

    if (!rows.length) {
      clearStoredRecallCursor({
        chatIdStr,
        senderIdStr,
        identityCtx,
      });

      await bot.sendMessage(
        chatId,
        [
          "RECALL: пусто",
          `scope=${scope}`,
          `days=${days}`,
          `limit=${limit}`,
          keyword ? `keyword=${safeText(keyword, 80)}` : "",
        ]
          .filter(Boolean)
          .join("\n")
      );
      return;
    }

    const lines = formatRecallRows(rows);

    let nextCursor = "";
    if (hasMore) {
      const lastRow = rows[rows.length - 1];
      nextCursor = buildRecallCursor({
        scope,
        days,
        limit,
        keyword,
        lastCreatedAt: lastRow?.created_at
          ? new Date(lastRow.created_at).toISOString()
          : "",
        lastId: lastRow?.id ?? 0,
      });
    }

    if (hasMore && nextCursor) {
      setStoredRecallCursor({
        chatIdStr,
        senderIdStr,
        identityCtx,
        cursor: nextCursor,
      });
    } else {
      clearStoredRecallCursor({
        chatIdStr,
        senderIdStr,
        identityCtx,
      });
    }

    await bot.sendMessage(
      chatId,
      [
        "RECALL:",
        `scope=${scope}`,
        `days=${days}`,
        `limit=${limit}`,
        keyword ? `keyword=${safeText(keyword, 80)}` : "",
        hasMore && nextCursor ? `next_cursor=${nextCursor}` : "",
        "",
        ...lines,
      ]
        .filter(Boolean)
        .join("\n")
    );
  } catch (e) {
    await logInteraction(chatIdStr, {
      taskType:
        scope === "include_groups" ? "recall_error_groups" : "recall_error",
      aiCostLevel: "low",
    });

    await bot.sendMessage(
      chatId,
      `⛔ recall_error: ${safeText(e?.message || "unknown", 160)}`
    );
  }
}

export async function handleRecallMore({
  bot,
  chatId,
  chatIdStr,
  rest,
  bypass = false,
  isPrivateChat = false,
  senderIdStr = null,
  chatType = null,
  identityCtx = null,
}) {
  const { scope, cursor } = parseRecallMoreArgs(rest);

  const privateChat = isPrivateChatCtx({
    isPrivateChat,
    senderIdStr,
    chatIdStr,
    chatId,
    chatType,
    identityCtx,
  });

  const rl = await applyRecallRateLimit({
    bot,
    chatId,
    chatIdStr,
    senderIdStr,
    identityCtx,
    bypass,
    kind: "recall_more",
  });

  if (!rl.allowed) {
    return;
  }

  await logInteraction(chatIdStr, {
    taskType: scope === "include_groups" ? "recall_more_request_groups" : "recall_more_request",
    aiCostLevel: "low",
  });

  if (scope === "include_groups" && !bypass) {
    await bot.sendMessage(
      chatId,
      [
        "⛔ recall_more_groups_forbidden",
        "scope=include_groups",
        "reason=monarch_only_initially",
      ].join("\n")
    );
    return;
  }

  if (scope === "include_groups" && !privateChat) {
    await bot.sendMessage(
      chatId,
      [
        "⛔ recall_more_groups_forbidden",
        "scope=include_groups",
        "reason=private_chat_required",
      ].join("\n")
    );
    return;
  }

  if (scope === "include_groups") {
    await bot.sendMessage(
      chatId,
      buildRecallMoreStubText({ scope, cursor })
    );
    return;
  }

  const effectiveCursor = String(
    cursor || getStoredRecallCursor({ chatIdStr, senderIdStr, identityCtx }) || ""
  ).trim();

  if (!effectiveCursor) {
    await bot.sendMessage(
      chatId,
      [
        "⛔ recall_more_invalid_cursor",
        "reason=missing_cursor",
      ].join("\n")
    );
    return;
  }

  const parsedCursor = parseRecallCursor(effectiveCursor);

  if (!parsedCursor) {
    await bot.sendMessage(
      chatId,
      [
        "⛔ recall_more_invalid_cursor",
        "reason=decode_failed",
      ].join("\n")
    );
    return;
  }

  if (parsedCursor.scope !== "local_only") {
    await bot.sendMessage(
      chatId,
      [
        "⛔ recall_more_invalid_cursor",
        `scope=${parsedCursor.scope}`,
        "reason=unsupported_scope",
      ].join("\n")
    );
    return;
  }

  try {
    const engine = getRecallEngine({ db: pool, logger: console });
    const page = await engine.searchPage({
      chatId: chatIdStr,
      days: parsedCursor.days,
      limit: parsedCursor.limit,
      keyword: parsedCursor.keyword,
      cursorCreatedAt: parsedCursor.lastCreatedAt,
      cursorId: parsedCursor.lastId,
    });

    const rows = Array.isArray(page?.rows) ? page.rows : [];
    const hasMore = page?.hasMore === true;

    if (!rows.length) {
      clearStoredRecallCursor({
        chatIdStr,
        senderIdStr,
        identityCtx,
      });

      await bot.sendMessage(
        chatId,
        [
          "RECALL MORE: пусто",
          "reason=no_more_results",
          `scope=${parsedCursor.scope}`,
          `days=${parsedCursor.days}`,
          `limit=${parsedCursor.limit}`,
          parsedCursor.keyword
            ? `keyword=${safeText(parsedCursor.keyword, 80)}`
            : "",
        ]
          .filter(Boolean)
          .join("\n")
      );
      return;
    }

    const lines = formatRecallRows(rows);

    let nextCursor = "";
    if (hasMore) {
      const lastRow = rows[rows.length - 1];
      nextCursor = buildRecallCursor({
        scope: parsedCursor.scope,
        days: parsedCursor.days,
        limit: parsedCursor.limit,
        keyword: parsedCursor.keyword,
        lastCreatedAt: lastRow?.created_at
          ? new Date(lastRow.created_at).toISOString()
          : "",
        lastId: lastRow?.id ?? 0,
      });
    }

    if (hasMore && nextCursor) {
      setStoredRecallCursor({
        chatIdStr,
        senderIdStr,
        identityCtx,
        cursor: nextCursor,
      });
    } else {
      clearStoredRecallCursor({
        chatIdStr,
        senderIdStr,
        identityCtx,
      });
    }

    await bot.sendMessage(
      chatId,
      [
        "RECALL MORE:",
        `scope=${parsedCursor.scope}`,
        `days=${parsedCursor.days}`,
        `limit=${parsedCursor.limit}`,
        parsedCursor.keyword
          ? `keyword=${safeText(parsedCursor.keyword, 80)}`
          : "",
        hasMore && nextCursor ? `next_cursor=${nextCursor}` : "",
        "",
        ...lines,
      ]
        .filter(Boolean)
        .join("\n")
    );
  } catch (e) {
    await logInteraction(chatIdStr, {
      taskType: "recall_more_error",
      aiCostLevel: "low",
    });

    await bot.sendMessage(
      chatId,
      `⛔ recall_more_error: ${safeText(e?.message || "unknown", 160)}`
    );
  }
}

export default handleRecall;