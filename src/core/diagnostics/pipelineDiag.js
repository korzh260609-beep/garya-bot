// src/core/diagnostics/pipelineDiag.js
// STAGE 7B — /diag_pipeline
// Safe logical pipeline diagnostic for enforced transport path.

import { isTransportEnforced } from "../../transport/transportConfig.js";

export async function handlePipelineDiag(ctx = {}) {
  const {
    cmdBase,
    isPrivateChat,
    isMonarchUser,
    globalUserId,
    chatIdStr,
    senderId,
    messageId,
    transport,
    chatType,
    trimmed,
    replyAndLog,
  } = ctx;

  if (cmdBase !== "/diag_pipeline") {
    return { handled: false };
  }

  if (!isPrivateChat) {
    await replyAndLog("⛔ /diag_pipeline доступна только в личке.", {
      cmd: cmdBase,
      event: "private_only_block",
    });
    return {
      handled: true,
      ok: true,
      stage: "7B.diag_pipeline",
      result: "private_only_block",
      cmdBase,
    };
  }

  if (!isMonarchUser) {
    await replyAndLog("⛔ Недостаточно прав (monarch-only).", {
      cmd: cmdBase,
      event: "monarch_only_block",
    });
    return {
      handled: true,
      ok: true,
      stage: "7B.diag_pipeline",
      result: "monarch_only_block",
      cmdBase,
    };
  }

  try {
    const enforced = isTransportEnforced();
    const isCommand = String(trimmed || "").startsWith("/");

    const lines = [];
    lines.push("🧩 PIPELINE DIAG");
    lines.push("");
    lines.push(`chat_id: ${chatIdStr || "—"}`);
    lines.push(`global_user_id: ${globalUserId || "—"}`);
    lines.push(`sender_id: ${senderId || "—"}`);
    lines.push(`message_id: ${messageId || "—"}`);
    lines.push("");
    lines.push("input:");
    lines.push(`transport=${transport || "—"}`);
    lines.push(`chat_type=${chatType || "—"}`);
    lines.push(`is_command=${String(isCommand)}`);
    lines.push(`transport_enforced=${String(enforced)}`);
    lines.push("");
    lines.push("pipeline:");

    if (enforced) {
      lines.push("1. Telegram webhook/update");
      lines.push("2. TelegramAdapter.attach()");
      lines.push("3. toContext(msg)");
      lines.push("4. toCoreContextFromUnified(...)");
      lines.push("5. handleMessage(context)");
      lines.push("6. access/identity resolution");
      lines.push("7. command idempotency / dedupe guards");
      lines.push("8. diagnostics registry");
      lines.push("9. command dispatcher OR chat handler");
      lines.push("10. replyAndLog()");
      lines.push("11. Telegram sendMessage()");
      lines.push("12. assistant log -> chat_messages");
    } else {
      lines.push("1. Telegram webhook/update");
      lines.push("2. messageRouter");
      lines.push("3. command/chat handler");
      lines.push("4. Telegram sendMessage()");
    }

    lines.push("");
    lines.push("authoritative_path:");
    if (enforced) {
      lines.push("Telegram");
      lines.push("→ TelegramAdapter");
      lines.push("→ UnifiedContext");
      lines.push("→ CoreContext");
      lines.push("→ handleMessage(core)");
      lines.push("→ diagnostics / commands / chat");
      lines.push("→ replyAndLog");
      lines.push("→ Telegram reply");
    } else {
      lines.push("Telegram");
      lines.push("→ messageRouter");
      lines.push("→ handlers");
      lines.push("→ reply");
    }

    lines.push("");
    lines.push("stage_hint:");
    lines.push("Stage 7B foundation / enforced transport runtime");

    await replyAndLog(lines.join("\n").slice(0, 3900), {
      cmd: cmdBase,
      event: "diag_pipeline",
    });

    return {
      handled: true,
      ok: true,
      stage: "7B.diag_pipeline",
      result: "diag_pipeline_replied",
      cmdBase,
    };
  } catch (e) {
    console.error("handlePipelineDiag(/diag_pipeline) failed:", e);
    await replyAndLog("⚠️ /diag_pipeline failed. Проверь Render logs.", {
      cmd: cmdBase,
      event: "diag_pipeline_failed",
    });
    return {
      handled: true,
      ok: false,
      reason: "diag_pipeline_failed",
      cmdBase,
    };
  }
}

export default handlePipelineDiag;