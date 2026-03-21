// src/bot/handlers/chat.js
// extracted from messageRouter.js — no logic changes (only safety-guards + token param fix + observability logs)
//
// STAGE 7.2 LOGIC: pass globalUserId to chat_memory (v2 columns)
// STAGE 7 (Integrity hardening): ensure assistant replies are also saved on early-return branches
// (timezone/deterministic/guards), otherwise /memory_integrity shows missing_assistant.
//
// ✅ STAGE 7B (this patch): early-return replies + AlreadySeen hint also logged into chat_messages (assistant)
//
// ✅ STAGE 10.6 wiring:
// - SourceService may now perform first real source fetch (CoinGecko simple price)
// - fetched source result is injected into AI context only when sourceResult.ok=true
// - behavior remains fail-open: if source fails, chat still works
// - no hard source-blocking yet
//
// ✅ STAGE 10.6.x narrow robot-layer price reply:
// - for simple price intents only
// - uses sourceResult.meta.parsed directly
// - bypasses AI call when deterministic source reply is available
// - keeps fail-open behavior and does not affect non-price requests
//
// ✅ STAGE 10.6.x debug:
// - logs requestedCoinIds / requestedVs / parsed keys
// - helps diagnose why multi-coin robot reply may not trigger
//
// ✅ STAGE 11+ memory prompt bridge prep:
// - bridge is read-prepared but NOT activated into AI prompt by default
// - no response-flow change yet
// - activation must be a separate explicit step

import pool from "../../../db.js";
import { insertAssistantMessage } from "../../db/chatMessagesRepo.js"; // ✅ STAGE 7.7.2
import { getMemoryService } from "../../core/memoryServiceFactory.js";
import { getRecallEngine } from "../../core/recallEngineFactory.js";
import { getAlreadySeenDetector } from "../../core/alreadySeenFactory.js";
import { createTimeContext } from "../../core/time/timeContextFactory.js";
import { isTimeNowIntent } from "../../core/time/timeNowIntent.js";
import { isCurrentDateIntent } from "../../core/time/currentDateIntent.js";
import { touchChatMeta } from "../../db/chatMeta.js";
import { redactText, sha256Text } from "../../core/redaction.js";
import { getUserTimezone, setUserTimezone } from "../../db/userSettings.js";
import BehaviorEventsService from "../../logging/BehaviorEventsService.js";
import { runDecisionShadowHook } from "../../decision/decisionShadowHook.js";
import { routeDecision } from "../../decision/index.js";
import {
  resolveSourceContext,
  buildSourceServiceDebugBlock,
} from "../../sources/sourceService.js";
import buildLongTermMemoryPromptBridge from "../../core/buildLongTermMemoryPromptBridge.js";

function normalizeAlreadySeenRole(value) {
  const role = String(value || "").trim().toLowerCase();
  if (role === "monarch") return "monarch";
  if (role === "vip") return "vip";
  if (role === "citizen") return "citizen";
  return "guest";
}

function normalizeTextForRobot(value) {
  return typeof value === "string" ? value.trim() : "";
}

function detectRequestedCoinIdsFromText(text = "") {
  const t = normalizeTextForRobot(text).toLowerCase();
  if (!t) return [];

  const found = [];

  const rules = [
    { id: "bitcoin", label: "BTC", signals: ["bitcoin", "btc", "биткоин", "біткоїн"] },
    { id: "ethereum", label: "ETH", signals: ["ethereum", "eth", "эфир", "ефир", "ефір"] },
    { id: "binancecoin", label: "BNB", signals: ["binance", "bnb"] },
    { id: "solana", label: "SOL", signals: ["solana", "sol"] },
    { id: "ripple", label: "XRP", signals: ["ripple", "xrp"] },
    { id: "toncoin", label: "TON", signals: ["toncoin", "ton"] },
    { id: "avalanche-2", label: "AVAX", signals: ["avalanche", "avax"] },
    { id: "aptos", label: "APT", signals: ["aptos", "apt"] },
    { id: "hedera-hashgraph", label: "HBAR", signals: ["hedera", "hbar"] },
    { id: "ondo-finance", label: "ONDO", signals: ["ondo"] },
    { id: "sei-network", label: "SEI", signals: ["sei"] },
    { id: "sui", label: "SUI", signals: ["sui"] },
    { id: "tether", label: "USDT", signals: ["tether", "usdt"] },
  ];

  for (const rule of rules) {
    if (rule.signals.some((signal) => t.includes(signal))) {
      found.push(rule.id);
    }
  }

  return [...new Set(found)];
}

function getCoinLabel(coinId) {
  const map = {
    bitcoin: "BTC",
    ethereum: "ETH",
    binancecoin: "BNB",
    solana: "SOL",
    ripple: "XRP",
    toncoin: "TON",
    "avalanche-2": "AVAX",
    aptos: "APT",
    "hedera-hashgraph": "HBAR",
    "ondo-finance": "ONDO",
    "sei-network": "SEI",
    sui: "SUI",
    tether: "USDT",
  };

  return map[String(coinId || "").trim().toLowerCase()] || String(coinId || "").trim().toUpperCase();
}

function detectRequestedVsCurrenciesFromText(text = "") {
  const t = normalizeTextForRobot(text).toLowerCase();
  if (!t) return [];

  const found = [];

  if (t.includes("usd") || t.includes("доллар") || t.includes("долар") || t.includes("usdt")) {
    found.push("usd");
  }
  if (t.includes("eur") || t.includes("euro") || t.includes("евро") || t.includes("євро")) {
    found.push("eur");
  }
  if (t.includes("uah") || t.includes("грн") || t.includes("hryvnia")) {
    found.push("uah");
  }

  return [...new Set(found)];
}

