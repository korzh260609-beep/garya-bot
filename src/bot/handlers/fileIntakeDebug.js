// src/bot/handlers/fileIntakeDebug.js
// ============================================================================
// STAGE 11F.10 — MONARCH/DEV FILE-INTAKE DIAGNOSTICS
// - /file_intake_diag
// - /file_intake_diag_full
//
// PURPOSE:
// - inspect current Telegram file-intake skeleton against a replied message
// - verify summarize / download / process hooks
// - keep diagnostics deterministic
// - no AI usage
// - fail-open
//
// USAGE:
// - reply to a media message with:
//   /file_intake_diag
//   /file_intake_diag_full
// ============================================================================

import * as FileIntake from "../../media/fileIntake.js";
import { envStr } from "../../core/config.js";

function getMode(cmd = "") {
  return cmd === "/file_intake_diag_full" ? "full" : "short";
}

function getTitle(mode = "short") {
  return mode === "full"
    ? "🧪 FILE INTAKE DIAGNOSTICS FULL"
    : "🧪 FILE INTAKE DIAGNOSTICS";
}

function getDefaultCmd(mode = "short") {
  return mode === "full"
    ? "/file_intake_diag_full"
    : "/file_intake_diag";
}

function toBoolText(v) {
  return v === true ? "yes" : "no";
}

function safeJson(value, limit = 1200) {
  try {
    return JSON.stringify(value, null, 2).slice(0, limit);
  } catch (_) {
    return "n/a";
  }
}

function getReplyTargetMessage(msg) {
  return msg?.reply_to_message && typeof msg.reply_to_message === "object"
    ? msg.reply_to_message
    : null;
}

