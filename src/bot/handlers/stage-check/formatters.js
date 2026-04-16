// ============================================================================
// === src/bot/handlers/stage-check/formatters.js
// ============================================================================

import { normalizeItemCode } from "./common.js";

export const WORKFLOW_PATH = "pillars/WORKFLOW.md";
export const RULES_PATH = "pillars/STAGE_CHECK_RULES.json";

export function detectLanguageFromContext(ctx = {}) {
  const candidates = [
    ctx.lang,
    ctx.language,
    ctx.userLang,
    ctx.locale,
    ctx.telegramLanguageCode,
  ]
    .map((x) => String(x || "").toLowerCase())
    .filter(Boolean);

  for (const value of candidates) {
    if (value.startsWith("uk")) return "uk";
    if (value.startsWith("ru")) return "ru";
    if (value.startsWith("en")) return "en";
  }

  return "ru";
}

export function parseMode(rest) {
  const parts = String(rest || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  const hasDiag =
    parts.includes("--diag") ||
    parts.includes("diag") ||
    parts.includes("debug") ||
    parts.includes("--debug");

  const filtered = parts.filter(
    (part) =>
      part !== "--diag" &&
      part !== "diag" &&
      part !== "debug" &&
      part !== "--debug"
  );

  const token = filtered[0] || "";
  const normalized = normalizeItemCode(token);

  if (!normalized) return { mode: "current", value: "current", diag: hasDiag };
  if (normalized === "ALL") return { mode: "all", value: "all", diag: hasDiag };
  if (normalized === "CURRENT") {
    return { mode: "current", value: "current", diag: hasDiag };
  }

  return { mode: "item", value: normalized, diag: hasDiag };
}

export function createTranslator({ lang, workflowPath, rulesPath }) {
  const dict = {
    ru: {
      header_single: "Проверка этапа: {code}",
      header_all: "Проверка этапов: все",
      header_current: "Проверка этапов: текущий",
      workflow: "Пункт workflow",
      status: "Статус",
      formal_status: "Формальный статус",
      real_status: "Реальный статус",
      status_gap: "Разрыв статусов",
      gap_reason: "Причина разрыва",
      checked: "Что проверялось",
      found: "Что найдено",
      formal_found: "Что найдено формально",
      real_found: "Что найдено реально",
      result: "Итог",
      current_stage: "Текущий этап",
      title: "Название",
      all_complete: "Все верхние этапы подтверждены",
      confirmed: "подтверждено",
      partially_confirmed: "частично подтверждено",
      not_confirmed: "не подтверждено",
      no_signals: "нет сигналов для проверки",
      unknown_real: "неизвестно",
      yes: "да",
      no: "нет",
      aligned: "совпадает",
      under_detected_by_checker: "checker недооценивает",
      overestimated_by_checker: "checker переоценивает",
      insufficient_real_evidence: "недостаточно real-evidence",
      item_not_found: "пункт не найден в WORKFLOW",
      cannot_read_workflow: `Ошибка stage_check: не удалось прочитать ${workflowPath}`,
      cannot_read_rules: `Ошибка stage_check: не удалось прочитать ${rulesPath}`,
      invalid_rules: `Ошибка stage_check: неверный JSON в ${rulesPath}`,
      runtime_failed: "Ошибка stage_check: не удалось выполнить проверку",
      explicit_file: "Наличие явного файла",
      command_surface: "Наличие команды",
      repo_token: "Наличие технического признака в репозитории",
      basename_signal: "Наличие файла/модуля по имени",
      structured_index: "Наличие структурного индекса/unique в миграциях",
      no_clear_evidence: "Явного подтверждения в репозитории не найдено",
      insufficient_evidence: "Есть сигналы, но их недостаточно для подтверждения",
      aggregated_scope: "Агрегированная проверка дочерних пунктов",
      exact_point: "Проверка точечного пункта",
      stage_line: "{code} — {status}",
      child_points: "Пункты",
      summary: "Сводка",
      completed_count: "Завершено",
      partial_count: "Частично",
      open_count: "Не выполнено",
      no_signals_count: "Без сигналов",
    },
    uk: {
      header_single: "Перевірка етапу: {code}",
      header_all: "Перевірка етапів: усі",
      header_current: "Перевірка етапів: поточний",
      workflow: "Пункт workflow",
      status: "Статус",
      formal_status: "Формальний статус",
      real_status: "Реальний статус",
      status_gap: "Розрив статусів",
      gap_reason: "Причина розриву",
      checked: "Що перевірялось",
      found: "Що знайдено",
      formal_found: "Що знайдено формально",
      real_found: "Що знайдено реально",
      result: "Підсумок",
      current_stage: "Поточний етап",
      title: "Назва",
      all_complete: "Усі верхні етапи підтверджені",
      confirmed: "підтверджено",
      partially_confirmed: "частково підтверджено",
      not_confirmed: "не підтверджено",
      no_signals: "немає сигналів для перевірки",
      unknown_real: "невідомо",
      yes: "так",
      no: "ні",
      aligned: "збігається",
      under_detected_by_checker: "checker недооцінює",
      overestimated_by_checker: "checker переоцінює",
      insufficient_real_evidence: "недостатньо real-evidence",
      item_not_found: "пункт не знайдено у WORKFLOW",
      cannot_read_workflow: `Помилка stage_check: не вдалося прочитати ${workflowPath}`,
      cannot_read_rules: `Помилка stage_check: не вдалося прочитати ${rulesPath}`,
      invalid_rules: `Помилка stage_check: некоректний JSON у ${rulesPath}`,
      runtime_failed: "Помилка stage_check: не вдалося виконати перевірку",
      explicit_file: "Наявність явного файлу",
      command_surface: "Наявність команди",
      repo_token: "Наявність технічної ознаки в репозиторії",
      basename_signal: "Наявність файлу/модуля за назвою",
      structured_index: "Наявність структурного індексу/unique у міграціях",
      no_clear_evidence: "Явного підтвердження в репозиторії не знайдено",
      insufficient_evidence: "Є сигнали, але їх недостатньо для підтвердження",
      aggregated_scope: "Агрегована перевірка дочірніх пунктів",
      exact_point: "Перевірка точкового пункту",
      stage_line: "{code} — {status}",
      child_points: "Пункти",
      summary: "Зведення",
      completed_count: "Завершено",
      partial_count: "Частково",
      open_count: "Не виконано",
      no_signals_count: "Без сигналів",
    },
    en: {
      header_single: "Stage check: {code}",
      header_all: "Stage check: all",
      header_current: "Stage check: current",
      workflow: "Workflow item",
      status: "Status",
      formal_status: "Formal status",
      real_status: "Real status",
      status_gap: "Status gap",
      gap_reason: "Gap reason",
      checked: "What was checked",
      found: "What was found",
      formal_found: "What was found formally",
      real_found: "What was found really",
      result: "Result",
      current_stage: "Current stage",
      title: "Title",
      all_complete: "All top-level stages are confirmed",
      confirmed: "confirmed",
      partially_confirmed: "partially confirmed",
      not_confirmed: "not confirmed",
      no_signals: "no signals available for checking",
      unknown_real: "unknown",
      yes: "yes",
      no: "no",
      aligned: "aligned",
      under_detected_by_checker: "checker under-detects",
      overestimated_by_checker: "checker overestimates",
      insufficient_real_evidence: "insufficient real evidence",
      item_not_found: "item not found in WORKFLOW",
      cannot_read_workflow: `stage_check error: cannot read ${workflowPath}`,
      cannot_read_rules: `stage_check error: cannot read ${rulesPath}`,
      invalid_rules: `stage_check error: invalid JSON in ${rulesPath}`,
      runtime_failed: "stage_check error: runtime evaluation failed",
      explicit_file: "Explicit file exists",
      command_surface: "Command exists",
      repo_token: "Technical evidence exists in repository",
      basename_signal: "File/module exists by name",
      structured_index: "Structured index/unique exists in migrations",
      no_clear_evidence: "No clear evidence found in repository",
      insufficient_evidence: "There are signals, but not enough to confirm the item",
      aggregated_scope: "Aggregated check of child items",
      exact_point: "Exact point check",
      stage_line: "{code} — {status}",
      child_points: "Items",
      summary: "Summary",
      completed_count: "Completed",
      partial_count: "Partial",
      open_count: "Open",
      no_signals_count: "No signals",
    },
  };

  const langDict = dict[lang] || dict.ru;

  function t(key, vars = {}) {
    let str = langDict[key] || dict.ru[key] || key;
    for (const [k, v] of Object.entries(vars)) {
      str = str.replaceAll(`{${k}}`, String(v));
    }
    return str;
  }

  function humanStatus(status) {
    if (status === "COMPLETE") return t("confirmed");
    if (status === "PARTIAL") return t("partially_confirmed");
    if (status === "OPEN") return t("not_confirmed");
    if (status === "NO_SIGNALS") return t("no_signals");
    if (status === "UNKNOWN") return t("unknown_real");
    return status;
  }

  function humanGapReason(reason) {
    return t(reason || "insufficient_real_evidence");
  }

  return { t, humanStatus, humanGapReason };
}

export function formatSingleItemOutput({
  review,
  t,
  humanStatus,
  humanGapReason,
}) {
  const lines = [];

  lines.push(t("header_single", { code: review?.item?.code || "-" }));
  lines.push(`${t("formal_status")}: ${humanStatus(review?.formal?.status)}`);
  lines.push(`${t("real_status")}: ${humanStatus(review?.real?.status)}`);
  lines.push(`${t("status_gap")}: ${review?.gap?.exists ? t("yes") : t("no")}`);
  lines.push(`${t("gap_reason")}: ${humanGapReason(review?.gap?.reason)}`);

  return lines.join("\n");
}

function buildStageLineStatus(review, humanStatus, humanGapReason) {
  const formal = humanStatus(review?.formal?.status);
  const real = humanStatus(review?.real?.status);
  const gap = review?.gap?.exists
    ? humanGapReason(review?.gap?.reason)
    : humanGapReason("aligned");

  return `formal: ${formal} | real: ${real} | gap: ${gap}`;
}

export function formatAllStagesOutput({
  stageReviews,
  t,
  humanStatus,
  humanGapReason,
}) {
  const lines = [];
  lines.push(t("header_all"));

  const list = Array.isArray(stageReviews) ? stageReviews : [];
  if (list.length === 0) {
    lines.push(`${t("result")}: ${t("no_clear_evidence")}`);
    return lines.join("\n");
  }

  for (const review of list) {
    lines.push(
      t("stage_line", {
        code: review?.item?.code || "-",
        status: buildStageLineStatus(review, humanStatus, humanGapReason),
      })
    );
  }

  return lines.join("\n");
}

function chooseCurrentStageReview(stageReviews) {
  const list = Array.isArray(stageReviews) ? stageReviews : [];

  const active = list.filter((review) => {
    const formal = String(review?.formal?.status || "NO_SIGNALS");
    const real = String(review?.real?.status || "UNKNOWN");

    return (
      formal === "PARTIAL" ||
      formal === "OPEN" ||
      real === "PARTIAL" ||
      real === "OPEN"
    );
  });

  if (active.length > 0) {
    return active[active.length - 1];
  }

  const withAnyEvidence = list.filter((review) => {
    const formalEvidence = Array.isArray(review?.formal?.evidence)
      ? review.formal.evidence.length
      : 0;
    const realEvidence = Array.isArray(review?.real?.evidence)
      ? review.real.evidence.length
      : 0;

    return formalEvidence > 0 || realEvidence > 0;
  });

  if (withAnyEvidence.length > 0) {
    return withAnyEvidence[withAnyEvidence.length - 1];
  }

  return list[list.length - 1] || null;
}

export function formatCurrentOutput({
  stageReviews,
  t,
  humanStatus,
  humanGapReason,
}) {
  const lines = [];
  lines.push(t("header_current"));

  const chosen = chooseCurrentStageReview(stageReviews);
  if (!chosen) {
    lines.push(t("all_complete"));
    return lines.join("\n");
  }

  lines.push(`${t("current_stage")}: ${chosen?.item?.code || "-"}`);
  lines.push(`${t("formal_status")}: ${humanStatus(chosen?.formal?.status)}`);
  lines.push(`${t("real_status")}: ${humanStatus(chosen?.real?.status)}`);
  lines.push(`${t("status_gap")}: ${chosen?.gap?.exists ? t("yes") : t("no")}`);

  return lines.join("\n");
}

export function formatDiagOutput({
  modeInfo,
  source,
  repoFiles,
  searchableFiles,
  workflowItems,
  topLevelStages,
  evaluationCtx,
  targetItem,
  itemDiag,
}) {
  const lines = [];

  lines.push("STAGE_CHECK DIAG");
  lines.push(`mode=${modeInfo.mode}`);
  lines.push(`value=${modeInfo.value}`);
  lines.push(`repo=${String(source?.repo || "") || "(empty)"}`);
  lines.push(`branch=${String(source?.branch || "") || "(empty)"}`);
  lines.push(`repoFiles=${Array.isArray(repoFiles) ? repoFiles.length : 0}`);
  lines.push(`searchableFiles=${Array.isArray(searchableFiles) ? searchableFiles.length : 0}`);
  lines.push(`workflowItems=${Array.isArray(workflowItems) ? workflowItems.length : 0}`);
  lines.push(`topLevelStages=${Array.isArray(topLevelStages) ? topLevelStages.length : 0}`);
  lines.push(`fetchBudgetUsed=${evaluationCtx?.fetchStats?.used ?? 0}`);
  lines.push(`fetchFailures=${evaluationCtx?.errorStats?.fetchFailures ?? 0}`);

  if (!targetItem) {
    lines.push("targetItem=(not resolved)");
    return lines.join("\n");
  }

  lines.push(`targetItem=${targetItem.code}`);
  lines.push(`targetKind=${targetItem.kind}`);
  lines.push(`targetTitle=${targetItem.title || "-"}`);
  lines.push(`targetParent=${targetItem.parentCode || "(root)"}`);
  lines.push(`explicitPaths=${JSON.stringify(itemDiag?.explicitPaths || [])}`);
  lines.push(`commands=${JSON.stringify(itemDiag?.commands || [])}`);
  lines.push(`ownSignals=${JSON.stringify(itemDiag?.ownSignals || [])}`);
  lines.push(`inheritedSignals=${JSON.stringify(itemDiag?.inheritedSignals || [])}`);
  lines.push(`checksCount=${itemDiag?.checksCount ?? 0}`);
  lines.push(`itemStatus=${itemDiag?.itemStatus || "-"}`);
  lines.push(`itemSemanticType=${itemDiag?.itemSemanticType || "-"}`);
  lines.push(`itemAggregationFlags=${JSON.stringify(itemDiag?.itemAggregationFlags || {})}`);
  lines.push(`scopeAggregateStatus=${itemDiag?.scopeAggregateStatus || "-"}`);
  lines.push(`scopeAggregationDebug=${JSON.stringify(itemDiag?.scopeAggregationDebug || {})}`);
  lines.push(`passedChecks=${itemDiag?.passedChecks ?? 0}`);
  lines.push(`failedChecks=${itemDiag?.failedChecks ?? 0}`);
  lines.push(`directFileReads=${JSON.stringify(itemDiag?.directFileReads || [])}`);

  if (Array.isArray(itemDiag?.checkResults) && itemDiag.checkResults.length > 0) {
    for (let i = 0; i < itemDiag.checkResults.length; i += 1) {
      const entry = itemDiag.checkResults[i];
      lines.push(
        `check[${i}]=${JSON.stringify({
          type: entry.type,
          label: entry.label,
          ok: entry.ok,
          details: entry.details,
          evidenceClass: entry.evidenceClass,
          strength: entry.strength,
        })}`
      );
    }
  } else {
    lines.push("checkResults=[]");
  }

  return lines.join("\n");
}