function isSimplePriceIntent(text = "") {
  const t = normalizeTextForRobot(text).toLowerCase();
  if (!t) return false;

  const priceSignals = [
    "цена",
    "курс",
    "сколько стоит",
    "скільки коштує",
    "price",
    "cost",
    "worth",
    "сколько сейчас",
    "скільки зараз",
  ];

  const complexSignals = [
    "почему",
    "чому",
    "why",
    "прогноз",
    "forecast",
    "predict",
    "анализ",
    "analysis",
    "разбор",
    "trend",
    "тренд",
    "новости",
    "news",
    "график",
    "chart",
    "индикатор",
    "indicator",
    "support",
    "resistance",
    "сопротивление",
    "поддержка",
    "buy",
    "sell",
    "лонг",
    "шорт",
    "entry",
    "sl",
    "tp",
    "сигнал",
    "signal",
    "сравни",
    "compare",
    "vs",
    "против",
    "лучше",
    "хуже",
    "капитализация",
    "market cap",
    "volume",
    "объем",
    "объём",
  ];

  if (complexSignals.some((signal) => t.includes(signal))) {
    return false;
  }

  const hasCoin = detectRequestedCoinIdsFromText(t).length > 0;
  const hasPriceWord = priceSignals.some((signal) => t.includes(signal));

  if (!hasCoin) return false;

  if (hasPriceWord) return true;

  const compactCoinOnly = /^[a-zа-яіїє0-9\s?,.!/-]{1,40}$/i.test(t);
  return compactCoinOnly;
}

function formatRobotNumber(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "n/a";

  if (Math.abs(value) >= 1000) {
    return new Intl.NumberFormat("en-US", {
      maximumFractionDigits: 2,
    }).format(value);
  }

  if (Math.abs(value) >= 1) {
    return new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  }

  if (Math.abs(value) >= 0.01) {
    return new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 4,
      maximumFractionDigits: 4,
    }).format(value);
  }

  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 6,
    maximumFractionDigits: 8,
  }).format(value);
}

