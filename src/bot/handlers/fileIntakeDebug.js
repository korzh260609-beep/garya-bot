// src/bot/handlers/fileIntakeDebug.js
// ============================================================================
// STAGE 11F.10 — MONARCH/DEV FILE-INTAKE DIAGNOSTICS
// - /file_intake_diag
// - /file_intake_diag_full
//
// PURPOSE:
// - inspect current Telegram file-intake skeleton against a replied message
// - verify summarize / download / process hooks
// - verify cleanup hook
// - verify data lifecycle skeleton
// - verify AI routing rule skeleton
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

function getTopKeys(obj) {
  if (!obj || typeof obj !== "object") return [];
  try {
    return Object.keys(obj).slice(0, 20);
  } catch (_) {
    return [];
  }
}

function pickReplyTarget(msg) {
  if (!msg || typeof msg !== "object") {
    return {
      replyTarget: null,
      replySource: "none",
    };
  }

  if (msg.reply_to_message && typeof msg.reply_to_message === "object") {
    return {
      replyTarget: msg.reply_to_message,
      replySource: "msg.reply_to_message",
    };
  }

  if (msg.replyToMessage && typeof msg.replyToMessage === "object") {
    return {
      replyTarget: msg.replyToMessage,
      replySource: "msg.replyToMessage",
    };
  }

  if (msg.message?.reply_to_message && typeof msg.message.reply_to_message === "object") {
    return {
      replyTarget: msg.message.reply_to_message,
      replySource: "msg.message.reply_to_message",
    };
  }

  if (msg.message?.replyToMessage && typeof msg.message.replyToMessage === "object") {
    return {
      replyTarget: msg.message.replyToMessage,
      replySource: "msg.message.replyToMessage",
    };
  }

  return {
    replyTarget: null,
    replySource: "none",
  };
}

function buildMsgShapeSummary(msg) {
  return {
    hasMsg: Boolean(msg && typeof msg === "object"),
    msgTopKeys: getTopKeys(msg),
    hasReplyToMessage: Boolean(msg?.reply_to_message),
    hasReplyToMessageCamel: Boolean(msg?.replyToMessage),
    hasNestedMessage: Boolean(msg?.message && typeof msg.message === "object"),
    nestedMessageTopKeys: getTopKeys(msg?.message),
    hasNestedReplyToMessage: Boolean(msg?.message?.reply_to_message),
    hasNestedReplyToMessageCamel: Boolean(msg?.message?.replyToMessage),
    messageId: msg?.message_id ?? null,
    chatId: msg?.chat?.id ?? null,
    text: typeof msg?.text === "string" ? msg.text : null,
    caption: typeof msg?.caption === "string" ? msg.caption : null,
  };
}

function compactMediaSummary(mediaSummary) {
  return {
    kind: mediaSummary?.kind || "n/a",
    chatId: mediaSummary?.chatId ?? null,
    messageId: mediaSummary?.messageId ?? null,
    fileId: mediaSummary?.fileId || "n/a",
    fileUniqueId: mediaSummary?.fileUniqueId || "n/a",
    fileName: mediaSummary?.fileName || "n/a",
    mimeType: mediaSummary?.mimeType || "n/a",
    fileSize: mediaSummary?.fileSize ?? "n/a",
    captionPresent: Boolean(mediaSummary?.caption),
  };
}

function compactProcessSummary(processResult) {
  return {
    ok: processResult?.ok === true,
    processedText: processResult?.processedText || "n/a",
    directUserHintPresent: Boolean(processResult?.directUserHint),
  };
}

function compactCleanupSummary(cleanupResult) {
  return {
    ok: cleanupResult?.ok === true,
    removed: cleanupResult?.removed === true,
    reason: cleanupResult?.reason || "n/a",
    localPath: cleanupResult?.localPath || "n/a",
    error: cleanupResult?.error || null,
  };
}

function compactLogs(metaLogs) {
  if (!Array.isArray(metaLogs)) return [];
  return metaLogs.slice(-5).map((l) => ({
    t: l?.t || null,
    level: l?.level || null,
    step: l?.step || null,
    msg: l?.msg || null,
  }));
}

