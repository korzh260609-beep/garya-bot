// ============================================================================
// src/bot/handlers/workflowCheck.js
// Stage 5.3 — Workflow check (READ-ONLY, NO AI)
// SKELETON ONLY
// ============================================================================

import fs from "fs";
import path from "path";
import pool from "../../../db.js";
import { RepoIndexStore } from "../../repo/RepoIndexStore.js";

// ---------------------------------------------------------------------------
// Monarch guard — Stage 4: identity-first (MONARCH_USER_ID)
// ---------------------------------------------------------------------------
async function requireMonarch(bot, chatId, userIdStr) {
  const MONARCH_USER_ID = String(process.env.MONARCH_USER_ID || "").trim();
  if (!MONARCH_USER_ID) return true;

  if (String(userIdStr) !== MONARCH_USER_ID) {
    await bot.sendMessage(chatId, "⛔ Недостаточно прав (monarch-only).");
    return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Load workflow hints (CONFIG)
// ---------------------------------------------------------------------------
function loadWorkflowHints() {
  const filePath = path.resolve("pillars/WORKFLOW_HINTS.json");
  const raw = fs.readFileSync(filePath, "utf8");
  return JSON.parse(raw);
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------
export async function handleWorkflowCheck({ bot, chatId, senderIdStr, rest }) {
  const effectiveUserIdStr = senderIdStr ? String(senderIdStr) : String(chatId);

  const ok = await requireMonarch(bot, chatId, effectiveUserIdStr);
  if (!ok) return;

  const step = String(rest || "").trim();
  if (!step) {
    await bot.sendMessage(chatId, "Usage: /workflow_check <step>");
    return;
  }

  const hints = loadWorkflowHints();
  const cfg = hints.steps?.[step];

  if (!cfg) {
    await bot.sendMessage(chatId, `WorkflowCheck: unknown step "${step}"`);
    return;
  }

  // NOTE:
  // Реальная логика проверки (paths/search) будет добавлена в следующем подшаге.
  // Сейчас — только скелет и подтверждение загрузки конфига.

  await bot.sendMessage(
    chatId,
    [
      "WORKFLOW CHECK (SKELETON)",
      `step: ${step}`,
      `title: ${cfg.title || "-"}`,
      "",
      "status: not_evaluated",
      "note: skeleton only, no checks executed yet",
    ].join("\n")
  );
}
