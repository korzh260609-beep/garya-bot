// src/core/handleMessage.js
// STAGE 6.4 — handleMessage(context) — Core entrypoint for any transport.
//
// IMPORTANT:
// - Shadow-wired when deps.reply / deps.callAI are not provided.
// - When deps are provided (enforced mode), this function produces real replies.
// - Transport must be THIN: all routing here, not in adapter.

import pool from "../../db.js";
import { deriveChatMeta } from "./transportMeta.js";
import { isTransportTraceEnabled } from "../transport/transportConfig.js";
import { getMemoryService } from "./memoryServiceFactory.js";

// ✅ STAGE 7B — chat_messages logging for COMMANDS (Core-level; Transport stays thin)
import {
  insertUserMessage,
  insertAssistantMessage,
  insertWebhookDedupeEvent,
} from "../db/chatMessagesRepo.js";
import { redactText, sha256Text, buildRawMeta } from "./redaction.js";
import { touchChatMeta } from "../db/chatMeta.js";
import { guardIncomingChatMessage } from "../services/chatMemory/guardIncomingChatMessage.js";

// ✅ STAGE 6 LOGIC — Access + Identity
import { resolveUserAccess } from "../users/userAccess.js";
import { ensureUserProfile } from "../users/userProfile.js";
import { can } from "../users/permissions.js";
import { envStr, envIntRange } from "./config.js";

// ✅ STAGE 6 LOGIC — Routing helpers
import { CMD_ACTION } from "../bot/cmdActionMap.js";
import { parseCommand } from "../../core/helpers.js";

// ✅ STAGE 3.5 — RateLimit
import { checkRateLimit } from "../bot/rateLimiter.js";

// ✅ STAGE 5.16 — Behavior events (observability)
import { BehaviorEventsService } from "../logging/BehaviorEventsService.js";
const behaviorEvents = new BehaviorEventsService();

// ✅ STAGE 6.8.2 — command idempotency (core-level)
import { insertCommandInvocation } from "../db/commandInvocationsRepo.js";
import { dispatchDiagnosticCommand } from "./diagnostics/index.js";

// ============================================================================
// Stage 3.5: COMMAND RATE-LIMIT (in-memory, per instance)
// ============================================================================
const CMD_RL_WINDOW_MS = envIntRange("CMD_RL_WINDOW_MS", 20000, {
  min: 1000,
  max: 300000,
});
const CMD_RL_MAX = envIntRange("CMD_RL_MAX", 6, { min: 1, max: 50 });

// ✅ SAFE COMMANDS — MUST ALWAYS REPLY (even on webhook retries)
const IDEMPOTENCY_BYPASS = new Set(["/start", "/help"]);

function envBool(name, def = false) {
  const v = envStr(name, def ? "true" : "false").trim().toLowerCase();
  if (v === "true" || v === "1" || v === "yes") return true;
  if (v === "false" || v === "0" || v === "no") return false;
  return def;
}

function safeDiagText(value, maxLen = 500) {
  const text = typeof value === "string" ? value : String(value ?? "");
  if (!text) return "—";
  return text.length > maxLen ? `${text.slice(0, maxLen)}…` : text;
}

function safeDiagTs(value) {
  try {
    return value ? new Date(value).toISOString() : "—";
  } catch {
    return "—";
  }
}

// ============================================================================
// STAGE 7B.5.2 — no binary (links/meta only) for inbound storage/logging
// IMPORTANT:
// - do NOT block runtime pipeline
// - do NOT block FileIntake
// - do NOT store binary payload as message content
// - store placeholder/meta only
// ============================================================================
function getBinaryAttachmentKinds(raw = null) {
  if (!raw || typeof raw !== "object") return [];

  const kinds = [];

  if (Array.isArray(raw.photo) && raw.photo.length > 0) kinds.push("photo");
  if (raw.document) kinds.push("document");
  if (raw.voice) kinds.push("voice");
  if (raw.audio) kinds.push("audio");
  if (raw.video) kinds.push("video");
  if (raw.video_note) kinds.push("video_note");
  if (raw.sticker) kinds.push("sticker");
  if (raw.animation) kinds.push("animation");

  return kinds;
}