function buildLifecycleSummary(FileIntake, lifecycle) {
  if (typeof FileIntake?.compactLifecycleForDebug === "function") {
    return FileIntake.compactLifecycleForDebug(lifecycle);
  }

  return {
    lifecycleVersion: lifecycle?.lifecycleVersion || "n/a",
    kind: lifecycle?.kind || "n/a",
    binaryPersisted: lifecycle?.storage?.binaryPersisted === true,
    tempLocalPath: lifecycle?.storage?.tempLocalPath || null,
    tempExists: lifecycle?.storage?.tempExists === true,
    downloaded: lifecycle?.processing?.downloaded === true,
    processed: lifecycle?.processing?.processed === true,
    cleanupAttempted: lifecycle?.processing?.cleanupAttempted === true,
    cleanupRemoved: lifecycle?.processing?.cleanupRemoved === true,
    cleanupReason: lifecycle?.processing?.cleanupReason || null,
    retentionEnabled: lifecycle?.retention?.enabled === true,
    archiveEnabled: lifecycle?.retention?.archiveEnabled === true,
    binaryPersistenceAllowed: lifecycle?.retention?.binaryPersistenceAllowed === true,
    policy: lifecycle?.storage?.policy || "n/a",
    routing:
      typeof FileIntake?.compactRoutingRuleForDebug === "function"
        ? FileIntake.compactRoutingRuleForDebug(lifecycle?.routing || null)
        : null,
  };
}

function buildRoutingSummary(FileIntake, mediaSummary, lifecycleSummary) {
  if (lifecycleSummary?.routing) {
    return lifecycleSummary.routing;
  }

  if (typeof FileIntake?.buildSpecializedAIRoutingRule === "function") {
    const rule = FileIntake.buildSpecializedAIRoutingRule(mediaSummary);
    if (typeof FileIntake?.compactRoutingRuleForDebug === "function") {
      return FileIntake.compactRoutingRuleForDebug(rule);
    }
    return rule;
  }

  return null;
}

