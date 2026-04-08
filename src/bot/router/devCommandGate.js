import BehaviorEventsService from "../../logging/BehaviorEventsService.js";

const DEV_COMMANDS = new Set([
  "/reindex",
  "/repo_status",
  "/repo_tree",
  "/repo_file",
  "/repo_search",
  "/repo_get",
  "/repo_check",
  "/repo_review",
  "/repo_review2",
  "/repo_analyze",
  "/repo_diff",
  "/code_fullfile",
  "/code_insert",
  "/code_output_status",
  "/workflow_check",
  "/build_info",
  "/pm_set",
  "/pm_show",
  "/memory_status",
  "/memory_diag",
  "/memory_integrity",
  "/memory_backfill",
  "/memory_user_chats",
  "/chat_meta_debug",
  "/behavior_events_last",
  "/chat_messages_diag",

  "/chat_on",
  "/chat_off",
  "/chat_status",

  // System/global task controls — NOT user-scoped
  "/start_task",
  "/stop_all",
  "/tasks_owner_diag",

  "/sources_diag",

  "/approve",
  "/deny",
  "/file_logs",
  "/ar_list",
  "/chat_diag",

  // Stage 12A capability surface — monarch-private / dev-only
  "/capabilities",
  "/capability",
  "/cap_diagram",
  "/cap_doc",
  "/cap_automation",
]);

export async function devCommandGate({
  cmdBase,
  isMonarchUser,
  isPrivate,
  chatType,
  chatIdStr,
  senderIdStr,
  transportChatType,
  accessPack,
  ctxReply,
}) {
  const isDev = DEV_COMMANDS.has(cmdBase);
  const devAllowInGroup = false;

  if (!isDev) {
    return { handled: false, isDev: false };
  }

  if (isMonarchUser && (isPrivate || devAllowInGroup)) {
    return { handled: false, isDev: true };
  }

  await ctxReply(
    [
      "⛔ DEV only.",
      `cmd=${cmdBase}`,
      `chatType=${chatType}`,
      `private=${isPrivate}`,
      `monarch=${isMonarchUser}`,
      `chatId=${chatIdStr}`,
      `from=${senderIdStr}`,
      `transportChatType=${String(transportChatType || "")}`,
      `chatIdEqFrom=${chatIdStr === senderIdStr}`,
    ].join("\n"),
    { cmd: cmdBase, handler: "messageRouter", event: "dev_only_block" }
  );

  try {
    const behaviorEvents = new BehaviorEventsService();
    await behaviorEvents.logEvent({
      globalUserId: accessPack?.user?.global_user_id || null,
      chatId: chatIdStr,
      eventType: "risk_warning_shown",
      metadata: {
        reason: "dev_only_command",
        command: cmdBase,
      },
    });
  } catch (e) {
    console.error("behavior_events log failed:", e);
  }

  return { handled: true, isDev: true };
}

export { DEV_COMMANDS };