function buildShortText({
  replyTarget,
  tokenPresent,
  mediaSummary,
  intakeResult,
  processResult,
  errorMessage,
}) {
  return [
    getTitle("short"),
    `reply_target: ${replyTarget ? "yes" : "no"}`,
    `token_present: ${toBoolText(tokenPresent)}`,
    `media_found: ${toBoolText(Boolean(mediaSummary))}`,
    `kind: ${mediaSummary?.kind || "n/a"}`,
    `file_id: ${mediaSummary?.fileId || "n/a"}`,
    `file_name: ${mediaSummary?.fileName || "n/a"}`,
    `mime_type: ${mediaSummary?.mimeType || "n/a"}`,
    `download_ok: ${toBoolText(Boolean(intakeResult?.downloaded?.localPath))}`,
    `process_ok: ${toBoolText(processResult?.ok === true)}`,
    `direct_hint: ${processResult?.directUserHint ? "yes" : "no"}`,
    errorMessage ? `error: ${errorMessage}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

function buildFullText({
  replyTarget,
  tokenPresent,
  mediaSummary,
  intakeResult,
  processResult,
  errorMessage,
}) {
  const metaLogs = intakeResult?.meta?.logs || processResult?.meta?.logs || [];

  return [
    getTitle("full"),
    `reply_target: ${replyTarget ? "yes" : "no"}`,
    `token_present: ${toBoolText(tokenPresent)}`,
    "",
    `media_found: ${toBoolText(Boolean(mediaSummary))}`,
    `kind: ${mediaSummary?.kind || "n/a"}`,
    `file_id: ${mediaSummary?.fileId || "n/a"}`,
    `file_unique_id: ${mediaSummary?.fileUniqueId || "n/a"}`,
    `file_name: ${mediaSummary?.fileName || "n/a"}`,
    `mime_type: ${mediaSummary?.mimeType || "n/a"}`,
    `file_size: ${mediaSummary?.fileSize ?? "n/a"}`,
    `caption_present: ${toBoolText(Boolean(mediaSummary?.caption))}`,
    "",
    `download_ok: ${toBoolText(Boolean(intakeResult?.downloaded?.localPath))}`,
    `download_local_path: ${intakeResult?.downloaded?.localPath || "n/a"}`,
    `download_file_name: ${intakeResult?.downloaded?.fileName || "n/a"}`,
    `download_size: ${intakeResult?.downloaded?.size ?? "n/a"}`,
    "",
    `process_ok: ${toBoolText(processResult?.ok === true)}`,
    `processed_text: ${processResult?.processedText || "n/a"}`,
    `direct_hint: ${processResult?.directUserHint || "n/a"}`,
    "",
    `logs_count: ${Array.isArray(metaLogs) ? metaLogs.length : 0}`,
    "summary_json:",
    safeJson(mediaSummary, 1200),
    "",
    "process_json:",
    safeJson(
      {
        ok: processResult?.ok === true,
        processedText: processResult?.processedText || null,
        directUserHint: processResult?.directUserHint || null,
      },
      1200
    ),
    "",
    "logs_json:",
    safeJson(metaLogs, 2000),
    errorMessage ? `error: ${errorMessage}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

export async function handleFileIntakeDebug({
  bot,
  chatId,
  msg,
  reply,
  bypass,
  cmd,
}) {
  const mode = getMode(cmd);
  const defaultCmd = getDefaultCmd(mode);

  if (!bypass) {
    await reply("⛔ DEV only.", {
      cmd: cmd || defaultCmd,
      handler: "fileIntakeDebug",
      event: "forbidden",
      mode,
    });
    return { handled: true };
  }

  const replyTarget = getReplyTargetMessage(msg);

  if (!replyTarget) {
    const text = [
      getTitle(mode),
      "reason: missing_reply_target",
      "usage: reply to a media message with /file_intake_diag",
    ].join("\n");

    await reply(text, {
      cmd: cmd || defaultCmd,
      handler: "fileIntakeDebug",
      event: "missing_reply_target",
      mode,
    });
    return { handled: true };
  }

  const token = envStr("TELEGRAM_BOT_TOKEN", "");
  const tokenPresent = Boolean(String(token || "").trim());

  const summarizeMediaAttachment =
    typeof FileIntake?.summarizeMediaAttachment === "function"
      ? FileIntake.summarizeMediaAttachment
      : () => null;

  const intakeAndDownloadIfNeeded =
    typeof FileIntake?.intakeAndDownloadIfNeeded === "function"
      ? FileIntake.intakeAndDownloadIfNeeded
      : null;

  const processFile =
    typeof FileIntake?.processFile === "function"
      ? FileIntake.processFile
      : null;

  const mediaSummary = summarizeMediaAttachment(replyTarget);

  if (!mediaSummary) {
    const text = [
      getTitle(mode),
      "reason: no_media_in_reply_target",
      "media_found: no",
    ].join("\n");

    await reply(text, {
      cmd: cmd || defaultCmd,
      handler: "fileIntakeDebug",
      event: "no_media",
      mode,
    });
    return { handled: true };
  }

  let intakeResult = null;
  let processResult = null;
  let errorMessage = null;

  try {
    if (tokenPresent && intakeAndDownloadIfNeeded && processFile) {
      intakeResult = await intakeAndDownloadIfNeeded(replyTarget, token);
      if (intakeResult) {
        processResult = await processFile(intakeResult);
      }
    } else if (!tokenPresent) {
      errorMessage = "telegram_bot_token_missing";
    } else {
      errorMessage = "file_intake_runtime_hooks_missing";
    }
  } catch (error) {
    errorMessage = error?.message ? String(error.message) : "unknown_error";
  }

  const text =
    mode === "full"
      ? buildFullText({
          replyTarget,
          tokenPresent,
          mediaSummary,
          intakeResult,
          processResult,
          errorMessage,
        })
      : buildShortText({
          replyTarget,
          tokenPresent,
          mediaSummary,
          intakeResult,
          processResult,
          errorMessage,
        });

  await reply(text, {
    cmd: cmd || defaultCmd,
    handler: "fileIntakeDebug",
    event: errorMessage ? "diag_partial" : "diag_ready",
    mode,
    kind: mediaSummary?.kind || null,
  });

  return { handled: true };
}

export default {
  handleFileIntakeDebug,
};