function buildInboundStorageText(text = "", raw = null) {
  const original = typeof text === "string" ? text : String(text ?? "");
  const trimmed = original.trim();
  const binaryKinds = getBinaryAttachmentKinds(raw);

  if (binaryKinds.length === 0) {
    return {
      content: original,
      hasBinaryAttachment: false,
      attachmentKinds: [],
    };
  }

  const marker = `[binary_attachment:${binaryKinds.join(",")}]`;

  if (!trimmed) {
    return {
      content: marker,
      hasBinaryAttachment: true,
      attachmentKinds: binaryKinds,
    };
  }

  return {
    content: `${marker}\n${original}`,
    hasBinaryAttachment: true,
    attachmentKinds: binaryKinds,
  };
}

// ============================================================================
// STAGE 8D — Idempotency (chat): in-memory dedupe for enforced mode
// Purpose: drop duplicate deliveries (Telegram retries, webhook replays).
// No DB, no schema changes. TTL-based. Does NOT survive process restart.
// ============================================================================
const DEDUPE_TTL_MS = envIntRange("DEDUPE_TTL_MS", 5 * 60 * 1000, {
  min: 1000,
  max: 60 * 60 * 1000,
});
const DEDUPE_MAX = envIntRange("DEDUPE_MAX", 5000, { min: 100, max: 50000 });

// key -> lastSeenTs
const __dedupeSeen = new Map();

function dedupeSeenHasFresh(key, now) {
  if (!key) return false;
  const ts = __dedupeSeen.get(key);
  if (!ts) return false;
  return now - ts <= DEDUPE_TTL_MS;
}

function dedupeRemember(key, now) {
  if (!key) return;
  __dedupeSeen.set(key, now);

  // cheap pruning to keep Map bounded
  if (__dedupeSeen.size <= DEDUPE_MAX) return;

  const cutoff = now - DEDUPE_TTL_MS;
  for (const [k, ts] of __dedupeSeen.entries()) {
    if (ts < cutoff) __dedupeSeen.delete(k);
    if (__dedupeSeen.size <= DEDUPE_MAX) break;
  }

  // still too big: drop oldest approx (iteration order == insertion order)
  while (__dedupeSeen.size > DEDUPE_MAX) {
    const oldestKey = __dedupeSeen.keys().next().value;
    __dedupeSeen.delete(oldestKey);
  }
}

