// src/core/diagnostics/transportDiag.js
// STAGE 7B — /diag_transport
// Safe transport/runtime diagnostic for enforced transport path.

import { isTransportEnforced } from "../../transport/transportConfig.js";

export async function handleTransportDiag(ctx = {}) {
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
    replyAndLog,
  } = ctx;

  if (cmdBase !== "/diag_transport") {
    return { handled: false };
  }

  if (!isPrivateChat) {
    await replyAndLog("⛔ /diag_transport доступна только в личке.", {
      cmd: cmdBase,
      event: "private_only_block",
    });
    return {
      handled: true,
      ok: true,
      stage: "7B.diag_transport",
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
      stage: "7B.diag_transport",
      result: "monarch_only_block",
      cmdBase,
    };
  }

  try {
    const enforced = isTransportEnforced();

    const lines = [];
    lines.push("🛰️ TRANSPORT DIAG");
    lines.push("");
    lines.push(`chat_id: ${chatIdStr || "—"}`);
    lines.push(`global_user_id: ${globalUserId || "—"}`);
    lines.push(`sender_id: ${senderId || "—"}`);
    lines.push(`message_id: ${messageId || "—"}`);
    lines.push("");
    lines.push("transport:");
    lines.push(`transport=${transport || "—"}`);
    lines.push(`chat_type=${chatType || "—"}`);
    lines.push(`transport_enforced=${String(enforced)}`);
    lines.push(`adapter=TelegramAdapter`);
    lines.push(`core_entry=handleMessage`);
    lines.push(`messageRouter_attached=${enforced ? "false" : "true"}`);
    lines.push("");
    lines.push("effective_runtime_path:");
    if (enforced) {
      lines.push("Telegram");
      lines.push("→ TelegramAdapter");
      lines.push("→ handleMessage(core)");
      lines.push("→ diagnostics/commands");
      lines.push("→ reply");
    } else {
      lines.push("Telegram");
      lines.push("→ messageRouter");
      lines.push("→ handlers");
      lines.push("→ reply");
    }

    await replyAndLog(lines.join("\n").slice(0, 3900), {
      cmd: cmdBase,
      event: "diag_transport",
    });

    return {
      handled: true,
      ok: true,
      stage: "7B.diag_transport",
      result: "diag_transport_replied",
      cmdBase,
    };
  } catch (e) {
    console.error("handleTransportDiag(/diag_transport) failed:", e);
    await replyAndLog("⚠️ /diag_transport failed. Проверь Render logs.", {
      cmd: cmdBase,
      event: "diag_transport_failed",
    });
    return {
      handled: true,
      ok: false,
      reason: "diag_transport_failed",
      cmdBase,
    };
  }
}

export default handleTransportDiag;