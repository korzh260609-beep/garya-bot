// ============================================================================
// === src/bot/handlers/codeOutputStatus.js — report CODE_OUTPUT_MODE status
// === 12A.0.10 /code_output_status (READ-ONLY, monarch-only)
// ============================================================================

import { requireMonarchPrivateAccess } from "./handlerAccess.js";

function normalizeMode(raw) {
  const value = String(raw || "").trim().toUpperCase();
  if (value === "DRY_RUN") return "DRY_RUN";
  if (value === "ENABLED") return "ENABLED";
  return "DISABLED";
}

export async function handleCodeOutputStatus(ctx = {}) {
  const ok = await requireMonarchPrivateAccess(ctx);
  if (!ok) return;

  const mode = normalizeMode(process.env.CODE_OUTPUT_MODE);
  const manualApplyOnly = true;
  const deployAllowed = false;

  await ctx.bot.sendMessage(
    ctx.chatId,
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