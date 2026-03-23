// src/core/handleMessage/handleCommandFlow.js

import pool from "../../../db.js";
import { checkRateLimit } from "../../bot/rateLimiter.js";
import { BehaviorEventsService } from "../../logging/BehaviorEventsService.js";
import { insertCommandInvocation } from "../../db/commandInvocationsRepo.js";
import {
  insertUserMessage,
  insertWebhookDedupeEvent,
} from "../../db/chatMessagesRepo.js";
import { redactText, sha256Text, buildRawMeta } from "../redaction.js";
import { dispatchDiagnosticCommand } from "../diagnostics/index.js";
import { buildInboundStorageText } from "./inboundBinary.js";
import {
  CMD_RL_WINDOW_MS,
  CMD_RL_MAX,
  IDEMPOTENCY_BYPASS,
  safeDiagText,
  safeDiagTs,
  truncateForDb,
} from "./shared.js";
import { buildDispatchCommandContext } from "./contextBuilders.js";

const behaviorEvents = new BehaviorEventsService();

export async function handleCommandFlow({
  context,
  deps,
  transport,
  chatIdStr,
  chatIdNum,
  chatType,
  globalUserId,
  senderId,
  messageId,
  raw,
  trimmed,
  rest,
  cmdBase,
  user,
  userRole,
  userPlan,
  isMonarchUser,
  isPrivateChat,
  canProceed,
  replyAndLog,
}) {
  let commandInvocationInserted = true;

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
      commandInvocationInserted = true;
    }
  }

  try {
    if (commandInvocationInserted && transport === "telegram" && chatIdStr && messageId) {
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

  if (!isMonarchUser && cmdBase !== "/start" && cmdBase !== "/help") {
    const rlKey = `${senderId || ""}:${chatIdStr}:cmd`;
    const rl = checkRateLimit({
      key: rlKey,
      windowMs: CMD_RL_WINDOW_MS,
      max: CMD_RL_MAX,
    });

    if (!rl.allowed) {
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
  }

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
          SELECT
            id,
            created_at,
            content,
            metadata->>'longTermMemoryBridgePrepared' AS ltm_prepared,
            metadata->>'longTermMemoryBridgeOk' AS ltm_ok,
            metadata->>'longTermMemoryBridgeReason' AS ltm_reason,
            metadata->>'longTermMemoryInjected' AS ltm_injected
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
        lines.push(`longTermMemoryBridgePrepared=${lastAssistant.ltm_prepared ?? "—"}`);
        lines.push(`longTermMemoryBridgeOk=${lastAssistant.ltm_ok ?? "—"}`);
        lines.push(`longTermMemoryBridgeReason=${lastAssistant.ltm_reason ?? "—"}`);
        lines.push(`longTermMemoryInjected=${lastAssistant.ltm_injected ?? "—"}`);
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

      return {
        ok: true,
        stage: "7B.diag",
        result: "chat_messages_diag_replied",
        cmdBase,
      };
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

  if (typeof deps?.dispatchCommand === "function") {
    try {
      const dispatchCtx = buildDispatchCommandContext({
        deps,
        cmdBase,
        chatIdNum,
        chatIdStr,
        senderId,
        rest,
        user,
        userRole,
        userPlan,
        isMonarchUser,
        globalUserId,
        transport,
        chatType,
        messageId,
        isPrivateChat,
        replyAndLog,
      });

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