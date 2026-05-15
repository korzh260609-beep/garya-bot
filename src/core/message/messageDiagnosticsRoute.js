// AGENT NOTE:
// SG 2.0 structured diagnostics message route.
// Purpose: route Monarch diagnostics checks before AI only when structured intent selects diagnostics capabilities.
// Do not add keyword lists, phrase matching, Telegram slash commands, AI calls, memory writes, migrations, schema creation, source sync, or transport coupling here.

import { diagnosticsCheckRegistry } from "../../agents/diagnostics-check-agent/diagnosticsCheckRegistry.js";
import { runDiagnosticsCheck } from "../../diagnostics/diagnosticsRunner.js";
import { detectDiagnosticsIntent } from "../../diagnostics/diagnosticsIntent.js";
import { buildDiagnosticsPlan } from "../../diagnostics/diagnosticsPlan.js";

function getAllowedDiagnosticsCheckNames(registry = diagnosticsCheckRegistry) {
  return Array.isArray(registry)
    ? registry.map((item) => item?.name).filter((name) => typeof name === "string" && name.trim())
    : [];
}

function normalizeCheckList(value = []) {
  return Array.isArray(value)
    ? value.map((item) => (typeof item === "string" ? item.trim() : "")).filter(Boolean)
    : [];
}

function filterAllowedChecks(checks = [], allowedChecks = []) {
  const allowed = new Set(allowedChecks);
  return normalizeCheckList(checks).filter((check) => allowed.has(check));
}

function getStructuredIntent(input = {}) {
  const intent = input.intent && typeof input.intent === "object" && !Array.isArray(input.intent)
    ? input.intent
    : input.context?.intent && typeof input.context.intent === "object" && !Array.isArray(input.context.intent)
      ? input.context.intent
      : null;

  return intent;
}

export function detectExplicitDiagnosticsCheckRequest(input = {}) {
  const text = typeof input.text === "string" ? input.text.trim() : "";
  const structuredIntent = getStructuredIntent(input);
  const allowedChecks = getAllowedDiagnosticsCheckNames(input.registry);

  if (!structuredIntent) {
    return {
      ok: false,
      reason: "no_structured_intent",
      checks: [],
      routing: {
        source: "structured_intent",
        keywordMatchingUsed: false,
        phraseMatchingUsed: false,
      },
    };
  }

  const intentDetection = detectDiagnosticsIntent({ text, intent: structuredIntent });

  if (!intentDetection.ok) {
    return {
      ok: false,
      reason: intentDetection.reason,
      checks: [],
      intent: intentDetection.intent,
      routing: intentDetection.routing,
    };
  }

  const plan = buildDiagnosticsPlan({
    text,
    intent: intentDetection.intent,
  });
  const checks = filterAllowedChecks(plan.checks, allowedChecks);

  if (!checks.length) {
    return {
      ok: false,
      reason: "no_allowlisted_structured_check_selected",
      checks: [],
      intent: intentDetection.intent,
      plan,
      routing: plan.routing,
    };
  }

  return {
    ok: true,
    reason: "structured_diagnostics_intent_matched",
    checks,
    intent: intentDetection.intent,
    plan,
    routing: plan.routing,
  };
}

function buildDiagnosticsRouteReply({ diagnosticsResult, identity, text, checks, intent }) {
  return {
    ok: Boolean(diagnosticsResult?.ok),
    reply: diagnosticsResult?.finalText || "Диагностика выполнена, но итоговый текст не сформирован.",
    identity,
    diagnosticsRoute: {
      handled: true,
      text,
      checks,
      intent,
      resultType: diagnosticsResult?.type || "sg_diagnostics_check",
      routing: diagnosticsResult?.plan?.routing || null,
    },
  };
}

function buildDiagnosticsRouteErrorReply({ error, identity, text, checks, intent }) {
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
      intent,
      error: error?.message || "diagnostics_route_failed",
    },
  };
}

export async function handleMessageDiagnosticsRoute(input = {}) {
  const text = typeof input.text === "string" ? input.text.trim() : "";
  const identity = input.identity || {};
  const detection = detectExplicitDiagnosticsCheckRequest({
    text,
    intent: input.intent,
    context: input.context,
    registry: input.registry,
  });

  if (!detection.ok) {
    return {
      handled: false,
      reason: detection.reason,
      checks: detection.checks,
      intent: detection.intent || null,
      routing: detection.routing || null,
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
        intent: detection.intent,
        reason: "not_monarch",
      },
    };
  }

  const runDiagnostics = input.runDiagnosticsCheckFn || runDiagnosticsCheck;

  try {
    const diagnosticsResult = await runDiagnostics({
      text,
      intent: detection.intent,
      checks: detection.checks,
    }, {
      ...identity,
      isMonarch: true,
      latestUserText: text,
      intent: detection.intent,
    });

    return {
      handled: true,
      ...buildDiagnosticsRouteReply({
        diagnosticsResult,
        identity,
        text,
        checks: detection.checks,
        intent: detection.intent,
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
        intent: detection.intent,
      }),
    };
  }
}
