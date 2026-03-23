// src/core/handleMessage/commandFlow/diagnostics/chatMessagesDiagFormatter.js

import { safeDiagText, safeDiagTs } from "../../shared.js";

export function formatChatMessagesDiag({
  chatIdStr,
  globalUserId,
  totalChatMessages,
  totalDedupeEvents,
  lastUser,
  lastAssistant,
  lastDedupe,
}) {
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

  return lines.join("\n").slice(0, 3900);
}