function buildShortText({
  replyTarget,
  replySource,
  tokenPresent,
  mediaSummary,
  intakeResult,
  processResult,
  cleanupResult,
  lifecycleSummary,
  routingSummary,
  errorMessage,
}) {
  return [
    getTitle("short"),
    `reply_target: ${replyTarget ? "yes" : "no"}`,
    `reply_source: ${replySource || "n/a"}`,
    `token_present: ${toBoolText(tokenPresent)}`,
    `media_found: ${toBoolText(Boolean(mediaSummary))}`,
    `kind: ${mediaSummary?.kind || "n/a"}`,
    `file_id: ${mediaSummary?.fileId || "n/a"}`,
    `file_name: ${mediaSummary?.fileName || "n/a"}`,
    `mime_type: ${mediaSummary?.mimeType || "n/a"}`,
    `download_ok: ${toBoolText(Boolean(intakeResult?.downloaded?.localPath))}`,
    `process_ok: ${toBoolText(processResult?.ok === true)}`,
    `cleanup_ok: ${toBoolText(cleanupResult?.ok === true)}`,
    `cleanup_removed: ${toBoolText(cleanupResult?.removed === true)}`,
    `lifecycle_policy: ${lifecycleSummary?.policy || "n/a"}`,
    `binary_persisted: ${toBoolText(lifecycleSummary?.binaryPersisted === true)}`,
    `ai_route: ${routingSummary?.specializedRoute || "n/a"}`,
    `provider_required: ${toBoolText(routingSummary?.specializedProviderRequired === true)}`,
    `provider_active: ${toBoolText(routingSummary?.specializedProviderActive === true)}`,
    `generic_ai_binary: ${toBoolText(routingSummary?.genericAiAllowedToSeeBinary === true)}`,
    `generic_ai_mode: ${routingSummary?.genericAiMode || "n/a"}`,
    errorMessage ? `error: ${errorMessage}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

function buildFullText({
  msgShape,
  replyTarget,
  replySource,
  tokenPresent,
  mediaSummary,
  intakeResult,
  processResult,
  cleanupResult,
  lifecycleSummary,
  routingSummary,
  errorMessage,
}) {
  const metaLogs =
    cleanupResult?.meta?.logs ||
    intakeResult?.meta?.logs ||
    processResult?.meta?.logs ||
    [];

  const media = compactMediaSummary(mediaSummary);
  const process = compactProcessSummary(processResult);
  const cleanup = compactCleanupSummary(cleanupResult);
  const logs = compactLogs(metaLogs);

  return [
    getTitle("full"),
    `reply_target: ${replyTarget ? "yes" : "no"}`,
    `reply_source: ${replySource || "n/a"}`,
    `token_present: ${toBoolText(tokenPresent)}`,
    "",
    `msg_has_object: ${toBoolText(msgShape?.hasMsg === true)}`,
    `msg_has_reply_to_message: ${toBoolText(msgShape?.hasReplyToMessage === true)}`,
    `msg_has_replyToMessage: ${toBoolText(msgShape?.hasReplyToMessageCamel === true)}`,
    `msg_has_nested_message: ${toBoolText(msgShape?.hasNestedMessage === true)}`,
    `msg_has_nested_reply_to_message: ${toBoolText(msgShape?.hasNestedReplyToMessage === true)}`,
    `msg_has_nested_replyToMessage: ${toBoolText(msgShape?.hasNestedReplyToMessageCamel === true)}`,
    `msg_message_id: ${msgShape?.messageId ?? "n/a"}`,
    `msg_chat_id: ${msgShape?.chatId ?? "n/a"}`,
    `msg_text: ${msgShape?.text || "n/a"}`,
    `msg_caption: ${msgShape?.caption || "n/a"}`,
    "",
    `media_found: ${toBoolText(Boolean(mediaSummary))}`,
    `kind: ${media.kind}`,
    `file_id: ${media.fileId}`,
    `file_unique_id: ${media.fileUniqueId}`,
    `file_name: ${media.fileName}`,
    `mime_type: ${media.mimeType}`,
    `file_size: ${media.fileSize}`,
    `caption_present: ${toBoolText(media.captionPresent)}`,
    "",
    `download_ok: ${toBoolText(Boolean(intakeResult?.downloaded?.localPath))}`,
    `download_local_path: ${intakeResult?.downloaded?.localPath || "n/a"}`,
    `download_file_name: ${intakeResult?.downloaded?.fileName || "n/a"}`,
    `download_size: ${intakeResult?.downloaded?.size ?? "n/a"}`,
    "",
    `process_ok: ${toBoolText(process.ok)}`,
    `processed_text: ${process.processedText}`,
    `direct_hint: ${processResult?.directUserHint || "n/a"}`,
    "",
    `cleanup_ok: ${toBoolText(cleanup.ok)}`,
    `cleanup_removed: ${toBoolText(cleanup.removed)}`,
    `cleanup_reason: ${cleanup.reason}`,
    `cleanup_local_path: ${cleanup.localPath}`,
    cleanup.error ? `cleanup_error: ${cleanup.error}` : null,
    "",
    `lifecycle_version: ${lifecycleSummary?.lifecycleVersion || "n/a"}`,
    `lifecycle_kind: ${lifecycleSummary?.kind || "n/a"}`,
    `lifecycle_policy: ${lifecycleSummary?.policy || "n/a"}`,
    `binary_persisted: ${toBoolText(lifecycleSummary?.binaryPersisted === true)}`,
    `temp_local_path: ${lifecycleSummary?.tempLocalPath || "n/a"}`,
    `temp_exists: ${toBoolText(lifecycleSummary?.tempExists === true)}`,
    `lifecycle_downloaded: ${toBoolText(lifecycleSummary?.downloaded === true)}`,
    `lifecycle_processed: ${toBoolText(lifecycleSummary?.processed === true)}`,
    `cleanup_attempted: ${toBoolText(lifecycleSummary?.cleanupAttempted === true)}`,
    `lifecycle_cleanup_removed: ${toBoolText(lifecycleSummary?.cleanupRemoved === true)}`,
    `lifecycle_cleanup_reason: ${lifecycleSummary?.cleanupReason || "n/a"}`,
    `retention_enabled: ${toBoolText(lifecycleSummary?.retentionEnabled === true)}`,
    `archive_enabled: ${toBoolText(lifecycleSummary?.archiveEnabled === true)}`,
    `binary_persistence_allowed: ${toBoolText(
      lifecycleSummary?.binaryPersistenceAllowed === true
    )}`,
    "",
    `ai_route_version: ${routingSummary?.routeVersion || "n/a"}`,
    `ai_route: ${routingSummary?.specializedRoute || "n/a"}`,
    `provider_required: ${toBoolText(routingSummary?.specializedProviderRequired === true)}`,
    `provider_active: ${toBoolText(routingSummary?.specializedProviderActive === true)}`,
    `generic_ai_binary: ${toBoolText(routingSummary?.genericAiAllowedToSeeBinary === true)}`,
    `generic_ai_mode: ${routingSummary?.genericAiMode || "n/a"}`,
    `fallback_mode: ${routingSummary?.fallbackMode || "n/a"}`,
    "",
    `logs_count: ${Array.isArray(metaLogs) ? metaLogs.length : 0}`,
    "logs_tail:",
    ...logs.map(
      (l, i) =>
        `${i + 1}) [${l.level || "n/a"}] ${l.step || "n/a"} — ${l.msg || "n/a"}`
    ),
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

  const msgShape = buildMsgShapeSummary(msg);
  const { replyTarget, replySource } = pickReplyTarget(msg);

  if (!replyTarget) {
    const text =
      mode === "full"
        ? [
            getTitle(mode),
            "reason: missing_reply_target",
            "usage: reply to a media message with /file_intake_diag",
            "",
            `reply_source: ${replySource}`,
            `msg_has_object: ${toBoolText(msgShape?.hasMsg === true)}`,
            `msg_has_reply_to_message: ${toBoolText(msgShape?.hasReplyToMessage === true)}`,
            `msg_has_nested_reply_to_message: ${toBoolText(
              msgShape?.hasNestedReplyToMessage === true
            )}`,
            `msg_top_keys: ${msgShape?.msgTopKeys?.join(", ") || "n/a"}`,
          ].join("\n")
        : [
            getTitle(mode),
            "reason: missing_reply_target",
            "usage: reply to a media message with /file_intake_diag",
            `reply_source: ${replySource}`,
            `msg_has_reply_to_message: ${toBoolText(msgShape?.hasReplyToMessage === true)}`,
            `msg_has_nested_reply_to_message: ${toBoolText(
              msgShape?.hasNestedReplyToMessage === true
            )}`,
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

  const cleanupIntakeTempFiles =
    typeof FileIntake?.cleanupIntakeTempFiles === "function"
      ? FileIntake.cleanupIntakeTempFiles
      : null;

  const mediaSummary = summarizeMediaAttachment(replyTarget);

  if (!mediaSummary) {
    const text =
      mode === "full"
        ? [
            getTitle(mode),
            "reason: no_media_in_reply_target",
            "media_found: no",
            `reply_source: ${replySource}`,
            `reply_target_top_keys: ${getTopKeys(replyTarget).join(", ") || "n/a"}`,
            `has_photo: ${toBoolText(Boolean(replyTarget?.photo))}`,
            `has_document: ${toBoolText(Boolean(replyTarget?.document))}`,
            `has_voice: ${toBoolText(Boolean(replyTarget?.voice))}`,
            `has_audio: ${toBoolText(Boolean(replyTarget?.audio))}`,
            `has_video: ${toBoolText(Boolean(replyTarget?.video))}`,
          ].join("\n")
        : [
            getTitle(mode),
            "reason: no_media_in_reply_target",
            "media_found: no",
            `reply_source: ${replySource}`,
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
  let cleanupResult = null;
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
  } finally {
    if (intakeResult && cleanupIntakeTempFiles) {
      try {
        cleanupResult = cleanupIntakeTempFiles(intakeResult);
      } catch (cleanupError) {
        cleanupResult = {
          ok: false,
          removed: false,
          reason: "cleanup_failed",
          error: cleanupError?.message
            ? String(cleanupError.message)
            : "unknown_error",
          localPath: intakeResult?.downloaded?.localPath || null,
          meta: intakeResult?.meta || null,
        };
      }
    }
  }

  const lifecycleSummary = buildLifecycleSummary(
    FileIntake,
    intakeResult?.lifecycle || processResult?.lifecycle || null
  );

  const routingSummary = buildRoutingSummary(
    FileIntake,
    mediaSummary,
    lifecycleSummary
  );

  const text =
    mode === "full"
      ? buildFullText({
          msgShape,
          replyTarget,
          replySource,
          tokenPresent,
          mediaSummary,
          intakeResult,
          processResult,
          cleanupResult,
          lifecycleSummary,
          routingSummary,
          errorMessage,
        })
      : buildShortText({
          replyTarget,
          replySource,
          tokenPresent,
          mediaSummary,
          intakeResult,
          processResult,
          cleanupResult,
          lifecycleSummary,
          routingSummary,
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