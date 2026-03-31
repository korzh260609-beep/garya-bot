// ============================================================================
// === src/bot/handlers/codeOutputStatus.js — report CODE_OUTPUT_MODE status
// === 12A.0.10 /code_output_status (READ-ONLY, monarch-only)
// ============================================================================

async function requireMonarch(bot, chatId, userIdStr) {
  const MONARCH_USER_ID = String(process.env.MONARCH_USER_ID || "").trim();
  if (!MONARCH_USER_ID) return true;

  if (String(userIdStr) !== MONARCH_USER_ID) {
    await bot.sendMessage(chatId, "⛔ Недостаточно прав (monarch-only).");
    return false;
  }

  return true;
}

function normalizeMode(raw) {
  const value = String(raw || "").trim().toUpperCase();
  if (value === "DRY_RUN") return "DRY_RUN";
  if (value === "ENABLED") return "ENABLED";
  return "DISABLED";
}

export async function handleCodeOutputStatus({
  bot,
  chatId,
  senderIdStr,
}) {
  const effectiveUserIdStr = senderIdStr ? String(senderIdStr) : String(chatId);

  const ok = await requireMonarch(bot, chatId, effectiveUserIdStr);
  if (!ok) return;

  const mode = normalizeMode(process.env.CODE_OUTPUT_MODE);
  const manualApplyOnly = true;
  const deployAllowed = false;

  await bot.sendMessage(
    chatId,
    [
      "CODE OUTPUT STATUS",
      `mode: ${mode}`,
      `manual_apply_only: ${String(manualApplyOnly)}`,
      `auto_deploy_allowed: ${String(deployAllowed)}`,
      "",
      "Policy:",
      "- read-only foundation first",
      "- no auto deploy",
      "- suggestions/diff only unless explicitly approved by monarch",
    ].join("\n")
  );
}

export default {
  handleCodeOutputStatus,
};