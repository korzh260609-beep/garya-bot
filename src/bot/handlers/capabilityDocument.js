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
import { requireMonarchPrivateAccess } from "./handlerAccess.js";

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

export async function handleCapabilityDocument(ctx = {}) {
  const ok = await requireMonarchPrivateAccess(ctx);
  if (!ok) return;

  const capability = getCapabilityByKey("document_generation");
  const requestText = normalizeRest(ctx.rest);

  await ctx.bot.sendMessage(
    ctx.chatId,
    formatDocumentCapabilityText(capability, requestText)
  );
}

export default {
  handleCapabilityDocument,
};