export async function handleMessage(context = {}) {
  const transport = String(context?.transport || "unknown");
  const chatId = context?.chatId == null ? null : String(context.chatId);
  const senderId = context?.senderId == null ? null : String(context.senderId);
  const text = context?.text == null ? "" : String(context.text);
  const messageId = context?.messageId == null ? null : String(context.messageId);
  const raw = context?.raw && typeof context.raw === "object" ? context.raw : null;

  // ✅ pre-parse for early dedupe bypass (Stage 8D happens before routing)
  const __trimmedForBypass = text.trim();
  const __isCommandForBypass = __trimmedForBypass.startsWith("/");
  const __parsedForBypass = __isCommandForBypass ? parseCommand(__trimmedForBypass) : null;
  const __cmdBaseForBypass = __parsedForBypass
    ? String(__parsedForBypass.cmd).split("@")[0]
    : null;

  // deps — injected by adapter for real mode; absent in shadow mode
  const deps = context?.deps || null;
  const hasReply = typeof deps?.reply === "function";
  const hasCallAI = typeof deps?.callAI === "function";
  const isEnforced = hasReply && hasCallAI;

  let globalUserId = context?.globalUserId == null ? null : String(context.globalUserId);

  const derived = deriveChatMeta({
    transport,
    chatId,
    senderId,
    transportChatType: context?.transportChatType ?? context?.chatType ?? null,
  });

  const chatType = derived.chatType || null;
  const isPrivateChat =
    typeof context?.isPrivateChat === "boolean" ? context.isPrivateChat : derived.isPrivateChat;

  // STAGE 7B — shared constants/helpers (match handlers/chat.js policy)
  const MAX_CHAT_MESSAGE_CHARS = 16000;

  const truncateForDb = (s) => {
    const t = typeof s === "string" ? s : String(s ?? "");
    if (t.length <= MAX_CHAT_MESSAGE_CHARS) return { text: t, truncated: false };
    return { text: t.slice(0, MAX_CHAT_MESSAGE_CHARS), truncated: true };
  };

  // =========================================================================
  // STAGE 6.8 — Enforced guard: no processing without dedupe key/messageId
  // =========================================================================
  if (isEnforced) {
    const dedupeKey = context?.dedupeKey || null;
    if (!dedupeKey || !messageId) {
      try {
        if (isTransportTraceEnabled()) {
          console.warn("ENFORCED_DROP_NO_DEDUPE", {
            transport,
            chatId,
            senderId,
            messageId,
            dedupeKey,
          });
        }
      } catch (_) {}
      return { ok: false, reason: "missing_dedupeKey", stage: "6.8" };
    }

    // =========================================================================
    // STAGE 8D — In-memory dedupe drop (prevents double-processing + double-reply)
    // =========================================================================
    try {
      // ✅ bypass dedupe for safe commands — must always reply
      if (!IDEMPOTENCY_BYPASS.has(__cmdBaseForBypass)) {
        const now = Date.now();
        const key = String(dedupeKey);

        if (dedupeSeenHasFresh(key, now)) {
          if (isTransportTraceEnabled()) {
            console.warn("ENFORCED_DROP_DUPLICATE", {
              transport,
              chatId,
              senderId,
              messageId,
              dedupeKey: key,
            });
          }
          return { ok: true, stage: "8D", result: "dup_drop" };
        }

        dedupeRemember(key, now);
      }
    } catch (e) {
      // fail-open: never block processing because of dedupe errors
      try {
        console.error("dedupe guard failed (fail-open):", e);
      } catch (_) {}
    }
  }

  // =========================================================================
  // STAGE 6 LOGIC STEP 1 — Identity + Access
  // =========================================================================
  let accessPack = null;
  let userRole = "guest";
  let userPlan = "free";
  let user = { role: "guest", plan: "free", global_user_id: null };

  if (transport === "telegram" && senderId) {
    try {
      if (raw) {
        await ensureUserProfile(raw);
      }
    } catch (e) {
      console.error("handleMessage(ensureUserProfile) failed:", e);
    }

    try {
      const MONARCH_USER_ID = envStr("MONARCH_USER_ID", "").trim();
      const isMonarchFn = (id) => String(id || "") === MONARCH_USER_ID;

      accessPack = await resolveUserAccess({
        senderIdStr: senderId,
        isMonarch: isMonarchFn,
        provider: transport,
      });

      userRole = accessPack?.userRole || "guest";
      userPlan = accessPack?.userPlan || "free";
      user = accessPack?.user || user;

      if (!globalUserId && user?.global_user_id) {
        globalUserId = user.global_user_id;
      }
    } catch (e) {
      console.error("handleMessage(resolveUserAccess) failed:", e);
    }
  }

  const isMonarchUser = userRole === "monarch";

  // =========================================================================
  // STAGE 6 LOGIC STEP 2 — Routing
  // =========================================================================
  const trimmed = text.trim();
  const isCommand = trimmed.startsWith("/");
  const parsed = isCommand ? parseCommand(trimmed) : null;
  const cmdBase = parsed ? String(parsed.cmd).split("@")[0] : null;
  const rest = parsed?.rest || "";

  // Permission check for commands
  let canProceed = true;
  if (isCommand && cmdBase) {
    const action = CMD_ACTION[cmdBase];
    if (action) {
      canProceed = can(user, action);
    }
  }

  // ✅ /start and /help must be universally allowed
  if (isCommand && cmdBase && IDEMPOTENCY_BYPASS.has(cmdBase)) {
    canProceed = true;
  }

  // =========================================================================
  // Trace log
  // =========================================================================
  try {
    if (isTransportTraceEnabled()) {
      console.log("📨 handleMessage(core)", {
        transport,
        chatId,
        senderId,
        globalUserId,
        chatType,
        isPrivateChat,
        isMonarchUser,
        userRole,
        isCommand,
        cmdBase,
        canProceed,
        isEnforced,
      });
    }
  } catch {
    // ignore
  }

// =========================================================================
  // STAGE 7.1 — Memory shadow write (OFF by default)
  // =========================================================================
  try {
    const memory = getMemoryService();
    const enabled = Boolean(memory?.config?.enabled);
    const shadowWriteEnabled = envBool("MEMORY_SHADOW_WRITE", false);

    if (!isEnforced && enabled && shadowWriteEnabled && chatId && messageId && text) {
      await memory.write({
        chatId,
        globalUserId: globalUserId || null,
        role: "user",
        content: text,
        transport,
        metadata: {
          messageId,
          source: "core.handleMessage.shadow",
          chatType,
          isPrivateChat,
        },
        schemaVersion: 2,
      });
    }
  } catch (e) {
    console.error("handleMessage(memory shadow) failed:", e);
  }

  // =========================================================================
  // Shadow mode: compute routing but don't act
  // =========================================================================
  if (!isEnforced) {
    return {
      ok: true,
      stage: "6.shadow",
      note: "routing computed (shadow). deps not provided — no reply.",
      transport,
      userRole,
      isMonarchUser,
      isCommand,
      cmdBase,
      canProceed,
    };
  }

  // =========================================================================
  // ENFORCED MODE — real routing + reply
  // =========================================================================
  const chatIdNum = chatId ? Number(chatId) : null;
  const chatIdStr = chatId || "";

  if (!chatIdNum) {
    return { ok: false, reason: "missing_chatId" };
  }

  // ✅ STAGE 7B — Core reply wrapper: always fail-open
  const replyAndLog = async (message, meta = {}) => {
    const out = String(message ?? "");
    try {
      await deps.reply(context, out);
    } catch (e) {
      console.error("replyAndLog: deps.reply failed:", e);
    }

    try {
      const red = redactText(out);
      const { text: content, truncated } = truncateForDb(red);
      const textHash = sha256Text(red);

      await insertAssistantMessage({
        transport,
        chatId: chatIdStr,
        chatType,
        globalUserId: globalUserId || null,
        textHash,
        content,
        truncated,
        metadata: {
          ...meta,
          stage: "7B.command.reply",
          cmd: meta?.cmd || null,
          senderId,
          chatId: chatIdStr,
          messageId: messageId ? Number(messageId) : null,
        },
        schemaVersion: 1,
      });
    } catch (e) {
      console.error("replyAndLog: insertAssistantMessage failed (fail-open):", e);
    }
  };

  // --- COMMAND ROUTING ---
  if (isCommand && cmdBase) {
    // STAGE 6.8.2 — command idempotency (core-level, enforced path)
    let commandInvocationInserted = true;

    // ✅ bypass idempotency for safe commands — must always reply (even on retries)
    if (!IDEMPOTENCY_BYPASS.has(cmdBase)) {
      try {
        if (transport === "telegram" && chatIdStr && messageId) {
          const ins = await insertCommandInvocation({
            transport,
            chatId: chatIdStr,
            messageId: Number(messageId),
            cmd: cmdBase,
            globalUserId: globalUserId || null,
            senderId: senderId || "",
            metadata: { enforced: true, source: "core.handleMessage" },
          });

          if (!ins?.inserted) {
            commandInvocationInserted = false;
            return { ok: true, stage: "6.8.2", result: "dup_command_drop", cmdBase };
          }
        }
      } catch (e) {
        console.error("core command idempotency guard failed:", e);
        // fail-open
        commandInvocationInserted = true;
      }
    }

    // ✅ STAGE 7B — log inbound COMMAND as user message into chat_messages (fail-open)
    // (only after command idempotency accepted; avoids duplicate user rows on retries)
    try {
      if (commandInvocationInserted && transport === "telegram" && chatIdStr && messageId) {
        // TODO(stage-7b): future inbound payload contract skeleton lives in
        // src/services/chatMemory/buildInboundChatPayload.js
        // Keep current runtime on buildInboundStorageText(...) until explicit migration step.
        //
        // CURRENT STORAGE AUTHORITY:
        // - this branch uses buildInboundStorageText(...) as the authoritative
        //   storage-facing shape for chat_messages user rows
        // - mapped fields TODAY:
        //   inboundStorage.content -> stored content
        //   inboundStorage.hasBinaryAttachment -> metadata.hasBinaryAttachment
        //   inboundStorage.attachmentKinds -> metadata.attachmentKinds
        // - do NOT import or call buildInboundChatPayload.js here yet
        // - future contract alignment must be approved as a separate runtime migration step
        const inboundStorage = buildInboundStorageText(trimmed, raw);
        const red = redactText(inboundStorage.content);
        const { text: content, truncated } = truncateForDb(red);
        const textHash = sha256Text(red);

        await insertUserMessage({
          transport,
          chatId: chatIdStr,
          chatType,
          globalUserId: globalUserId || null,
          senderId: senderId || null,
          messageId: Number(messageId),
          textHash,
          content,
          truncated,
          metadata: {
            stage: "7B.command.in",
            cmd: cmdBase,
            senderId,
            chatId: chatIdStr,
            messageId: Number(messageId),
            hasBinaryAttachment: inboundStorage.hasBinaryAttachment,
            attachmentKinds: inboundStorage.attachmentKinds,
          },
          raw: buildRawMeta(raw || {}),
          schemaVersion: 1,
        });
      }
    } catch (e) {
      console.error("STAGE 7B command insertUserMessage failed (fail-open):", e);
    }

    // Stage 3.5 — apply RL to ALL commands (except /start, /help). Monarch bypass.
    if (!isMonarchUser && cmdBase !== "/start" && cmdBase !== "/help") {
      const rlKey = `${senderId || ""}:${chatIdStr}:cmd`;
      const rl = checkRateLimit({
        key: rlKey,
        windowMs: CMD_RL_WINDOW_MS,
        max: CMD_RL_MAX,
      });

      if (!rl.allowed) {
        // behavior_events: rate_limited
        try {
          await behaviorEvents.logEvent({
            globalUserId: globalUserId || null,
            chatId: chatIdStr,
            transport,
            eventType: "rate_limited",
            metadata: {
              cmd: cmdBase,
              windowMs: CMD_RL_WINDOW_MS,
              max: CMD_RL_MAX,
              senderId: senderId || null,
            },
            schemaVersion: 1,
          });
        } catch (e) {
          console.error("handleMessage(rate_limited logEvent) failed:", e);
        }

        const sec = Math.ceil(rl.retryAfterMs / 1000);
        await replyAndLog(`⛔ Слишком часто. Подожди ${sec} сек.`, {
          cmd: cmdBase,
          event: "rate_limited",
        });
        return { ok: true, stage: "3.5", result: "rate_limited", cmdBase };
      }
    }

    if (!canProceed && !IDEMPOTENCY_BYPASS.has(cmdBase)) {
      // behavior_events: permission_denied
      try {
        await behaviorEvents.logEvent({
          globalUserId: globalUserId || null,
          chatId: chatIdStr,
          transport,
          eventType: "permission_denied",
          metadata: {
            cmd: cmdBase,
            userRole,
            userPlan,
            senderId: senderId || null,
          },
          schemaVersion: 1,
        });
      } catch (e) {
        console.error("handleMessage(permission_denied logEvent) failed:", e);
      }

      await replyAndLog("⛔ Недостаточно прав.", {
        cmd: cmdBase,
        event: "permission_denied",
      });
      return { ok: true, stage: "6.logic.2", result: "permission_denied", cmdBase };
    }

    // ✅ /start — must always reply in ENFORCED
    if (cmdBase === "/start") {
      await replyAndLog(
        [
          "✅ SG online.",
          "",
          "Базовые команды:",
          "- /link_start — начать привязку identity",
          "- /link_confirm <code> — подтвердить привязку",
          "- /link_status — проверить статус",
          "",
          "ℹ️ /help — подсказка по командам (в зависимости от прав).",
        ].join("\n"),
        { cmd: cmdBase, event: "start" }
      );
      return { ok: true, stage: "6.logic.2", result: "start_replied", cmdBase };
    }

    // ✅ /help — must always reply in ENFORCED
    if (cmdBase === "/help") {
      await replyAndLog(
        [
          "ℹ️ Help",
          "",
          "Базовые команды:",
          "- /link_start",
          "- /link_confirm <code>",
          "- /link_status",
          "",
          "Dev/системные команды — только для монарха в личке.",
        ].join("\n"),
        { cmd: cmdBase, event: "help" }
      );
      return { ok: true, stage: "6.logic.2", result: "help_replied", cmdBase };
    }

    // ✅ STAGE 7B — diagnostics registry skeleton
    // IMPORTANT:
    // - currently fail-open
    // - old inline command logic remains authoritative for now
    try {
      const diagnosticResult = await dispatchDiagnosticCommand({
        cmdBase,
        context,
        deps,
        user,
        userRole,
        userPlan,
        isMonarchUser,
        isPrivateChat,
        globalUserId,
        chatIdStr,
        chatIdNum,
        senderId,
        messageId,
        chatType,
        transport,
        trimmed,
        rest,
        replyAndLog,
      });

      if (diagnosticResult?.handled) {
        return diagnosticResult;
      }
    } catch (e) {
      console.error("handleMessage(dispatchDiagnosticCommand) failed:", e);
      // fail-open: keep old inline handlers authoritative until migration
    }

    // ✅ STAGE 7B foundation — /chat_messages_diag in ENFORCED transport path
    if (cmdBase === "/chat_messages_diag") {
      if (!isPrivateChat) {
        await replyAndLog("⛔ /chat_messages_diag доступна только в личке.", {
          cmd: cmdBase,
          event: "private_only_block",
        });
        return { ok: true, stage: "7B.diag", result: "private_only_block", cmdBase };
      }

      if (!isMonarchUser) {
        await replyAndLog("⛔ Недостаточно прав (monarch-only).", {
          cmd: cmdBase,
          event: "monarch_only_block",
        });
        return { ok: true, stage: "7B.diag", result: "monarch_only_block", cmdBase };
      }

      try {
        const [
          totalChatMessagesRes,
          lastUserMessageRes,
          lastAssistantMessageRes,
          dedupeCountRes,
          lastDedupeEventRes,
        ] = await Promise.all([
          pool.query(
            `
            SELECT COUNT(*)::int AS n
            FROM chat_messages
            WHERE chat_id = $1
            `,
            [String(chatIdStr)]
          ),

          pool.query(
            `
            SELECT id, message_id, created_at, content
            FROM chat_messages
            WHERE chat_id = $1
              AND role = 'user'
            ORDER BY created_at DESC, id DESC
            LIMIT 1
            `,
            [String(chatIdStr)]
          ),

          pool.query(
            `
            SELECT id, created_at, content
            FROM chat_messages
            WHERE chat_id = $1
              AND role = 'assistant'
            ORDER BY created_at DESC, id DESC
            LIMIT 1
            `,
            [String(chatIdStr)]
          ),

          pool.query(
            `
            SELECT COUNT(*)::int AS n
            FROM webhook_dedupe_events
            WHERE chat_id = $1
            `,
            [String(chatIdStr)]
          ),

          pool.query(
            `
            SELECT id, message_id, created_at, reason
            FROM webhook_dedupe_events
            WHERE chat_id = $1
            ORDER BY created_at DESC, id DESC
            LIMIT 1
            `,
            [String(chatIdStr)]
          ),
        ]);

        const totalChatMessages = totalChatMessagesRes.rows?.[0]?.n ?? 0;
        const totalDedupeEvents = dedupeCountRes.rows?.[0]?.n ?? 0;

        const lastUser = lastUserMessageRes.rows?.[0] || null;
        const lastAssistant = lastAssistantMessageRes.rows?.[0] || null;
        const lastDedupe = lastDedupeEventRes.rows?.[0] || null;

        const lines = [];
        lines.push("🧠 CHAT_MESSAGES DIAG");
        lines.push("");
        lines.push(`chat_id: ${chatIdStr}`);
        lines.push(`global_user_id: ${globalUserId || "—"}`);
        lines.push("");
        lines.push(`total_chat_messages: ${totalChatMessages}`);
        lines.push("");
        lines.push("last_user_message:");
        if (!lastUser) {
          lines.push("—");
        } else {
          lines.push(`id=${lastUser.id ?? "—"}`);
          lines.push(`message_id=${lastUser.message_id ?? "—"}`);
          lines.push(`created_at=${safeDiagTs(lastUser.created_at)}`);
          lines.push(`content=${safeDiagText(lastUser.content)}`);
        }

        lines.push("");
        lines.push("last_assistant_message:");
        if (!lastAssistant) {
          lines.push("—");
        } else {
          lines.push(`id=${lastAssistant.id ?? "—"}`);
          lines.push(`created_at=${safeDiagTs(lastAssistant.created_at)}`);
          lines.push(`content=${safeDiagText(lastAssistant.content)}`);
        }

        lines.push("");
        lines.push("dedupe_events:");
        lines.push(`count=${totalDedupeEvents}`);
        if (!lastDedupe) {
          lines.push("last_event=—");
        } else {
          lines.push(
            `last_event=id=${lastDedupe.id ?? "—"} | message_id=${lastDedupe.message_id ?? "—"} | created_at=${safeDiagTs(lastDedupe.created_at)} | reason=${lastDedupe.reason || "—"}`
          );
        }

        await replyAndLog(lines.join("\n").slice(0, 3900), {
          cmd: cmdBase,
          event: "chat_messages_diag",
        });

        return { ok: true, stage: "7B.diag", result: "chat_messages_diag_replied", cmdBase };
      } catch (e) {
        console.error("handleMessage(/chat_messages_diag) failed:", e);
        await replyAndLog(
          "⚠️ /chat_messages_diag failed. Проверь Render logs и схему таблиц.",
          {
            cmd: cmdBase,
            event: "chat_messages_diag_failed",
          }
        );
        return { ok: false, reason: "chat_messages_diag_failed", cmdBase };
      }
    }

    // =========================================================================
    // STAGE 7B — MANUAL-EDIT RISK ZONE (comment-only clarification)
    // IMPORTANT:
    // - the next line intentionally remains in current repo formatting
    // - do NOT mix indentation cleanup with runtime edits in the same step
    // - do NOT refactor this block during skeleton-only clarification work
    // - if formatting is ever corrected later, do it as a separate minimal safe step
    // - current authority here is still runtime command dispatch, unchanged
    // =========================================================================
if (typeof deps?.dispatchCommand === "function") {
      try {
        const dispatchCtx = {
          bot: deps.bot || null,
          chatId: chatIdNum,
          chatIdStr,
          senderIdStr: senderId || "",
          rest,
          user,
          userRole,
          userPlan,
          bypass: isMonarchUser,

          // ✅ reply that logs assistant output into chat_messages (Stage 7B)
          reply: async (text, meta = {}) => replyAndLog(text, { cmd: cmdBase, ...meta }),

          // extra useful context
          globalUserId,
          transport,
          chatType,
          messageId: messageId ? Number(messageId) : null,

          isPrivateChat,
          identityCtx: {
            transport,
            senderIdStr: senderId || "",
            chatIdStr,
            chatType,
            isPrivateChat,
            isMonarchUser,
          },
          getAnswerMode: deps.getAnswerMode,
          setAnswerMode: deps.setAnswerMode,
          callAI: deps.callAI,
          logInteraction: deps.logInteraction,
          getCoinGeckoSimplePriceById: deps.getCoinGeckoSimplePriceById,
          getCoinGeckoSimplePriceMulti: deps.getCoinGeckoSimplePriceMulti,
          getUserTasks: deps.getUserTasks,
          getTaskById: deps.getTaskById,
          runTaskWithAI: deps.runTaskWithAI,
          updateTaskStatus: deps.updateTaskStatus,
          createDemoTask: deps.createDemoTask,
          createManualTask: deps.createManualTask,
          createTestPriceMonitorTask: deps.createTestPriceMonitorTask,

          // ✅ STAGE 7A — Project Memory wiring (FIX)
          getProjectSection: deps.getProjectSection,
          getProjectMemoryList: deps.getProjectMemoryList,
          upsertProjectSection: deps.upsertProjectSection,
        };

        const result = await deps.dispatchCommand(cmdBase, dispatchCtx);
        if (result?.handled) {
          return { ok: true, stage: "6.logic.2", result: "command_handled", cmdBase };
        }
      } catch (e) {
        console.error("handleMessage(dispatchCommand) failed:", e);
        await replyAndLog("⛔ Ошибка при выполнении команды.", {
          cmd: cmdBase,
          event: "dispatch_error",
        });
        return { ok: false, reason: "dispatch_error", cmdBase };
      }
    }

    return { ok: true, stage: "6.logic.2", result: "unknown_command", cmdBase };
  }

  // --- MESSAGE ROUTING (non-command) ---
  if (typeof deps?.handleChatMessage === "function") {
    try {
      const memory = getMemoryService();

      const saveMessageToMemory = async (chatIdStr2, role, content, opts = {}) => {
        return memory.write({
          chatId: chatIdStr2,
          globalUserId: opts?.globalUserId ?? globalUserId ?? null,
          role,
          content: String(content ?? ""),
          transport: opts?.transport ?? transport,
          metadata: opts?.metadata ?? {},
          schemaVersion: opts?.schemaVersion ?? 2,
        });
      };

      const saveChatPair = async (chatIdStr2, _userText, assistantText, opts = {}) => {
        const meta = opts?.metadata ?? {};
        return memory.write({
          chatId: chatIdStr2,
          globalUserId: opts?.globalUserId ?? globalUserId ?? null,
          role: "assistant",
          content: String(assistantText ?? ""),
          transport: opts?.transport ?? transport,
          metadata: meta,
          schemaVersion: opts?.schemaVersion ?? 2,
        });
      };

      // ==========================================================
      // STAGE 7B.7 — CORE inbound chat idempotency guard
      // Insert-first before handler/AI.
      //
      // Rules:
      // - only for Telegram inbound user messages with numeric message_id
      // - duplicate => stop before handler
      // - log WEBHOOK_DEDUPE_HIT
      // - persist webhook_dedupe_events
      // - touchChatMeta
      // - fail-open on DB errors
      // ==========================================================
      if (
        transport === "telegram" &&
        messageId !== null &&
        Number.isFinite(Number(messageId))
      ) {
        try {
          // TODO(stage-7b): future inbound payload contract skeleton lives in
          // src/services/chatMemory/buildInboundChatPayload.js
          // Keep current runtime on buildInboundStorageText(...) until explicit migration step.
          //
          // CURRENT STORAGE AUTHORITY:
          // - this branch uses buildInboundStorageText(...) as the authoritative
          //   storage-facing shape before guardIncomingChatMessage(...)
          // - mapped fields TODAY:
          //   inboundStorage.content -> guardIncomingChatMessage.content
          //   inboundStorage.hasBinaryAttachment -> metadata.hasBinaryAttachment
          //   inboundStorage.attachmentKinds -> metadata.attachmentKinds
          // - do NOT import or call buildInboundChatPayload.js here yet
          // - contract migration must happen only after explicit storage-vs-AI alignment review
          const inboundStorage = buildInboundStorageText(trimmed, raw);
          const red = redactText(inboundStorage.content);
          const { text: content, truncated } = truncateForDb(red);
          const textHash = sha256Text(red);

          const ins = await guardIncomingChatMessage({
            transport,
            chatId: chatIdStr,
            chatType,
            globalUserId: globalUserId || null,
            senderId: senderId || null,
            messageId: Number(messageId),
            textHash,
            content,
            truncated,
            metadata: {
              stage: "7B.7.core.in",
              senderId,
              chatId: chatIdStr,
              messageId: Number(messageId),
              hasBinaryAttachment: inboundStorage.hasBinaryAttachment,
              attachmentKinds: inboundStorage.attachmentKinds,
            },
            raw: buildRawMeta(raw || {}),
            schemaVersion: 1,
          });

          if (ins?.duplicate === true) {
            try {
              console.info("WEBHOOK_DEDUPE_HIT", {
                transport,
                chatId: chatIdStr,
                messageId: Number(messageId),
                reason: "chat_messages_conflict",
                stage: "7B.7.core",
              });
            } catch (_) {}

            try {
              await insertWebhookDedupeEvent({
                transport,
                chatId: chatIdStr,
                messageId: Number(messageId),
                globalUserId: globalUserId || null,
                reason: "retry_duplicate",
                metadata: { handler: "core.handleMessage", stage: "7B.7.core" },
              });
            } catch (e) {
              console.error("ERROR webhook_dedupe_events insert failed:", e);
            }

            try {
              await touchChatMeta({
                transport,
                chatId: String(chatIdStr),
                chatType,
                title: raw?.chat?.title || null,
                role: "user",
              });
            } catch (_) {}

            return { ok: true, stage: "7B.7", result: "dup_chat_drop" };
          }

          try {
            await touchChatMeta({
              transport,
              chatId: String(chatIdStr),
              chatType,
              title: raw?.chat?.title || null,
              role: "user",
            });
          } catch (_) {}
        } catch (e) {
          console.error("ERROR STAGE 7B.7 core chat insert-first failed (fail-open):", e);
          // fail-open: continue normal flow
        }
      }

      await deps.handleChatMessage({
        bot: deps.bot,
        msg: context.raw,
        chatId: chatIdNum,
        chatIdStr,
        senderIdStr: senderId || "",
        globalUserId,
        trimmed,
        MAX_HISTORY_MESSAGES: deps.MAX_HISTORY_MESSAGES || 20,

        FileIntake: deps.FileIntake,

        getChatHistory: deps.getChatHistory,
        saveMessageToMemory,
        saveChatPair,

        logInteraction: deps.logInteraction,
        loadProjectContext: deps.loadProjectContext,
        getAnswerMode: deps.getAnswerMode,
        buildSystemPrompt: deps.buildSystemPrompt,

        isMonarch: (id) => String(id || "") === envStr("MONARCH_USER_ID", ""),

        callAI: deps.callAI,
        sanitizeNonMonarchReply: deps.sanitizeNonMonarchReply,
      });

      return { ok: true, stage: "6.logic.2", result: "chat_handled" };
    } catch (e) {
      console.error("handleMessage(handleChatMessage) failed:", e);
      return { ok: false, reason: "chat_error" };
    }
  }

  return { ok: false, reason: "no_handler" };
}

export default handleMessage;