// src/bot/handlers/chat.js
// extracted from messageRouter.js — no logic changes (only safety-guards + token param fix + observability logs)
//
// STAGE 7.2 LOGIC: pass globalUserId to chat_memory (v2 columns)
// STAGE 7 (Integrity hardening): ensure assistant replies are also saved on early-return branches
// (timezone/deterministic/guards), otherwise /memory_integrity shows missing_assistant.
//
// ✅ STAGE 7B (this patch): early-return replies + AlreadySeen hint also logged into chat_messages (assistant)

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
  //
  // CURRENT AI AUTHORITY DETAILS:
  // - FileIntake.buildEffectiveUserTextAndDecision(...) is still the only
  //   authoritative runtime source here for:
  //   1) effectiveUserText
  //   2) shouldCallAI
  //   3) directReplyText
  // - this handler must continue to trust FileIntake for AI-facing semantics
  // - do NOT silently align this block with Core storage semantics
  // - do NOT import/call buildInboundChatPayload.js here during skeleton-only stage
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

  // STAGE 7B NOTE:
  // effective below is still the AI-facing runtime value.
  // It is intentionally NOT unified yet with Core storage-facing semantics.
  //
  // IMPORTANT BRIDGE NOTE:
  // - `effective` below is NOT a storage contract field
  // - it is the current AI-facing runtime value chosen by FileIntake
  // - for media/caption flows it may intentionally diverge from Core
  //   storage-facing content built in src/core/handleMessage.js
  // - this divergence is expected at the current Stage 7B micro-step
  // - any unification must happen only through a separate approved runtime migration
  const effective = (decision?.effectiveUserText || "").trim();
  const shouldCallAI = Boolean(decision?.shouldCallAI);
  const directReplyText = decision?.directReplyText || null;

  // ==========================================================
  // STAGE 7 — helper: store assistant reply on early-return branches
  // Reason: without it, /memory_integrity reports missing_assistant (u=1 a=0)
  // ==========================================================
  const saveAssistantEarlyReturn = async (text, reason = "early_return") => {
    try {
      const replyText = typeof text === "string" ? text : String(text || "");
      if (!replyText.trim()) return;

      // ✅ STAGE 7B — also log assistant early-return into chat_messages (fail-open)
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

  //  STAGE 7.2: save with globalUserId + metadata
  // NOTE: Memory layer keeps original AI-facing text as used by this handler.
  // 7B redaction applies to chat_history (chat_messages) only.
  // Storage-vs-AI semantic unification is intentionally postponed.
  //
  // CURRENT MEMORY WRITE SEMANTICS:
  // - this user-memory write stores the AI-facing `effective` text only
  // - it does NOT attempt to mirror Core storage-facing payload semantics
  // - do NOT replace this with buildInboundChatPayload.js during skeleton stage
  // - do NOT reinterpret this as canonical inbound storage content
  // - explicit storage-vs-AI contract alignment must be a separate reviewed step
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

  let history = [];
  try {
    //  STAGE 7.3: read history via MemoryService (ban direct/legacy SQL reads here)
    const memory = getMemoryService();
    history = await memory.recent({
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

  // ✅ FIX (2026-03-02): adaptive answer mode (monarch default normal + minimal-sufficient upgrades)
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
  });

  // ==========================================================
  // STAGE 8C — Timezone wiring (DB -> TimeContext)
  // Default = UTC (policy).
  // If timezone not set → try resolve/save OR ask user and STOP (no AI call).
  // ==========================================================
  let userTz = "UTC";
  let timezoneMissing = false;

  try {
    const tzInfo = await getUserTimezone(globalUserId);

    // tzInfo = { timezone, isSet }
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

    // ✅ NEW: allow deterministic TIME_NOW / CURRENT_DATE even without timezone (fallback UTC)
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
          return; // ⛔ STOP — no AI
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
          return; // ⛔ STOP — no AI
        }
      }
    } catch (e) {
      console.error("ERROR deterministic no-tz reply failed (fail-open):", e);
    }

    // 1) If user provides IANA timezone directly (Europe/Kyiv)
    const ianaCandidate = rawTzInput.match(/^[A-Za-z_]+\/[A-Za-z_]+$/) ? rawTzInput : null;

    const isValidIana = (tz) => {
      try {
        // throws RangeError on invalid timeZone
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
      // 2) Minimal resolver (MVP): Kyiv/Ukraine -> Europe/Kyiv
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
      return; // ⛔ STOP — не идём в AI
    }

    {
      const text =
        "Укажи свою часову зону у форматі IANA, напр.: Europe/Kyiv. Якщо не знаєш — напиши країну і місто ще раз.";
      await saveAssistantEarlyReturn(text, "timezone_ask");
      await bot.sendMessage(chatId, text);
      return; // ⛔ STOP — не идём в AI
    }
  }

  // ==========================================================
  // STAGE 8A — RECALL ENGINE
  // - default disabled via RECALL_ENABLED
  // - fail-open (must not break production)
  // - IMPORTANT: pass userTimezone for correct human-date parsing
  // ==========================================================
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

  // ==========================================================
  // STAGE 8C.0 — deterministic TIME_NOW reply (no AI)
  // ==========================================================
  try {
    if (isTimeNowIntent(effective)) {
      const timeCtx = createTimeContext({ userTimezoneFromDb: userTz });
      const nowUtc = timeCtx.nowUTC();
      const formatted = timeCtx.formatForUser(nowUtc);

      // ✅ NEW: hard fallback to UTC if formatting fails (invalid TZ / Intl issue)
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

  // ==========================================================
  // STAGE 8A.1 — deterministic CURRENT_DATE reply (no AI)
  // ==========================================================
  try {
    if (isCurrentDateIntent(effective)) {
      const timeCtx = createTimeContext({ userTimezoneFromDb: userTz });
      const nowUtc = timeCtx.nowUTC();
      const dateOnly = timeCtx.formatDateForUser(nowUtc);

      // ✅ NEW: hard fallback to UTC if formatting fails
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
        return; // ⛔ запрет AI
      }
    }
  } catch (e) {
    console.error("ERROR deterministic CURRENT_DATE reply failed (fail-open):", e);
  }

  // ==========================================================
  // STAGE 8A.1 — deterministic calendar-date reply (no AI)
  // For direct questions like "какое было вчера число?" return computed date from TimeContext.
  // ==========================================================
  try {
    const timeCtx = createTimeContext({ userTimezoneFromDb: userTz });
    const parsed = timeCtx.parseHumanDate(effective);

    const qLower = String(effective || "").toLowerCase();
    const asksCalendarDate =
      qLower.includes("число") || qLower.includes("дата") || qLower.includes("what date") || qLower.includes("date was");

    // ✅ FIX: include "_days_from_now" as single-day hint
    const isSingleDayHint =
      parsed?.hint === "today" ||
      parsed?.hint === "tomorrow" ||
      parsed?.hint === "yesterday" ||
      parsed?.hint === "day_before_yesterday" ||
      /_days_ago$/.test(String(parsed?.hint || "")) ||
      /_days_from_now$/.test(String(parsed?.hint || "")); // ✅ FIX

    if (asksCalendarDate && parsed?.fromUTC && isSingleDayHint) {
      const d = new Date(parsed.fromUTC);

      // ✅ FIX: show date in user's timezone via TimeContext formatter (not "По UTC ...")
      const dateOnly = timeCtx.formatDateForUser(d);

      if (dateOnly) {
        const text = `Дата: ${dateOnly}`;
        await saveAssistantEarlyReturn(text, "deterministic_calendar_date");
        await bot.sendMessage(chatId, text);
        return; // ⛔ STOP — deterministic answer
      }

      // fallback (should be rare)
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

  // ==========================================================
  // STAGE 8A GUARD — BLOCK AI IF RECALL TOO WEAK (anti-hallucination)
  // ==========================================================
  try {
    const timeCtx = createTimeContext({ userTimezoneFromDb: userTz });
    const parsed = timeCtx.parseHumanDate(effective);

    // ✅ FIX: future-date questions are not "memory recall" → do not block
    const isFutureSingleDay = /_days_from_now$/.test(String(parsed?.hint || ""));

    if (parsed && !isFutureSingleDay) {
      // ✅ FIX (STAGE 8): count U:/A: even when timestamps prefix the line: "[dd.mm hh:mm] U:"
      const uaCount = (recallCtx || "").match(/U:|A:/g)?.length ?? 0;
      const recallLines = uaCount;

      if (recallLines < 4) {
        try {
          const text = "В памяти нет данных за этот период.";
          await saveAssistantEarlyReturn(text, "guard_recall_too_weak");
          await bot.sendMessage(chatId, text);
        } catch (e) {
          console.error("ERROR Guard send error:", e);
        }
        return; // 🚨 STOP — do NOT call AI
      }
    }
  } catch (e) {
    console.error("ERROR STAGE 8A guard failed (fail-open):", e);
  }

  // ==========================================================
  // STAGE 8B — ALREADY-SEEN DETECTOR
  // ==========================================================
  let softReaction = false;
  let lastMatchAt = null;
  try {
    const alreadySeen = getAlreadySeenDetector({ db: pool, logger: console });

    const alreadySeenTriggered = await alreadySeen.check({
      chatId: chatIdStr,
      globalUserId,
      text: effective,
    });

    lastMatchAt = typeof alreadySeen.getLastMatchAt === "function" ? alreadySeen.getLastMatchAt() : null;

    softReaction = Boolean(alreadySeenTriggered);
  } catch (e) {
    console.error("ERROR AlreadySeenDetector check failed (fail-open):", e);
  }

  // ==========================================================
  // STAGE 8B.5 — Output format tightening (UTC default)
  // NOTE: This is a non-terminal hint (we continue to AI).
  // DO NOT store to chat_memory with same messageId, otherwise we create multi_assistant anomalies.
  // ==========================================================
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

      // ✅ STAGE 7B — log soft hint into chat_messages (assistant) (fail-open)
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

  //  FIX: role guard must use monarchNow (real identity), not bypass (router shortcut)
  const roleGuardPrompt = monarchNow
    ? "SYSTEM ROLE: текущий пользователь = MONARCH (разрешено обращаться 'Монарх', 'Гарик')."
    : "SYSTEM ROLE: текущий пользователь НЕ монарх. Запрещено обращаться 'Монарх', 'Ваше Величество', 'Государь'. Называй: 'гость' или нейтрально (вы/ты).";

  const messages = [
    { role: "system", content: systemPrompt },
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

  // ✅ STAGE 5.16 — detect clarification_asked
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

  // ==========================================================
  // STAGE 7B.4 — Log assistant output to chat_messages (assistant)
  // ==========================================================
  try {
    const transport = "telegram";
    const chatType = msg?.chat?.type || null;

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

  // ==========================================================
  // ✅ STAGE 7 — deterministic save (assistant pairing) : HARD LOG
  // ==========================================================
  try {
    const meta = { senderIdStr, chatIdStr, messageId };

    const res = await memoryWritePair({
      userText: effective,
      assistantText: aiReply,
      transport: "telegram",
      metadata: meta,
      schemaVersion: 2,
    });

    // ✅ Hard signal into logs: if stored=false or res missing
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

  // ==========================================================
  // DECISION PREVIEW ROUTE — policy/telemetry only
  // IMPORTANT:
  // - no production effect
  // - no promotion
  // - used only to avoid hardcoded "core_chat" baseline kind
  // ==========================================================
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

  // ==========================================================
  // DECISION SHADOW HOOK — sandbox compare after real chat reply
  // IMPORTANT:
  // - must NEVER affect production response
  // - best-effort only
  // - runs only after Telegram reply is already sent
  // ==========================================================
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