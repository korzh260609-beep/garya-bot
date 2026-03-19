// src/bot/handlers/taDebug.js
// ============================================================================
// STAGE 10C.39
// MONARCH/DEV COMMAND HANDLER
// - /ta_debug / /ta_debug_full
// - /ta_snapshot / /ta_snapshot_full
//
// PURPOSE:
// - let SG read coingecko indicators through internal source layer
// - debug mode is LEGACY diagnostic path
// - snapshot mode uses direct snapshot source
// - short variants return compact SG view
// - full variants return expanded technical view
// - keep /ta_core as the new main internal TA dev path
// - no SourceService changes
// - no chat runtime refactor
// - no execution logic
// ============================================================================

import { readCoingeckoIndicatorsDebug } from "../../sources/readCoingeckoIndicatorsDebug.js";
import { readCoingeckoIndicatorsSnapshot } from "../../sources/readCoingeckoIndicatorsSnapshot.js";

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

function getCommandKind(cmd = "") {
  if (cmd === "/ta_snapshot" || cmd === "/ta_snapshot_full") {
    return "snapshot";
  }
  return "debug";
}

function getMode(cmd = "") {
  return cmd === "/ta_debug_full" || cmd === "/ta_snapshot_full"
    ? "full"
    : "short";
}

function getTitle(kind = "debug", mode = "short") {
  if (kind === "snapshot") {
    return mode === "full" ? "🧪 TA SNAPSHOT FULL" : "🧪 TA SNAPSHOT";
  }
  return mode === "full"
    ? "🧪 TA DEBUG LEGACY FULL"
    : "🧪 TA DEBUG LEGACY";
}

function getDefaultCmd(kind = "debug", mode = "short") {
  if (kind === "snapshot") {
    return mode === "full" ? "/ta_snapshot_full" : "/ta_snapshot";
  }
  return mode === "full" ? "/ta_debug_full" : "/ta_debug";
}

function getAttemptsCount(result = {}) {
  if (Array.isArray(result?.fetchMeta?.attempts)) {
    return result.fetchMeta.attempts.length;
  }
  return 0;
}

function appendLegacyHint(lines = [], kind = "debug") {
  if (kind !== "debug") return lines;

  return [
    ...lines,
    "",
    "legacy_path: true",
    "preferred_cmd: /ta_core",
  ];
}

function buildShortSuccessText(result = {}, input = {}, kind = "debug") {
  const branch = result?.sgView?.branch || "unknown";
  const status = result?.sgView?.status || "unknown";
  const readiness = result?.sgView?.readiness || "unknown";
  const shortText = normalizeString(result?.sgView?.shortText) || "n/a";
  const note = normalizeString(result?.sgView?.note) || "n/a";

  const lines = [
    getTitle(kind, "short"),
    `coin: ${input.coinId}`,
    `vs: ${input.vsCurrency}`,
    `days: ${input.days}`,
    "",
    `branch: ${branch}`,
    `status: ${status}`,
    `readiness: ${readiness}`,
  ];

  if (kind === "snapshot") {
    lines.push(
      `interval_used: ${result?.fetchMeta?.intervalUsed || "n/a"}`,
      `fallback_used: ${result?.fetchMeta?.fallbackUsed === true ? "true" : "false"}`
    );
  }

  lines.push(
    "",
    `short: ${shortText}`,
    `note: ${note}`
  );

  return appendLegacyHint(lines, kind).join("\n");
}

function buildFullSuccessText(result = {}, input = {}, kind = "debug") {
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

  const lines = [
    getTitle(kind, "full"),
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
  ];

  if (kind === "snapshot") {
    lines.push(
      "",
      `prices_count: ${result?.fetchMeta?.pricesCount ?? "n/a"}`,
      `interval_used: ${result?.fetchMeta?.intervalUsed || "n/a"}`,
      `fallback_used: ${result?.fetchMeta?.fallbackUsed === true ? "true" : "false"}`,
      `attempts_count: ${getAttemptsCount(result)}`,
      `market_chart_reason: ${result?.fetchMeta?.marketChartReason || "n/a"}`,
      `bundle_reason: ${result?.bundleMeta?.bundleReason || "n/a"}`,
      `bundle_ok: ${result?.bundleMeta?.bundleOk === true ? "true" : "false"}`,
      `indicators_ready: ${result?.bundleMeta?.indicatorsReady === true ? "true" : "false"}`
    );
  }

  lines.push(
    "",
    `short: ${shortText}`,
    `note: ${note}`,
    `summary: ${summaryLine}`,
    `reason: ${branchReason}`
  );

  return appendLegacyHint(lines, kind).join("\n");
}

