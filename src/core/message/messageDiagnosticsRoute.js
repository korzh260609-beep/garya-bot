// AGENT NOTE:
// SG 2.0 explicit diagnostics message route.
// Purpose: route explicit Monarch diagnostics check requests before AI, using only allowlisted diagnostics checks.
// Do not add Telegram slash commands, AI calls, memory writes, migrations, schema creation, source sync, or transport coupling here.

import { diagnosticsCheckRegistry } from "../../agents/diagnostics-check-agent/diagnosticsCheckRegistry.js";
import { runDiagnosticsCheck } from "../../diagnostics/diagnosticsRunner.js";

function normalizeText(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function getAllowedDiagnosticsCheckNames(registry = diagnosticsCheckRegistry) {
  return Array.isArray(registry)
    ? registry.map((item) => item?.name).filter((name) => typeof name === "string" && name.trim())
    : [];
}

export function detectExplicitDiagnosticsCheckRequest(input = {}) {
  const text = normalizeText(input.text);
  const allowedChecks = getAllowedDiagnosticsCheckNames(input.registry);

  if (!text) {
    return {
      ok: false,
      reason: "empty_text",
      checks: [],
    };
  }

  const matchedChecks = allowedChecks.filter((checkName) => text.includes(checkName.toLowerCase()));

  if (matchedChecks.length !== 1) {
    return {
      ok: false,
      reason: matchedChecks.length > 1 ? "multiple_checks_matched" : "no_allowlisted_check_matched",
      checks: matchedChecks,
    };
  }

  return {
    ok: true,
    reason: "explicit_diagnostics_check_matched",
    checks: matchedChecks,
  };
}

function buildDiagnosticsRouteReply({ diagnosticsResult, identity, text, checks }) {
  return {
    ok: Boolean(diagnosticsResult?.ok),
    reply: diagnosticsResult?.finalText || "Диагностика выполнена, но итоговый текст не сформирован.",
    identity,
    diagnosticsRoute: {
      handled: true,
      text,
      checks,
      resultType: diagnosticsResult?.type || "sg_diagnostics_check",
    },
  };
}

function buildDiagnosticsRouteErrorReply({ error, identity, text, checks }) {
  return {
    ok: false,
    reply: [
      "Диагностика SG не выполнена.",
      "",
      `Проверка: ${checks.join(", ") || "не определена"}`,
      `Ошибка: ${error?.message || "diagnostics_route_failed"}`,
      "",
      "Изменений в коде, памяти, БД или источниках не выполнялось.",
    ].join("\n"),
    identity,
    diagnosticsRoute: {
      handled: true,
      text,
      checks,
      error: error?.message || "diagnostics_route_failed",
    },
  };
}

export async function handleMessageDiagnosticsRoute(input = {}) {
  const text = typeof input.text === "string" ? input.text.trim() : "";
  const identity = input.identity || {};
  const detection = detectExplicitDiagnosticsCheckRequest({
    text,
    registry: input.registry,
  });

  if (!detection.ok) {
    return {
      handled: false,
      reason: detection.reason,
      checks: detection.checks,
    };
  }

  if (!identity.isMonarch) {
    return {
      handled: true,
      ok: false,
      reply: "Диагностика доступна только монарху.",
      identity,
      diagnosticsRoute: {
        handled: true,
        text,
        checks: detection.checks,
        reason: "not_monarch",
      },
    };
  }

  const runDiagnostics = input.runDiagnosticsCheckFn || runDiagnosticsCheck;

  try {
    const diagnosticsResult = await runDiagnostics({
      text,
      checks: detection.checks,
    }, {
      ...identity,
      isMonarch: true,
      latestUserText: text,
    });

    return {
      handled: true,
      ...buildDiagnosticsRouteReply({
        diagnosticsResult,
        identity,
        text,
        checks: detection.checks,
      }),
    };
  } catch (error) {
    return {
      handled: true,
      ...buildDiagnosticsRouteErrorReply({
        error,
        identity,
        text,
        checks: detection.checks,
      }),
    };
  }
}
