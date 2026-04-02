// src/bot/handlers/capabilityDocument.js
// ============================================================================
// STAGE 12A.2 — DOCUMENT GENERATION CAPABILITY (SKELETON)
// Command:
// - /cap_doc [request]
// Purpose:
// - no artifact generation yet
// - no PDF/DOCX export yet
// - safe contract + request capture only
// ============================================================================

import { getCapabilityByKey } from "../../capabilities/capabilityRegistry.js";

async function requireMonarch(bot, chatId, userIdStr) {
  const MONARCH_USER_ID = String(process.env.MONARCH_USER_ID || "").trim();
  if (!MONARCH_USER_ID) return true;

  if (String(userIdStr) !== MONARCH_USER_ID) {
    await bot.sendMessage(chatId, "⛔ Недостаточно прав (monarch-only).");
    return false;
  }

  return true;
}

function normalizeRest(rest) {
  return String(rest || "").trim();
}

function formatDocumentCapabilityText(capability, requestText) {
  const lines = [];

  lines.push("DOCUMENT GENERATION CAPABILITY");
  lines.push(`stage: ${capability?.stage || "12A.2"}`);
  lines.push(`status: ${capability?.status || "skeleton"}`);
  lines.push(`command: ${capability?.command || "/cap_doc"}`);
  lines.push(`readOnly: ${String(capability?.readOnly === true)}`);
  lines.push(`fileOutput: ${String(capability?.fileOutput === true)}`);
  lines.push("");

  lines.push("Current mode:");
  lines.push("- skeleton only");
  lines.push("- no PDF generation");
  lines.push("- no DOCX generation");
  lines.push("- no template/export pipeline");
  lines.push("");

  if (requestText) {
    lines.push("Captured request:");
    lines.push(`- ${requestText}`);
    lines.push("");
  }

  lines.push("Safe next use:");
  lines.push("- use this command to fix document contract and output expectations");
  lines.push("- later connect PDF/DOCX generator without changing command meaning");

  return lines.join("\n");
}

export async function handleCapabilityDocument({ bot, chatId, senderIdStr, rest }) {
  const effectiveUserIdStr = senderIdStr ? String(senderIdStr) : String(chatId);

  const ok = await requireMonarch(bot, chatId, effectiveUserIdStr);
  if (!ok) return;

  const capability = getCapabilityByKey("document_generation");
  const requestText = normalizeRest(rest);

  await bot.sendMessage(
    chatId,
    formatDocumentCapabilityText(capability, requestText)
  );
}

export default {
  handleCapabilityDocument,
};