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
// CONTROLLED PAGING SKELETON STEP:
// - exports handleRecallMore()
// - preserves scope-aware contract for future paging
// - returns safe stub only
// - no cursor store, no real paging, no cross-group retrieval

// pool нужен только для передачи в RecallEngine (не для прямых запросов)
import pool from "../../../db.js";
import { logInteraction } from "../../logging/interactionLogs.js";
import { getRecallEngine } from "../../core/recallEngineFactory.js"; // ✅ 8A + 7.7.2
import { getGroupSourceRecallCandidates } from "../../services/chatMemory/getGroupSourceRecallCandidates.js";
import { renderGroupSourceRecallCards } from "../../services/chatMemory/renderGroupSourceRecallCards.js";
import { getGroupSourceRecallPreview } from "../../services/chatMemory/getGroupSourceRecallPreview.js";
import { buildGroupSourceRecallStubResponse } from "../../services/chatMemory/buildGroupSourceRecallStubResponse.js";

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
    cursor: safeText(cursor, 120),
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

  // observability: recall request
  await logInteraction(chatIdStr, {
    taskType: scope === "include_groups" ? "recall_request_groups" : "recall_request",
    aiCostLevel: "low",
  });

  // STAGE 8A.10.2 — /recall --groups monarch-only initially
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

  // DEV/private safety:
  // even for monarch, group-scope runtime stays blocked outside private chat for now
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

  // Controlled group-source boundary:
  // parse + gate exists, but real cross-group retrieval is intentionally not enabled yet.
  // This step only wires safe metadata candidates into preview/orchestration.
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
    const rows = await engine.search({ chatId: chatIdStr, days, limit, keyword });

    if (!rows.length) {
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

    const lines = [];

    for (const row of rows.reverse()) {
      const role = String(row.role || "").toLowerCase();
      const prefix =
        role === "assistant" ? "A:" : role === "user" ? "U:" : `${role}:`;
      const text = safeText(row.content, 400);
      const ts = row.created_at
        ? new Date(row.created_at).toISOString().slice(0, 16)
        : "";
      lines.push(`${ts} ${prefix} ${text}`.trim());
    }

    await bot.sendMessage(
      chatId,
      [
        "RECALL:",
        `scope=${scope}`,
        `days=${days}`,
        `limit=${limit}`,
        keyword ? `keyword=${safeText(keyword, 80)}` : "",
        "",
        ...lines,
      ]
        .filter(Boolean)
        .join("\n")
    );
  } catch (e) {
    // observability: recall error
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

  await bot.sendMessage(
    chatId,
    buildRecallMoreStubText({ scope, cursor })
  );
}

export default handleRecall;