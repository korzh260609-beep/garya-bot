// src/core/handleMessage/commandFlow/commandDiagnostics.js

import pool from "../../../../db.js";
import { dispatchDiagnosticCommand } from "../../diagnostics/index.js";
import { safeDiagText, safeDiagTs } from "../shared.js";

export async function handleCommandDiagnostics({
  context,
  deps,
  transport,
  chatIdStr,
  chatIdNum,
  chatType,
  globalUserId,
  senderId,
  messageId,
  trimmed,
  rest,
  cmdBase,
  user,
  userRole,
  userPlan,
  isMonarchUser,
  isPrivateChat,
  replyAndLog,
}) {
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
      return {
        handled: true,
        response: diagnosticResult,
      };
    }
  } catch (e) {
    console.error("handleMessage(dispatchDiagnosticCommand) failed:", e);
  }

  if (cmdBase !== "/chat_messages_diag") {
    return { handled: false };
  }

  if (!isPrivateChat) {
    await replyAndLog("⛔ /chat_messages_diag доступна только в личке.", {
      cmd: cmdBase,
      event: "private_only_block",
    });
    return {
      handled: true,
      response: { ok: true, stage: "7B.diag", result: "private_only_block", cmdBase },
    };
  }

  if (!isMonarchUser) {
    await replyAndLog("⛔ Недостаточно прав (monarch-only).", {
      cmd: cmdBase,
      event: "monarch_only_block",
    });
    return {
      handled: true,
      response: { ok: true, stage: "7B.diag", result: "monarch_only_block", cmdBase },
    };
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
      handled: true,
      response: {
        ok: true,
        stage: "7B.diag",
        result: "chat_messages_diag_replied",
        cmdBase,
      },
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

    return {
      handled: true,
      response: { ok: false, reason: "chat_messages_diag_failed", cmdBase },
    };
  }
}