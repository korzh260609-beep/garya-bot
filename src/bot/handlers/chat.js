// src/bot/handlers/chat.js
// extracted from messageRouter.js — no logic changes (only safety-guards + token param fix + observability logs)
//
// STAGE 7.2 LOGIC: pass globalUserId to chat_memory (v2 columns)

import pool from "../../../db.js";
import { getMemoryService } from "../../core/memoryServiceFactory.js";
import { getRecallEngine } from "../../core/recallEngineFactory.js";
import { getAlreadySeenDetector } from "../../core/alreadySeenFactory.js";
import { createTimeContext } from "../../core/time/timeContextFactory.js";
import { isTimeNowIntent } from "../../core/time/timeNowIntent.js";
import { touchChatMeta } from "../../db/chatMeta.js";
import { redactText, sha256Text, buildRawMeta } from "../../core/redaction.js";
import { getUserTimezone, setUserTimezone } from "../../db/userSettings.js";

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
  // STAGE 7B.10 + 7B.5.3 — Redaction + hard cap for chat_messages storage
  // Store ONLY redacted content in chat_messages.
  // ==========================================================
  const userRedactedFull = redactText(effective);

  const userContentForDb =
    typeof userRedactedFull === "string" && userRedactedFull.length > MAX_CHAT_MESSAGE_CHARS
      ? userRedactedFull.slice(0, MAX_CHAT_MESSAGE_CHARS)
      : userRedactedFull;

  const userTruncatedForDb =
    typeof userRedactedFull === "string" && userRedactedFull.length > MAX_CHAT_MESSAGE_CHARS;

  const userTextHash = sha256Text(userRedactedFull);

  if (directReplyText) {
    try {
      await bot.sendMessage(chatId, directReplyText);
    } catch (e) {
      console.error("ERROR Telegram send error (directReplyText):", e);
    }
    return;
  }

  if (!shouldCallAI) {
    try {
      await bot.sendMessage(chatId, "Напиши текстом, что нужно сделать.");
    } catch (e) {
      console.error("ERROR Telegram send error (shouldCallAI):", e);
    }
    return;
  }

  // ==========================================================
  // STAGE 7B.7 — IDEMPOTENCY CORE (critical)
  // Insert-first into chat_messages to guarantee process-once on webhook retries.
  //
  // Strategy:
  // - Only for inbound USER messages with numeric Telegram message_id
  // - INSERT ... ON CONFLICT DO NOTHING (partial unique index for role='user')
  // - If conflict => already processed => exit WITHOUT calling AI and WITHOUT sending a second reply
  // - Fail-open on any DB error (do not break production)
  //
  // STAGE 7B.5.2 — raw meta only (no text/binary)
  // STAGE 7B.2 — platform_message_id + text_hash
  // STAGE 7B.10 — content redacted
  // ==========================================================
  if (messageId !== null && Number.isFinite(Number(messageId))) {
    try {
      const transport = "telegram";
      const chatType = msg?.chat?.type || null;
      const senderId = senderIdStr || null;

      const meta = {
        senderIdStr,
        chatIdStr,
        messageId,
        globalUserId,
      };

      //  7B.5.2: meta-only raw (NO msg text, NO attachments)
      const raw = buildRawMeta(msg);

      const ins = await pool.query(
        `
        INSERT INTO chat_messages (
          transport,
          chat_id,
          chat_type,
          global_user_id,
          sender_id,
          message_id,
          platform_message_id,
          text_hash,
          role,
          content,
          truncated,
          metadata,
          raw,
          schema_version
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13::jsonb,$14)
        ON CONFLICT (transport, chat_id, message_id)
          WHERE role='user' AND message_id IS NOT NULL
        DO NOTHING
        RETURNING id
        `,
        [
          transport,
          String(chatIdStr),
          chatType ? String(chatType) : null,
          globalUserId ? String(globalUserId) : null,
          senderId ? String(senderId) : null,
          Number(messageId),
          Number(messageId), // platform_message_id (telegram = message_id)
          userTextHash,
          "user",
          userContentForDb,
          Boolean(userTruncatedForDb),
          JSON.stringify(meta),
          JSON.stringify(raw),
          1,
        ]
      );

      // Conflict => already processed (retry) => exit silently
      if (!ins || (ins.rowCount || 0) === 0) {
        try {
          console.info("IDEMPOTENCY_SKIP", {
            transport,
            chatId: chatIdStr,
            messageId,
            reason: "chat_messages_conflict",
          });
        } catch (_) {}

        //  STAGE 7B.7 OBSERVABILITY: persist dedupe-hit (legacy attempt; may be ignored if schema doesn't support it)
        try {
          await logInteraction(chatIdStr, {
            taskType: "chat",
            aiCostLevel: "none",
            event: "WEBHOOK_DEDUPE_HIT",
          });
        } catch (e) {
          console.error("ERROR logInteraction (WEBHOOK_DEDUPE_HIT) error:", e);
        }

        //  STAGE 7B.7 OBSERVABILITY (V2): dedicated table webhook_dedupe_events
        try {
          await pool.query(
            `
            INSERT INTO webhook_dedupe_events
            (transport, chat_id, message_id, global_user_id, reason, metadata)
            VALUES ($1,$2,$3,$4,$5,$6::jsonb)
            ON CONFLICT (transport, chat_id, message_id) DO NOTHING
            `,
            [
              transport,
              String(chatIdStr),
              Number(messageId),
              globalUserId ? String(globalUserId) : null,
              "retry_duplicate",
              JSON.stringify({ handler: "chat", stage: "7B.7" }),
            ]
          );
        } catch (e) {
          console.error("ERROR webhook_dedupe_events insert failed:", e);
        }

        return;
      }

      // STAGE 7B.8 — touch chat_meta (inbound user)
      try {
        await touchChatMeta({
          transport,
          chatId: String(chatIdStr),
          chatType: msg?.chat?.type || null,
          title: msg?.chat?.title || null,
          role: "user",
        });
      } catch (_) {}
    } catch (e) {
      console.error("ERROR STAGE 7B.7 chat_messages insert-first failed (fail-open):", e);
      // fail-open: continue normal flow
    }
  }

  //  STAGE 7.2: save with globalUserId + metadata
  // NOTE: Memory layer keeps original text; 7B redaction applies to chat_history (chat_messages) only.
  try {
    await saveMessageToMemory(chatIdStr, "user", effective, {
      globalUserId,
      transport: "telegram",
      metadata: { senderIdStr, chatIdStr, messageId },
      schemaVersion: 2,
    });
  } catch (e) {
    console.error("ERROR saveMessageToMemory error:", e);
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

  const answerMode = getAnswerMode(chatIdStr);

  let modeInstruction = "";
  if (answerMode === "short") {
    modeInstruction =
      "Режим short: отвечай очень кратко (1–2 предложения), только по существу, без лишних деталей.";
  } else if (answerMode === "normal") {
    modeInstruction =
      "Режим normal: давай развёрнутый, но компактный ответ (3–7 предложений), с ключевыми деталями.";
  } else if (answerMode === "long") {
    modeInstruction =
      "Режим long: можно отвечать подробно, структурированно, с примерами и пояснениями.";
  }

  const currentUserName =
    [msg?.from?.first_name, msg?.from?.last_name].filter(Boolean).join(" ").trim() ||
    (msg?.from?.username ? `@${msg.from.username}` : "пользователь");

  const systemPrompt = buildSystemPrompt(answerMode, modeInstruction, projectCtx || "", {
    isMonarch: monarchNow,
    currentUserName,
  });

  // ==========================================================
  // STAGE 8A — RECALL ENGINE (SKELETON)
  // - wiring only
  // - default disabled via RECALL_ENABLED
  // - fail-open (must not break production)
  // ==========================================================
  let recallCtx = "";
  try {
    const recall = getRecallEngine({ db: pool, logger: console });
    recallCtx = await recall.buildRecallContext({
      chatId: chatIdStr,
      globalUserId,
      query: effective,
      limit: 5,
    });
  } catch (e) {
    console.error("ERROR RecallEngine buildRecallContext failed (fail-open):", e);
  }

  //  DEBUG (STAGE 8A): prove recall is wired + non-empty
  try {
    console.log("RECALL DBG", {
      enabled: process.env.RECALL_ENABLED,
      hasRecallCtx: Boolean(recallCtx && recallCtx.trim()),
      recallLen: recallCtx ? recallCtx.length : 0,
      chatId: String(chatIdStr),
      senderId: String(senderIdStr),
      globalUserId: globalUserId ? String(globalUserId) : null,
      q: String(effective || "").slice(0, 60),
    });
  } catch (_) {}

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

      const mentionsUkraine =
        t.includes("ukraine") || t.includes("украина") || t.includes("україна");

      if (mentionsKyiv || mentionsUkraine) {
        resolved = "Europe/Kyiv";
      }
    }

    if (resolved) {
      try {
        await setUserTimezone(globalUserId, resolved);
        await bot.sendMessage(chatId, `✅ Часовий пояс збережено: ${resolved}`);
      } catch (e) {
        console.error("ERROR setUserTimezone failed:", e);
        await bot.sendMessage(chatId, "ERROR: Не вдалося зберегти часовий пояс. Спробуй ще раз.");
      }
      return; // ⛔ STOP — не идём в AI
    }

    await bot.sendMessage(
      chatId,
      "Укажи свою часову зону у форматі IANA, напр.: Europe/Kyiv. Якщо не знаєш — напиши країну і місто ще раз."
    );
    return; // ⛔ STOP — не идём в AI
  }

  // ==========================================================
  // STAGE 8C.0 — deterministic TIME_NOW reply (no AI)
  // ==========================================================
  try {
    if (isTimeNowIntent(effective)) {
      const timeCtx = createTimeContext({ userTimezoneFromDb: userTz });
      const nowUtc = timeCtx.nowUTC();
      const formatted = timeCtx.formatForUser(nowUtc);

      if (formatted) {
        await bot.sendMessage(chatId, `Зараз: ${formatted}`);
        return;
      }
    }
  } catch (e) {
    console.error("ERROR deterministic TIME_NOW reply failed (fail-open):", e);
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
      qLower.includes("число") ||
      qLower.includes("дата") ||
      qLower.includes("what date") ||
      qLower.includes("date was");

    const isSingleDayHint =
      parsed?.hint === "today" ||
      parsed?.hint === "tomorrow" ||
      parsed?.hint === "yesterday" ||
      parsed?.hint === "day_before_yesterday" ||
      /_days_ago$/.test(String(parsed?.hint || ""));

    if (asksCalendarDate && parsed?.fromUTC && isSingleDayHint) {
      const d = new Date(parsed.fromUTC);
      const dateLabel = new Intl.DateTimeFormat("ru-RU", {
        timeZone: "UTC",
        year: "numeric",
        month: "long",
        day: "numeric",
      }).format(d);

      await bot.sendMessage(chatId, `По UTC это ${dateLabel}.`);
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

    if (parsed) {
      const recallLines = (recallCtx || "")
        .split("\n")
        .filter((l) => l.startsWith("U:") || l.startsWith("A:")).length;

      if (recallLines < 4) {
        try {
          await bot.sendMessage(chatId, "В памяти нет данных за этот период.");
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

    lastMatchAt =
      typeof alreadySeen.getLastMatchAt === "function" ? alreadySeen.getLastMatchAt() : null;

    softReaction = Boolean(alreadySeenTriggered);
  } catch (e) {
    console.error("ERROR AlreadySeenDetector check failed (fail-open):", e);
  }

  // ==========================================================
  // STAGE 8B.5 — Output format tightening (UTC default)
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

      await bot.sendMessage(
        chatId,
        `💡 Похоже, это уже обсуждали. Последнее совпадение: ${when} (UTC)\nЕсли есть новое — уточни, что изменилось.`
      );
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

    await pool.query(
      `
      INSERT INTO chat_messages (
        transport,
        chat_id,
        chat_type,
        global_user_id,
        sender_id,
        message_id,
        platform_message_id,
        text_hash,
        role,
        content,
        truncated,
        metadata,
        raw,
        schema_version
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13::jsonb,$14)
      `,
      [
        transport,
        String(chatIdStr),
        chatType ? String(chatType) : null,
        globalUserId ? String(globalUserId) : null,
        null,
        null,
        null,
        assistantTextHash,
        "assistant",
        assistantContentForDb,
        Boolean(assistantTruncatedForDb),
        JSON.stringify(meta),
        JSON.stringify({}),
        1,
      ]
    );

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
    await saveChatPair(chatIdStr, effective, aiReply, {
      globalUserId,
      transport: "telegram",
      metadata: { senderIdStr, chatIdStr, messageId },
      schemaVersion: 2,
    });
  } catch (e) {
    console.error("ERROR saveChatPair error:", e);
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
}
