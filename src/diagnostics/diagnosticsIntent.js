// AGENT NOTE:
// SG 2.0 Diagnostics Layer intent helper.
// Purpose: decide whether a user request should be treated as a diagnostics request.
// Do not add transport commands, slash-command parsing, or direct Render/GitHub calls here.

const DIAGNOSTIC_HINTS = [
  "не работает",
  "ошибка",
  "ошибку",
  "сбой",
  "сломалось",
  "проверь",
  "проверить",
  "диагност",
  "причин",
  "что с ботом",
  "что с сг",
  "статус",
  "состояние",
  "deploy",
  "деплой",
  "render",
  "рендер",
  "github actions",
  "workflow",
  "ci",
  "checks",
  "registry",
  "реестр",
  "логи",
  "logs",
  "migration readiness",
  "migrations readiness",
  "migration preflight",
  "manual migration",
  "manual migrations",
  "db readiness",
  "готовность миграций",
  "ручные миграции",
  "ручной запуск миграций",
  "перед запуском миграций",
];

export function normalizeDiagnosticsText(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export function detectDiagnosticsIntent(input = {}) {
  const text = normalizeDiagnosticsText(input.text);

  if (!text) {
    return {
      ok: false,
      reason: "empty_text",
      confidence: 0,
      matchedHints: [],
    };
  }

  const matchedHints = DIAGNOSTIC_HINTS.filter((hint) => text.includes(hint));
  const confidence = Math.min(1, matchedHints.length / 3);

  return {
    ok: matchedHints.length > 0,
    reason: matchedHints.length > 0 ? "diagnostics_hints_matched" : "no_diagnostics_hints",
    confidence,
    matchedHints,
  };
}