function buildErrorText(result = {}, input = {}, kind = "debug", mode = "short") {
  const reason = result?.reason || "unknown_error";
  const status = result?.http?.status ?? result?.fetchMeta?.marketChartStatus ?? "n/a";
  const message = result?.meta?.message || result?.meta?.error || "n/a";
  const rawPreview = normalizeString(
    result?.raw?.rawPreview ||
      result?.fetchMeta?.rawPreview ||
      ""
  );
  const previewShort = rawPreview ? rawPreview.slice(0, 300) : "n/a";

  const lines = [
    getTitle(kind, mode),
    `coin: ${input.coinId}`,
    `vs: ${input.vsCurrency}`,
    `days: ${input.days}`,
    `reason: ${reason}`,
    `http_status: ${status}`,
    `message: ${message}`,
  ];

  if (kind === "snapshot") {
    lines.push(
      `market_chart_reason: ${result?.fetchMeta?.marketChartReason || "n/a"}`,
      `prices_count: ${result?.fetchMeta?.pricesCount ?? "n/a"}`,
      `interval_used: ${result?.fetchMeta?.intervalUsed || "n/a"}`,
      `fallback_used: ${result?.fetchMeta?.fallbackUsed === true ? "true" : "false"}`,
      `attempts_count: ${getAttemptsCount(result)}`,
      `fetch_reason: ${result?.meta?.fetchReason || "n/a"}`,
      `bundle_reason: ${result?.meta?.bundleReason || "n/a"}`
    );
  }

  if (mode === "full") {
    lines.push(`raw_preview: ${previewShort}`);
  }

  return appendLegacyHint(lines, kind).join("\n");
}

async function readByKind(kind = "debug", input = {}) {
  if (kind === "snapshot") {
    return await readCoingeckoIndicatorsSnapshot(input);
  }
  return await readCoingeckoIndicatorsDebug(input);
}

export async function handleTaDebug({
  bot,
  chatId,
  rest,
  reply,
  bypass,
  cmd,
}) {
  const kind = getCommandKind(cmd);
  const mode = getMode(cmd);
  const defaultCmd = getDefaultCmd(kind, mode);

  if (!bypass) {
    await reply("⛔ DEV only.", {
      cmd: cmd || defaultCmd,
      handler: "taDebug",
      event: "forbidden",
      kind,
      mode,
    });
    return { handled: true };
  }

  const input = parseTaDebugArgs(rest);

  try {
    const result = await readByKind(kind, input);

    if (!result?.ok) {
      await reply(buildErrorText(result, input, kind, mode), {
        cmd: cmd || defaultCmd,
        handler: "taDebug",
        event: kind === "snapshot" ? "snapshot_not_ready" : "reader_not_ready",
        kind,
        mode,
        legacyPath: kind === "debug",
        preferredCmd: kind === "debug" ? "/ta_core" : null,
      });
      return { handled: true };
    }

    const text =
      mode === "full"
        ? buildFullSuccessText(result, input, kind)
        : buildShortSuccessText(result, input, kind);

    await reply(text, {
      cmd: cmd || defaultCmd,
      handler: "taDebug",
      event: kind === "snapshot" ? "snapshot_ready" : "reader_ready",
      kind,
      mode,
      branch: result?.sgView?.branch || null,
      status: result?.sgView?.status || null,
      readiness: result?.sgView?.readiness || null,
      legacyPath: kind === "debug",
      preferredCmd: kind === "debug" ? "/ta_core" : null,
    });

    return { handled: true };
  } catch (error) {
    const text = appendLegacyHint(
      [
        getTitle(kind, mode),
        `coin: ${input.coinId}`,
        `vs: ${input.vsCurrency}`,
        `days: ${input.days}`,
        "reason: exception",
        `message: ${error?.message ? String(error.message) : "unknown_error"}`,
      ],
      kind
    ).join("\n");

    await reply(text, {
      cmd: cmd || defaultCmd,
      handler: "taDebug",
      event: "exception",
      kind,
      mode,
      legacyPath: kind === "debug",
      preferredCmd: kind === "debug" ? "/ta_core" : null,
    });

    return { handled: true };
  }
}

export default {
  handleTaDebug,
};