function formatRobotPercent(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

function formatRobotUpdatedAt(value) {
  if (!value) return null;

  try {
    const date =
      typeof value === "number" && Number.isFinite(value)
        ? new Date(value * 1000)
        : new Date(value);

    if (Number.isNaN(date.getTime())) return null;
    return date.toISOString().replace("T", " ").replace(".000Z", " UTC");
  } catch (_) {
    return null;
  }
}

function tryBuildRobotPriceReply({ text = "", sourceCtx = null }) {
  const simpleIntent = isSimplePriceIntent(text);

  const parsed = sourceCtx?.sourceResult?.meta?.parsed;
  const parsedKeys =
    parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? Object.keys(parsed)
      : [];

  const requestedCoinIds = detectRequestedCoinIdsFromText(text);
  const requestedVs = detectRequestedVsCurrenciesFromText(text);

  try {
    console.info("ROBOT_PRICE_DEBUG_INPUT", {
      text,
      simpleIntent,
      sourceResultOk: sourceCtx?.sourceResult?.ok === true,
      sourceResultKey: sourceCtx?.sourceResult?.sourceKey || null,
      requestedCoinIds,
      requestedVs,
      parsedKeys,
      fetchedAt: sourceCtx?.sourceResult?.fetchedAt || null,
      reason: sourceCtx?.reason || null,
    });
  } catch (_) {}

  if (!simpleIntent) {
    try {
      console.info("ROBOT_PRICE_DEBUG_SKIP", {
        reason: "not_simple_price_intent",
        text,
      });
    } catch (_) {}
    return null;
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    try {
      console.info("ROBOT_PRICE_DEBUG_SKIP", {
        reason: "parsed_missing_or_invalid",
        hasParsed: Boolean(parsed),
        parsedType: Array.isArray(parsed) ? "array" : typeof parsed,
      });
    } catch (_) {}
    return null;
  }

  if (sourceCtx?.sourceResult?.ok !== true) {
    try {
      console.info("ROBOT_PRICE_DEBUG_SKIP", {
        reason: "source_result_not_ok",
        sourceResultOk: sourceCtx?.sourceResult?.ok === true,
        sourceReason: sourceCtx?.reason || null,
      });
    } catch (_) {}
    return null;
  }

  if (!requestedCoinIds.length) {
    try {
      console.info("ROBOT_PRICE_DEBUG_SKIP", {
        reason: "no_requested_coin_ids",
      });
    } catch (_) {}
    return null;
  }

  const lines = [];
  let builtCount = 0;
  let updatedAtText = null;

  for (const coinId of requestedCoinIds) {
    const coinBlock = parsed?.[coinId];

    try {
      console.info("ROBOT_PRICE_DEBUG_COIN", {
        coinId,
        existsInParsed: Boolean(coinBlock),
        availableKeys: coinBlock && typeof coinBlock === "object" ? Object.keys(coinBlock) : [],
      });
    } catch (_) {}

    if (!coinBlock || typeof coinBlock !== "object") continue;

    const availableVs = Object.keys(coinBlock).filter((key) => key !== "lastUpdatedAt");
    if (!availableVs.length) continue;

    const chosenVs =
      requestedVs.length > 0
        ? requestedVs.filter((vs) => availableVs.includes(vs))
        : [availableVs[0]];

    try {
      console.info("ROBOT_PRICE_DEBUG_VS", {
        coinId,
        availableVs,
        requestedVs,
        chosenVs,
      });
    } catch (_) {}

    if (!chosenVs.length) continue;

    const coinLabel = getCoinLabel(coinId);

    for (const vs of chosenVs) {
      const row = coinBlock?.[vs];
      if (!row || typeof row !== "object") continue;

      const price = formatRobotNumber(row.price);
      const change = formatRobotPercent(row.change24h);
      const changePart = change ? ` | 24ч: ${change}` : "";

      lines.push(`${coinLabel}: ${price} ${vs.toUpperCase()}${changePart}`);
      builtCount += 1;
    }

    if (!updatedAtText) {
      updatedAtText = formatRobotUpdatedAt(coinBlock?.lastUpdatedAt || sourceCtx?.sourceResult?.fetchedAt);
    }
  }

  if (builtCount === 0) {
    try {
      console.info("ROBOT_PRICE_DEBUG_SKIP", {
        reason: "built_count_zero",
        requestedCoinIds,
        requestedVs,
        parsedKeys,
      });
    } catch (_) {}
    return null;
  }

  if (updatedAtText) {
    lines.push(`Обновлено: ${updatedAtText}`);
  }

  const reply = lines.join("\n");

  try {
    console.info("ROBOT_PRICE_DEBUG_SUCCESS", {
      builtCount,
      reply,
    });
  } catch (_) {}

  return reply;
}

export async function handleChatMessage({
  bot,
  msg,
  chatId,
  chatIdStr,
  senderIdStr,
  trimmed,
  bypass,
  MAX_HISTORY_MESSAGES = 20,

  //  STAGE 7.2
  globalUserId = null,
  userRole = "guest",

  FileIntake,

  saveMessageToMemory,
  getChatHistory,
  saveChatPair,

  logInteraction,

  loadProjectContext,
  getAnswerMode,
  buildSystemPrompt,
  isMonarch,

  callAI,
  sanitizeNonMonarchReply,
}) {
  const messageId = msg.message_id ?? null;
  if (!trimmed) return;

  // STAGE 7B.5.x — Free-tier DB growth protection (hard cap)
  const MAX_CHAT_MESSAGE_CHARS = 16000;

  // ---- GUARDS (critical): never crash on wrong wiring ----
  const isMonarchFn = typeof isMonarch === "function" ? isMonarch : () => false;
  const monarchNow = isMonarchFn(senderIdStr);

  // ==========================================================
  // STAGE 7.7 Gate — MemoryService ONLY (handlers must not call chat_memory directly)
  // Fail-open: if MemoryService not available/disabled, fall back to injected functions.
  // ==========================================================
  const memory = getMemoryService ? getMemoryService() : null;

  // STAGE 7B — CHAT HANDLER MEMORY BRIDGE NOTE
  // IMPORTANT:
  // - memoryWrite(...) and memoryWritePair(...) below are runtime helper bridges only
  // - they are NOT authoritative inbound storage semantics
  // - Core storage-facing inbound authority remains:
  //   src/core/handleMessage.js -> buildInboundStorageText(...)
  // - AI-facing media/text authority remains:
  //   FileIntake.buildEffectiveUserTextAndDecision(...)
  // - do NOT unify these helpers with buildInboundChatPayload.js in this step
  //
  // VERIFIED BOUNDARY FOR THIS HANDLER:
  // - this file consumes AI-facing semantics only
  // - this file does NOT own canonical inbound storage normalization
  // - this file may save AI-facing values into memory for chat continuity,
  //   but that does NOT promote those values into storage authority
  // - “same inbound message” may legitimately have:
  //   1) one storage-facing representation in Core
  //   2) another AI-facing representation here
  // - that split is currently intentional and must remain explicit

  const memoryWrite = async ({ role, content, transport, metadata, schemaVersion }) => {
    try {
      if (memory && typeof memory.write === "function") {
        return await memory.write({
          chatId: chatIdStr,
          globalUserId,
          role,
          content: typeof content === "string" ? content : String(content || ""),
          transport: transport || "telegram",
          metadata: metadata || {},
          schemaVersion: schemaVersion || 2,
        });
      }
    } catch (e) {
      console.error("ERROR MemoryService.write failed (fail-open):", e);
    }

    // fallback (legacy injection)
    try {
      if (typeof saveMessageToMemory === "function") {
        return await saveMessageToMemory(chatIdStr, role, content, {
          globalUserId,
          transport: transport || "telegram",
          metadata: metadata || {},
          schemaVersion: schemaVersion || 2,
        });
      }
    } catch (e) {
      console.error("ERROR saveMessageToMemory fallback failed (fail-open):", e);
    }

    return { ok: true, stored: false, reason: "memory_write_fail_open" };
  };

  const memoryWritePair = async ({ userText, assistantText, transport, metadata, schemaVersion }) => {
    try {
      if (memory && typeof memory.writePair === "function") {
        return await memory.writePair({
          chatId: chatIdStr,
          globalUserId,
          userText: typeof userText === "string" ? userText : String(userText || ""),
          assistantText:
            typeof assistantText === "string" ? assistantText : String(assistantText || ""),
          transport: transport || "telegram",
          metadata: metadata || {},
          schemaVersion: schemaVersion || 2,
        });
      }
    } catch (e) {
      console.error("ERROR MemoryService.writePair failed (fail-open):", e);
    }

    // fallback (legacy injection)
    try {
      if (typeof saveChatPair === "function") {
        return await saveChatPair(chatIdStr, userText, assistantText, {
          globalUserId,
          transport: transport || "telegram",
          metadata: metadata || {},
          schemaVersion: schemaVersion || 2,
        });
      }
    } catch (e) {
      console.error("ERROR saveChatPair fallback failed (fail-open):", e);
    }

    return { ok: true, stored: false, reason: "memory_writePair_fail_open" };
  };

  if (typeof callAI !== "function") {
    const details =
      "callAI is not a function (router wiring error: pass { callAI } into handleChatMessage).";
    let text = "ERROR: Ошибка вызова ИИ.";
    if (monarchNow) {
      text = "ERROR: Ошибка конфигурации: " + details;
    }

    try {
      await bot.sendMessage(chatId, text);
    } catch (e) {
      console.error("ERROR Telegram send error (callAI guard):", e);
    }
    return;
  }
  // --------------------------------------------

  const summarizeMediaAttachment =
    typeof FileIntake?.summarizeMediaAttachment === "function"
      ? FileIntake.summarizeMediaAttachment
      : () => null;

  const mediaSummary = summarizeMediaAttachment(msg);

  // ==========================================================
  // STAGE 7B — CURRENT AI-FACING AUTHORITY
  // IMPORTANT:
  // - runtime AI/media decision semantics remain authoritative in FileIntake
  // - do NOT switch this handler to buildInboundChatPayload.js yet
  // - unified inbound contract exists only as skeleton:
  //   src/services/chatMemory/buildInboundChatPayload.js
  // - migration must be explicit and separate from this comment-only step
  // ==========================================================
  const decisionFn =
    typeof FileIntake?.buildEffectiveUserTextAndDecision === "function"
      ? FileIntake.buildEffectiveUserTextAndDecision
      : null;

  const decision = decisionFn
    ? decisionFn(trimmed, mediaSummary)
    : {
        effectiveUserText: trimmed,
        shouldCallAI: Boolean(trimmed),
        directReplyText: Boolean(trimmed) ? null : "Напиши текстом, что нужно сделать.",
      };

  const effective = (decision?.effectiveUserText || "").trim();
  const shouldCallAI = Boolean(decision?.shouldCallAI);
  const directReplyText = decision?.directReplyText || null;

  // ==========================================================
  // STAGE 10.6 — SourceService (fail-open)
  // IMPORTANT:
  // - may perform first real fetch via SourceService
  // - fetched result is optional
  // - chat must continue working even if source fails
  // ==========================================================
  let sourceCtx = null;
  let sourceServiceDebugBlock = "";

  try {
    sourceCtx = await resolveSourceContext({
      text: effective,
      sourceResult: null,
      sourceKey: null,
      requireSource: false,
      allowedSourceKeys: [],
    });

    sourceServiceDebugBlock = buildSourceServiceDebugBlock({
      text: effective,
      sourceResult: null,
      sourceKey: null,
      requireSource: false,
      allowedSourceKeys: [],
    });
  } catch (e) {
    console.error("ERROR sourceService resolve failed (fail-open):", e);
    sourceCtx = {
      version: "10.6-skeleton-v1",
      ok: false,
      usedExistingSourceResult: false,
      shouldUseSourceResult: false,
      shouldRequireSourceResult: false,
      sourceRuntime: {
        decision: "skip",
        needsSource: false,
        reason: "source_service_fail_open",
      },
      sourcePlan: {
        decision: "noop",
        reason: "source_service_fail_open",
      },
      sourceResult: {
        ok: false,
        sourceKey: null,
        content: "",
        fetchedAt: null,
        meta: {
          reason: "source_service_fail_open",
        },
      },
      reason: "source_service_fail_open",
    };

    sourceServiceDebugBlock = [
      "SOURCE SERVICE:",
      "- version: 10.6-skeleton-v1",
      "- decision: noop",
      "- should_fetch: false",
      "- source_definition_found: false",
      "- source_definition_key: none",
      "- runtime_decision: skip",
      "- runtime_needs_source: false",
      "- reason: source_service_fail_open",
    ].join("\n");
  }

  const sourceContextText =
    sourceCtx?.shouldUseSourceResult === true &&
    sourceCtx?.sourceResult?.ok === true &&
    typeof sourceCtx?.sourceResult?.content === "string" &&
    sourceCtx.sourceResult.content.trim()
      ? sourceCtx.sourceResult.content.trim()
      : "";

  const sourceResultSystemMessage = sourceContextText
    ? {
        role: "system",
        content:
          `SOURCE RESULT (verified runtime data):\n` +
          `- source_key: ${sourceCtx?.sourceResult?.sourceKey || "unknown"}\n` +
          `- fetched_at: ${sourceCtx?.sourceResult?.fetchedAt || "unknown"}\n` +
          `- use this as factual runtime context when relevant\n\n` +
          `${sourceContextText}`,
      }
    : null;

  // ==========================================================
  // STAGE 11+ — long-term memory bridge PREP (disabled by default)
  // IMPORTANT:
  // - helper is called/read-prepared only
  // - result is NOT injected into messages unless explicitly enabled later
  // - keeps response flow unchanged for now
  // ==========================================================
  let longTermMemoryBridgeResult = null;
  let longTermMemorySystemMessage = null;

  try {
    longTermMemoryBridgeResult = await buildLongTermMemoryPromptBridge({
      chatId: chatIdStr,
      globalUserId,
      rememberTypes: [],
      rememberKeys: [],
      perTypeLimit: 3,
      perKeyLimit: 3,
      totalLimit: 8,
      header: "LONG_TERM_MEMORY",
      maxItems: 8,
      maxValueLength: 180,
      memoryService: memory,
    });

    // IMPORTANT:
    // do NOT activate yet.
    // This message stays null until a separate explicit step enables it.
    if (false && longTermMemoryBridgeResult?.ok === true && longTermMemoryBridgeResult?.block) {
      longTermMemorySystemMessage = {
        role: "system",
        content:
          `LONG-TERM MEMORY (deterministic selected context):\n` +
          `${longTermMemoryBridgeResult.block}`,
      };
    }
  } catch (e) {
    console.error("ERROR long-term memory bridge prep failed (fail-open):", e);
    longTermMemoryBridgeResult = null;
    longTermMemorySystemMessage = null;
  }

  // ==========================================================
  // STAGE 7 — helper: store assistant reply on early-return branches
  // ==========================================================
  const saveAssistantEarlyReturn = async (text, reason = "early_return") => {
    try {
      const replyText = typeof text === "string" ? text : String(text || "");
      if (!replyText.trim()) return;

      try {
        const transport = "telegram";
        const chatType = msg?.chat?.type || null;

        const assistantRedactedFull = redactText(replyText);
        const assistantTextHash = sha256Text(assistantRedactedFull);

        const assistantContentForDb =
          typeof assistantRedactedFull === "string" && assistantRedactedFull.length > MAX_CHAT_MESSAGE_CHARS
            ? assistantRedactedFull.slice(0, MAX_CHAT_MESSAGE_CHARS)
            : typeof assistantRedactedFull === "string"
              ? assistantRedactedFull
              : "";

        const assistantTruncatedForDb =
          typeof assistantRedactedFull === "string" && assistantRedactedFull.length > MAX_CHAT_MESSAGE_CHARS;

        await insertAssistantMessage({
          transport,
          chatId: chatIdStr,
          chatType,
          globalUserId: globalUserId || null,
          textHash: assistantTextHash,
          content: assistantContentForDb,
          truncated: Boolean(assistantTruncatedForDb),
          metadata: {
            senderIdStr,
            chatIdStr,
            in_reply_to_message_id: messageId ?? null,
            globalUserId: globalUserId ?? null,
            handler: "chat",
            earlyReturn: true,
            reason,
            stage: "7B.early_return",
          },
          schemaVersion: 1,
        });
      } catch (e) {
        console.error("ERROR STAGE 7B early-return assistant insert failed (fail-open):", e);
      }

      await memoryWrite({
        role: "assistant",
        content: replyText,
        transport: "telegram",
        metadata: {
          senderIdStr,
          chatIdStr,
          messageId,
          earlyReturn: true,
          reason,
        },
        schemaVersion: 2,
      });
    } catch (e) {
      console.error("ERROR saveAssistantEarlyReturn error:", e);
    }
  };

  if (directReplyText) {
    try {
      await saveAssistantEarlyReturn(directReplyText, "directReplyText");
      await bot.sendMessage(chatId, directReplyText);
    } catch (e) {
      console.error("ERROR Telegram send error (directReplyText):", e);
    }
    return;
  }

  if (!shouldCallAI) {
    const text = "Напиши текстом, что нужно сделать.";
    try {
      await saveAssistantEarlyReturn(text, "shouldCallAI_false");
      await bot.sendMessage(chatId, text);
    } catch (e) {
      console.error("ERROR Telegram send error (shouldCallAI):", e);
    }
    return;
  }

  try {
    await memoryWrite({
      role: "user",
      content: effective,
      transport: "telegram",
      metadata: { senderIdStr, chatIdStr, messageId },
      schemaVersion: 2,
    });
  } catch (e) {
    console.error("ERROR memoryWrite(user) error:", e);
  }

  // ==========================================================
  // STAGE 10.6.x — narrow deterministic robot reply for simple prices
  // IMPORTANT:
  // - only for simple price intents
  // - only when real source parsed data exists
  // - no AI call for this path
  // ==========================================================
  try {
    const robotPriceReply = tryBuildRobotPriceReply({
      text: effective,
      sourceCtx,
    });

    try {
      console.info("ROBOT_PRICE_DEBUG_RESULT", {
        matched: Boolean(robotPriceReply),
        reply: robotPriceReply || null,
      });
    } catch (_) {}

    if (robotPriceReply) {
      await saveAssistantEarlyReturn(robotPriceReply, "robot_price_reply");
      await bot.sendMessage(chatId, robotPriceReply);
      return;
    }
  } catch (e) {
    console.error("ERROR robot price reply failed (fail-open):", e);
  }

  let history = [];
  try {
    const memoryLocal = getMemoryService();
    history = await memoryLocal.recent({
      chatId: chatIdStr,
      globalUserId,
      limit: MAX_HISTORY_MESSAGES,
    });
  } catch (e) {
    console.error("ERROR memory.recent error:", e);
  }

  const classification = { taskType: "chat", aiCostLevel: "low" };
  try {
    await logInteraction(chatIdStr, classification);
  } catch (e) {
    console.error("ERROR logInteraction error:", e);
  }

  let projectCtx = "";
  try {
    projectCtx = await loadProjectContext();
  } catch (e) {
    console.error("ERROR loadProjectContext error:", e);
  }

  const answerMode = getAnswerMode(chatIdStr, {
    isMonarch: monarchNow,
    text: effective,
    taskType: classification.taskType,
    aiCostLevel: classification.aiCostLevel,
  });

  let modeInstruction = "";
  if (answerMode === "short") {
    modeInstruction =
      "Режим short: отвечай очень кратко (1–2 предложения), только по существу, без лишних деталей.";
  } else if (answerMode === "normal") {
    modeInstruction =
      "Режим normal: давай развёрнутый, но компактный ответ (3–7 предложений), с ключевыми деталями.";
  } else if (answerMode === "long") {
    modeInstruction = "Режим long: можно отвечать подробно, структурированно, с примерами и пояснениями.";
  }

  const currentUserName =
    [msg?.from?.first_name, msg?.from?.last_name].filter(Boolean).join(" ").trim() ||
    (msg?.from?.username ? `@${msg.from.username}` : "пользователь");

  const systemPrompt = buildSystemPrompt(answerMode, modeInstruction, projectCtx || "", {
    isMonarch: monarchNow,
    currentUserName,
    userText: effective,
  });

  // ==========================================================
  // STAGE 8C — Timezone wiring (DB -> TimeContext)
  // ==========================================================
  let userTz = "UTC";
  let timezoneMissing = false;

  try {
    const tzInfo = await getUserTimezone(globalUserId);
    if (!tzInfo || tzInfo.isSet !== true) {
      timezoneMissing = true;
    } else {
      userTz = tzInfo.timezone || "UTC";
    }
  } catch (_) {
    timezoneMissing = true;
  }

  if (timezoneMissing) {
    const rawTzInput = String(effective || "").trim();

    try {
      if (isTimeNowIntent(effective)) {
        const timeCtx = createTimeContext({ userTimezoneFromDb: "UTC" });
        const nowUtc = timeCtx.nowUTC();
        const formatted = timeCtx.formatForUser(nowUtc);

        if (formatted) {
          const text =
            `Зараз (UTC): ${formatted}\n` +
            `Щоб показувати локальний час — вкажи часову зону IANA, напр.: Europe/Kyiv`;
          await saveAssistantEarlyReturn(text, "deterministic_time_now_utc_no_tz");
          await bot.sendMessage(chatId, text);
          return;
        }
      }

      if (isCurrentDateIntent(effective)) {
        const timeCtx = createTimeContext({ userTimezoneFromDb: "UTC" });
        const nowUtc = timeCtx.nowUTC();
        const dateOnly = timeCtx.formatDateForUser(nowUtc);

        if (dateOnly) {
          const text =
            `Сьогодні (UTC): ${dateOnly}\n` +
            `Щоб показувати локальну дату — вкажи часову зону IANA, напр.: Europe/Kyiv`;
          await saveAssistantEarlyReturn(text, "deterministic_current_date_utc_no_tz");
          await bot.sendMessage(chatId, text);
          return;
        }
      }
    } catch (e) {
      console.error("ERROR deterministic no-tz reply failed (fail-open):", e);
    }

    const ianaCandidate = rawTzInput.match(/^[A-Za-z_]+\/[A-Za-z_]+$/) ? rawTzInput : null;

    const isValidIana = (tz) => {
      try {
        new Intl.DateTimeFormat("en-US", { timeZone: tz }).format(new Date());
        return true;
      } catch (_) {
        return false;
      }
    };

    let resolved = null;

    if (ianaCandidate && isValidIana(ianaCandidate)) {
      resolved = ianaCandidate;
    } else {
      const t = rawTzInput.toLowerCase();

      const mentionsKyiv =
        t.includes("kyiv") || t.includes("kiev") || t.includes("київ") || t.includes("киев");

      const mentionsUkraine = t.includes("ukraine") || t.includes("украина") || t.includes("україна");

      if (mentionsKyiv || mentionsUkraine) {
        resolved = "Europe/Kyiv";
      }
    }

    if (resolved) {
      try {
        await setUserTimezone(globalUserId, resolved);
        const text = `✅ Часовий пояс збережено: ${resolved}`;
        await saveAssistantEarlyReturn(text, "timezone_saved");
        await bot.sendMessage(chatId, text);
      } catch (e) {
        console.error("ERROR setUserTimezone failed:", e);
        const text = "ERROR: Не вдалося зберегти часовий пояс. Спробуй ще раз.";
        await saveAssistantEarlyReturn(text, "timezone_save_failed");
        await bot.sendMessage(chatId, text);
      }
      return;
    }

    {
      const text =
        "Укажи свою часову зону у форматі IANA, напр.: Europe/Kyiv. Якщо не знаєш — напиши країну і місто ще раз.";
      await saveAssistantEarlyReturn(text, "timezone_ask");
      await bot.sendMessage(chatId, text);
      return;
    }
  }

  let recallCtx = "";
  try {
    const recall = getRecallEngine({ db: pool, logger: console });
    recallCtx = await recall.buildRecallContext({
      chatId: chatIdStr,
      globalUserId,
      query: effective,
      limit: 10,
      userTimezone: userTz,
    });
  } catch (e) {
    console.error("ERROR RecallEngine buildRecallContext failed (fail-open):", e);
  }

  try {
    if (isTimeNowIntent(effective)) {
      const timeCtx = createTimeContext({ userTimezoneFromDb: userTz });
      const nowUtc = timeCtx.nowUTC();
      const formatted = timeCtx.formatForUser(nowUtc);

      const fallback =
        !formatted
          ? (() => {
              try {
                const utcCtx = createTimeContext({ userTimezoneFromDb: "UTC" });
                return utcCtx.formatForUser(nowUtc);
              } catch (_) {
                return null;
              }
            })()
          : null;

      const out = formatted || fallback;

      if (out) {
        const text = `Зараз: ${out}`;
        await saveAssistantEarlyReturn(text, "deterministic_time_now");
        await bot.sendMessage(chatId, text);
        return;
      }
    }
  } catch (e) {
    console.error("ERROR deterministic TIME_NOW reply failed (fail-open):", e);
  }

  try {
    if (isCurrentDateIntent(effective)) {
      const timeCtx = createTimeContext({ userTimezoneFromDb: userTz });
      const nowUtc = timeCtx.nowUTC();
      const dateOnly = timeCtx.formatDateForUser(nowUtc);

      const fallback =
        !dateOnly
          ? (() => {
              try {
                const utcCtx = createTimeContext({ userTimezoneFromDb: "UTC" });
                return utcCtx.formatDateForUser(nowUtc);
              } catch (_) {
                return null;
              }
            })()
          : null;

      const out = dateOnly || fallback;

      if (out) {
        const text = `Сьогодні: ${out}`;
        await saveAssistantEarlyReturn(text, "deterministic_current_date");
        await bot.sendMessage(chatId, text);
        return;
      }
    }
  } catch (e) {
    console.error("ERROR deterministic CURRENT_DATE reply failed (fail-open):", e);
  }

  try {
    const timeCtx = createTimeContext({ userTimezoneFromDb: userTz });
    const parsed = timeCtx.parseHumanDate(effective);

    const qLower = String(effective || "").toLowerCase();
    const asksCalendarDate =
      qLower.includes("число") || qLower.includes("дата") || qLower.includes("what date") || qLower.includes("date was");

    const isSingleDayHint =
      parsed?.hint === "today" ||
      parsed?.hint === "tomorrow" ||
      parsed?.hint === "yesterday" ||
      parsed?.hint === "day_before_yesterday" ||
      /_days_ago$/.test(String(parsed?.hint || "")) ||
      /_days_from_now$/.test(String(parsed?.hint || ""));

    if (asksCalendarDate && parsed?.fromUTC && isSingleDayHint) {
      const d = new Date(parsed.fromUTC);
      const dateOnly = timeCtx.formatDateForUser(d);

      if (dateOnly) {
        const text = `Дата: ${dateOnly}`;
        await saveAssistantEarlyReturn(text, "deterministic_calendar_date");
        await bot.sendMessage(chatId, text);
        return;
      }

      const dateLabel = new Intl.DateTimeFormat("ru-RU", {
        timeZone: "UTC",
        year: "numeric",
        month: "long",
        day: "numeric",
      }).format(d);

      const text = `По UTC это ${dateLabel}.`;
      await saveAssistantEarlyReturn(text, "deterministic_calendar_date_fallback_utc");
      await bot.sendMessage(chatId, text);
      return;
    }
  } catch (e) {
    console.error("ERROR deterministic calendar-date reply failed (fail-open):", e);
  }

  try {
    const timeCtx = createTimeContext({ userTimezoneFromDb: userTz });
    const parsed = timeCtx.parseHumanDate(effective);
    const isFutureSingleDay = /_days_from_now$/.test(String(parsed?.hint || ""));

    if (parsed && !isFutureSingleDay) {
      const uaCount = (recallCtx || "").match(/U:|A:/g)?.length ?? 0;

      if (!String(recallCtx || "").trim() || uaCount < 1) {
        try {
          const text = "В памяти нет данных за этот период.";
          await saveAssistantEarlyReturn(text, "guard_recall_too_weak");
          await bot.sendMessage(chatId, text);
        } catch (e) {
          console.error("ERROR Guard send error:", e);
        }
        return;
      }
    }
  } catch (e) {
    console.error("ERROR STAGE 8A guard failed (fail-open):", e);
  }

  let softReaction = false;
  let lastMatchAt = null;
  try {
    const alreadySeen = getAlreadySeenDetector({ db: pool, logger: console });

    const alreadySeenTriggered = await alreadySeen.check({
      chatId: chatIdStr,
      globalUserId,
      text: effective,
      role: normalizeAlreadySeenRole(userRole),
    });

    lastMatchAt = typeof alreadySeen.getLastMatchAt === "function" ? alreadySeen.getLastMatchAt() : null;
    softReaction = Boolean(alreadySeenTriggered);
  } catch (e) {
    console.error("ERROR AlreadySeenDetector check failed (fail-open):", e);
  }

  if (softReaction === true) {
    try {
      const dt = lastMatchAt ? new Date(lastMatchAt) : null;
      const when = dt
        ? new Intl.DateTimeFormat("ru-RU", {
            timeZone: "UTC",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
          }).format(dt)
        : "неизвестно";

      const hintText = `💡 Похоже, це вже обговорювали. Останній збіг: ${when} (UTC)\nЯкщо є нове — уточни, что змінилося.`;

      await bot.sendMessage(chatId, hintText);

      try {
        const transport = "telegram";
        const chatType = msg?.chat?.type || null;

        const assistantRedactedFull = redactText(hintText);
        const assistantTextHash = sha256Text(assistantRedactedFull);

        const assistantContentForDb =
          typeof assistantRedactedFull === "string" && assistantRedactedFull.length > MAX_CHAT_MESSAGE_CHARS
            ? assistantRedactedFull.slice(0, MAX_CHAT_MESSAGE_CHARS)
            : typeof assistantRedactedFull === "string"
              ? assistantRedactedFull
              : "";

        const assistantTruncatedForDb =
          typeof assistantRedactedFull === "string" && assistantRedactedFull.length > MAX_CHAT_MESSAGE_CHARS;

        await insertAssistantMessage({
          transport,
          chatId: chatIdStr,
          chatType,
          globalUserId: globalUserId || null,
          textHash: assistantTextHash,
          content: assistantContentForDb,
          truncated: Boolean(assistantTruncatedForDb),
          metadata: {
            senderIdStr,
            chatIdStr,
            in_reply_to_message_id: messageId ?? null,
            globalUserId: globalUserId ?? null,
            handler: "chat",
            stage: "7B.already_seen_hint",
          },
          schemaVersion: 1,
        });
      } catch (e) {
        console.error("ERROR STAGE 7B already-seen hint insert failed (fail-open):", e);
      }
    } catch (e) {
      console.error("ERROR Telegram send error (soft hint):", e);
    }
  }

  const roleGuardPrompt = monarchNow
    ? "SYSTEM ROLE: текущий пользователь = MONARCH (разрешено обращаться 'Монарх', 'Гарик')."
    : "SYSTEM ROLE: текущий пользователь НЕ монарх. Запрещено обращаться 'Монарх', 'Ваше Величество', 'Государь'. Называй: 'гость' или нейтрально (вы/ты).";

  const sourceServiceSystemMessage =
    sourceServiceDebugBlock && String(sourceServiceDebugBlock).trim()
      ? {
          role: "system",
          content:
            `${sourceServiceDebugBlock}\n\n` +
            `IMPORTANT:\n` +
            `- this service block describes current source-service state\n` +
            `- factual source data is injected separately only when sourceResult.ok=true\n` +
            `- if source fetch failed or was skipped, do not pretend that the source was used`,
        }
      : null;

  const messages = [
    { role: "system", content: systemPrompt },
    sourceServiceSystemMessage,
    sourceResultSystemMessage,
    longTermMemorySystemMessage,
    recallCtx
      ? {
          role: "system",
          content:
            `RECALL CONTEXT (используй как историю чата):\n${recallCtx}\n\n` +
            `ПРАВИЛО: если пользователь спрашивает "что мы обсуждали вчера/раньше" — ` +
            `отвечай, опираясь на RECALL CONTEXT. ` +
            `Не говори "история не сохраняется". ` +
            `Если точной даты/вчера нет — скажи честно: "вижу только последние сообщения", и перечисли их.`,
        }
      : null,
    { role: "system", content: roleGuardPrompt },
    ...history,
    { role: "user", content: effective },
  ];

  const filtered = messages.filter(Boolean);

  let maxTokens = 350;
  let temperature = 0.6;
  if (answerMode === "short") {
    maxTokens = 150;
    temperature = 0.3;
  } else if (answerMode === "long") {
    maxTokens = 900;
    temperature = 0.8;
  }

  const aiReason = "chat.reply";
  const aiMetaBase = {
    handler: "chat",
    reason: aiReason,
    aiCostLevel: classification.aiCostLevel,
    answerMode,
    max_completion_tokens: maxTokens,
    temperature,
    chatId: chatIdStr,
    senderId: senderIdStr,
    messageId,
    globalUserId,
    sourceServiceDecision: sourceCtx?.sourcePlan?.decision || "unknown",
    sourceRuntimeDecision: sourceCtx?.sourceRuntime?.decision || "unknown",
    sourceRuntimeNeedsSource: Boolean(sourceCtx?.sourceRuntime?.needsSource),
    sourceReason: sourceCtx?.reason || "unknown",
    sourceResultOk: Boolean(sourceCtx?.sourceResult?.ok),
    sourceResultKey: sourceCtx?.sourceResult?.sourceKey || null,
    longTermMemoryBridgePrepared: Boolean(longTermMemoryBridgeResult),
    longTermMemoryBridgeOk: Boolean(longTermMemoryBridgeResult?.ok),
    longTermMemoryBridgeReason: longTermMemoryBridgeResult?.reason || null,
    longTermMemoryInjected: false,
  };

  try {
    console.info("AI_CALL_START", aiMetaBase);
  } catch (_) {}

  try {
    await logInteraction(chatIdStr, { ...classification, event: "AI_CALL_START", ...aiMetaBase });
  } catch (e) {
    console.error("ERROR logInteraction (AI_CALL_START) error:", e);
  }

  const t0 = Date.now();

  let aiReply = "";
  try {
    aiReply = await callAI(filtered, classification.aiCostLevel, {
      max_completion_tokens: maxTokens,
      temperature,
    });
  } catch (e) {
    console.error("ERROR AI error:", e);

    const msgText = e?.message ? String(e.message) : "unknown";
    aiReply = monarchNow ? `ERROR: Ошибка вызова ИИ: ${msgText}` : "ERROR: Ошибка вызова ИИ.";
  }

  const dtMs = Date.now() - t0;
  const aiMetaEnd = {
    ...aiMetaBase,
    dtMs,
    replyChars: typeof aiReply === "string" ? aiReply.length : 0,
    ok: !(typeof aiReply === "string" && aiReply.startsWith("ERROR: Ошибка вызова ИИ")),
  };

  try {
    const _looksLikeClarification = typeof aiReply === "string" && aiReply.trim().endsWith("?");
    if (_looksLikeClarification) {
      const _be = new BehaviorEventsService();
      await _be.logEvent({
        globalUserId: globalUserId ?? null,
        chatId: chatIdStr,
        eventType: "clarification_asked",
        metadata: { replyChars: aiReply.length },
        transport: "telegram",
        schemaVersion: 1,
      });
    }
  } catch (_clarErr) {
    console.error("behavior_events clarification_asked log failed:", _clarErr);
  }

  try {
    console.info("AI_CALL_END", aiMetaEnd);
  } catch (_) {}

  try {
    await logInteraction(chatIdStr, { ...classification, event: "AI_CALL_END", ...aiMetaEnd });
  } catch (e) {
    console.error("ERROR logInteraction (AI_CALL_END) error:", e);
  }

  try {
    const transport = "telegram";
    const assistantRedactedFull = redactText(typeof aiReply === "string" ? aiReply : "");
    const assistantTextHash = sha256Text(assistantRedactedFull);

    const assistantContentForDb =
      typeof assistantRedactedFull === "string" && assistantRedactedFull.length > MAX_CHAT_MESSAGE_CHARS
        ? assistantRedactedFull.slice(0, MAX_CHAT_MESSAGE_CHARS)
        : typeof assistantRedactedFull === "string"
          ? assistantRedactedFull
          : "";

    const assistantTruncatedForDb =
      typeof assistantRedactedFull === "string" && assistantRedactedFull.length > MAX_CHAT_MESSAGE_CHARS;

    const meta = {
      senderIdStr,
      chatIdStr,
      in_reply_to_message_id: messageId ?? null,
      globalUserId: globalUserId ?? null,
      handler: "chat",
      stage: "7B.4",
      sourceServiceDecision: sourceCtx?.sourcePlan?.decision || "unknown",
      sourceRuntimeDecision: sourceCtx?.sourceRuntime?.decision || "unknown",
      sourceRuntimeNeedsSource: Boolean(sourceCtx?.sourceRuntime?.needsSource),
      sourceReason: sourceCtx?.reason || "unknown",
      sourceResultOk: Boolean(sourceCtx?.sourceResult?.ok),
      sourceResultKey: sourceCtx?.sourceResult?.sourceKey || null,
      longTermMemoryBridgePrepared: Boolean(longTermMemoryBridgeResult),
      longTermMemoryBridgeOk: Boolean(longTermMemoryBridgeResult?.ok),
      longTermMemoryBridgeReason: longTermMemoryBridgeResult?.reason || null,
      longTermMemoryInjected: false,
    };

    await insertAssistantMessage({
      transport,
      chatId: chatIdStr,
      chatType: msg?.chat?.type || null,
      globalUserId: globalUserId || null,
      textHash: assistantTextHash,
      content: assistantContentForDb,
      truncated: Boolean(assistantTruncatedForDb),
      metadata: meta,
      schemaVersion: 1,
    });

    try {
      await touchChatMeta({
        transport,
        chatId: String(chatIdStr),
        chatType: msg?.chat?.type || null,
        title: msg?.chat?.title || null,
        role: "assistant",
      });
    } catch (_) {}
  } catch (e) {
    console.error("ERROR STAGE 7B.4 chat_messages assistant insert failed (fail-open):", e);
  }

  try {
    const meta = { senderIdStr, chatIdStr, messageId };

    const res = await memoryWritePair({
      userText: effective,
      assistantText: aiReply,
      transport: "telegram",
      metadata: meta,
      schemaVersion: 2,
    });

    if (!res || res.stored !== true) {
      try {
        console.error("MEMORY_PAIR_SAVE_NOT_STORED", {
          chatId: chatIdStr,
          globalUserId,
          senderId: senderIdStr,
          messageId,
          res: res || null,
        });
      } catch (_) {}
    } else {
      try {
        console.info("MEMORY_PAIR_SAVE_OK", {
          chatId: chatIdStr,
          globalUserId,
          senderId: senderIdStr,
          messageId,
        });
      } catch (_) {}
    }
  } catch (e) {
    console.error("ERROR saveChatPair error:", {
      chatId: chatIdStr,
      globalUserId,
      senderId: senderIdStr,
      messageId,
      err: e?.message ? String(e.message) : e,
    });
  }

  try {
    if (!monarchNow) aiReply = sanitizeNonMonarchReply(aiReply);
  } catch (e) {
    console.error("ERROR sanitizeNonMonarchReply error:", e);
  }

  try {
    await bot.sendMessage(chatId, aiReply);
  } catch (e) {
    console.error("ERROR Telegram send error:", e);
  }

  let decisionPreviewRoute = null;
  try {
    decisionPreviewRoute = await routeDecision({
      text: effective,
      command: null,
      transport: "telegram",
      userId: senderIdStr || null,
      chatId: chatIdStr || null,
      messageId: messageId ?? null,
      meta: {
        source: "chat_handler_preview_route",
      },
    });
  } catch (e) {
    console.error("ERROR decision preview route failed (fail-open):", e);
  }

  try {
    await runDecisionShadowHook(
      {
        goal: effective,
        text: effective,
        transport: "telegram",
        userId: senderIdStr || null,
        chatId: chatIdStr || null,
        messageId: messageId ?? null,
        globalUserId: globalUserId ?? null,
        meta: {
          source: "chat_handler_post_reply_shadow",
          previewKind: decisionPreviewRoute?.kind || null,
          previewWorkerType: decisionPreviewRoute?.workerType || null,
          previewReason: decisionPreviewRoute?.reason || null,
          sourceServiceDecision: sourceCtx?.sourcePlan?.decision || "unknown",
          sourceRuntimeDecision: sourceCtx?.sourceRuntime?.decision || "unknown",
          sourceRuntimeNeedsSource: Boolean(sourceCtx?.sourceRuntime?.needsSource),
          sourceReason: sourceCtx?.reason || "unknown",
          sourceResultOk: Boolean(sourceCtx?.sourceResult?.ok),
          sourceResultKey: sourceCtx?.sourceResult?.sourceKey || null,
          longTermMemoryBridgePrepared: Boolean(longTermMemoryBridgeResult),
          longTermMemoryBridgeOk: Boolean(longTermMemoryBridgeResult?.ok),
          longTermMemoryBridgeReason: longTermMemoryBridgeResult?.reason || null,
          longTermMemoryInjected: false,
        },
      },
      {
        finalText: aiReply,
        route: {
          kind: decisionPreviewRoute?.kind || "core_chat",
          worker: decisionPreviewRoute?.workerType || "chat_handler",
          judgeRequired:
            typeof decisionPreviewRoute?.judgeRequired === "boolean"
              ? decisionPreviewRoute.judgeRequired
              : false,
          reason: decisionPreviewRoute?.reason || "chat_handler_post_reply_shadow",
        },
        warnings: [],
      }
    );
  } catch (e) {
    console.error("ERROR DecisionShadowHook failed (fail-open):", e);
  }
}
