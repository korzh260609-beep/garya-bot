// src/bot/handlers/taDebug.js
// ============================================================================
// STAGE 10C.29
// MONARCH/DEV COMMAND HANDLER — /ta_debug
//
// PURPOSE:
// - let SG read coingecko indicators debug reader through existing source layer
// - return compact SG-friendly snapshot to chat
// - no SourceService changes
// - no chat runtime refactor
// - no execution logic
// ============================================================================

import { readCoingeckoIndicatorsDebug } from "../../sources/readCoingeckoIndicatorsDebug.js";

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeCoinId(value) {
  return normalizeString(value).toLowerCase() || "bitcoin";
}

function normalizeVsCurrency(value) {
  return normalizeString(value).toLowerCase() || "usd";
}

function normalizeDays(value) {
  const raw = normalizeString(value).toLowerCase();

  if (!raw) return "30";
  if (raw === "max") return "max";

  const n = Number(raw);
  if (Number.isFinite(n) && n > 0) {
    return String(Math.trunc(n));
  }

  return "30";
}

function normalizePositiveInt(value, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;

  const out = Math.trunc(n);
  return out > 0 ? out : fallback;
}

function parseTaDebugArgs(rest = "") {
  const raw = normalizeString(rest);

  if (!raw) {
    return {
      coinId: "bitcoin",
      vsCurrency: "usd",
      days: "30",
      emaPeriod: 20,
      rsiPeriod: 14,
      timeoutMs: 8000,
    };
  }

  const parts = raw.split(/\s+/).filter(Boolean);

  return {
    coinId: normalizeCoinId(parts[0]),
    vsCurrency: normalizeVsCurrency(parts[1] || "usd"),
    days: normalizeDays(parts[2] || "30"),
    emaPeriod: normalizePositiveInt(parts[3], 20),
    rsiPeriod: normalizePositiveInt(parts[4], 14),
    timeoutMs: normalizePositiveInt(parts[5], 8000),
  };
}

function buildSuccessText(result = {}, input = {}) {
  const branch = result?.sgView?.branch || "unknown";
  const status = result?.sgView?.status || "unknown";
  const readiness = result?.sgView?.readiness || "unknown";

  const shortText = normalizeString(result?.sgView?.shortText) || "n/a";
  const note = normalizeString(result?.sgView?.note) || "n/a";

  const signal = result?.snapshot?.signal || "n/a";
  const confidence = result?.snapshot?.confidence || "n/a";
  const triggerStatus = result?.snapshot?.triggerStatus || "n/a";
  const readinessScore =
    typeof result?.snapshot?.readinessScore === "number"
      ? result.snapshot.readinessScore
      : "n/a";
  const bias = result?.snapshot?.bias || "n/a";
  const hint = result?.snapshot?.hint || "n/a";
  const context = result?.snapshot?.context || "n/a";
  const setup = result?.snapshot?.setup || "n/a";
  const priority = result?.snapshot?.priority || "n/a";
  const attentionLevel = result?.snapshot?.attentionLevel || "n/a";
  const summaryLine = normalizeString(result?.snapshot?.summaryLine) || "n/a";
  const branchReason =
    normalizeString(result?.snapshot?.branchReason) || "n/a";

  return [
    "🧪 TA DEBUG",
    `coin: ${input.coinId}`,
    `vs: ${input.vsCurrency}`,
    `days: ${input.days}`,
    "",
    `branch: ${branch}`,
    `status: ${status}`,
    `readiness: ${readiness}`,
    "",
    `signal: ${signal}`,
    `confidence: ${confidence}`,
    `trigger: ${triggerStatus}`,
    `readiness_score: ${readinessScore}`,
    `bias: ${bias}`,
    `hint: ${hint}`,
    `context: ${context}`,
    `setup: ${setup}`,
    `priority: ${priority}`,
    `attention: ${attentionLevel}`,
    "",
    `short: ${shortText}`,
    `note: ${note}`,
    `summary: ${summaryLine}`,
    `reason: ${branchReason}`,
  ].join("\n");
}

function buildErrorText(result = {}, input = {}) {
  const reason = result?.reason || "unknown_error";
  const status = result?.http?.status ?? "n/a";
  const message = result?.meta?.message || result?.meta?.error || "n/a";
  const rawPreview = normalizeString(result?.raw?.rawPreview || "");
  const previewShort = rawPreview ? rawPreview.slice(0, 300) : "n/a";

  return [
    "⛔ TA DEBUG",
    `coin: ${input.coinId}`,
    `vs: ${input.vsCurrency}`,
    `days: ${input.days}`,
    `reason: ${reason}`,
    `http_status: ${status}`,
    `message: ${message}`,
    `raw_preview: ${previewShort}`,
  ].join("\n");
}

export async function handleTaDebug({
  bot,
  chatId,
  rest,
  reply,
  bypass,
}) {
  if (!bypass) {
    await reply("⛔ DEV only.", {
      cmd: "/ta_debug",
      handler: "taDebug",
      event: "forbidden",
    });
    return { handled: true };
  }

  const input = parseTaDebugArgs(rest);

  try {
    const result = await readCoingeckoIndicatorsDebug(input);

    if (!result?.ok) {
      await reply(buildErrorText(result, input), {
        cmd: "/ta_debug",
        handler: "taDebug",
        event: "reader_not_ready",
      });
      return { handled: true };
    }

    await reply(buildSuccessText(result, input), {
      cmd: "/ta_debug",
      handler: "taDebug",
      event: "reader_ready",
      branch: result?.sgView?.branch || null,
      status: result?.sgView?.status || null,
      readiness: result?.sgView?.readiness || null,
    });

    return { handled: true };
  } catch (error) {
    const text = [
      "⛔ TA DEBUG",
      `coin: ${input.coinId}`,
      `vs: ${input.vsCurrency}`,
      `days: ${input.days}`,
      `reason: exception`,
      `message: ${error?.message ? String(error.message) : "unknown_error"}`,
    ].join("\n");

    await reply(text, {
      cmd: "/ta_debug",
      handler: "taDebug",
      event: "exception",
    });

    return { handled: true };
  }
}

export default {
  handleTaDebug,
};