// ============================================================================
// === src/bot/handlers/stage-check/formatters.js
// ============================================================================

import { normalizeItemCode } from "./common.js";
import { aggregateScope } from "./evaluator.js";

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
      checked: "Что проверялось",
      found: "Что найдено",
      result: "Итог",
      current_stage: "Текущий этап",
      title: "Название",
      all_complete: "Все верхние этапы подтверждены",
      confirmed: "подтверждено",
      partially_confirmed: "частично подтверждено",
      not_confirmed: "не подтверждено",
      no_signals: "нет сигналов для проверки",
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
      aggregated_scope: "Агрегированная проверка дочерних пунктов",
      exact_point: "Проверка точечного пункта",
      stage_line: "{code} — {status}",
    },
    uk: {
      header_single: "Перевірка етапу: {code}",
      header_all: "Перевірка етапів: усі",
      header_current: "Перевірка етапів: поточний",
      workflow: "Пункт workflow",
      status: "Статус",
      checked: "Що перевірялось",
      found: "Що знайдено",
      result: "Підсумок",
      current_stage: "Поточний етап",
      title: "Назва",
      all_complete: "Усі верхні етапи підтверджені",
      confirmed: "підтверджено",
      partially_confirmed: "частково підтверджено",
      not_confirmed: "не підтверджено",
      no_signals: "немає сигналів для перевірки",
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
      aggregated_scope: "Агрегована перевірка дочірніх пунктів",
      exact_point: "Перевірка точкового пункту",
      stage_line: "{code} — {status}",
    },
    en: {
      header_single: "Stage check: {code}",
      header_all: "Stage check: all",
      header_current: "Stage check: current",
      workflow: "Workflow item",
      status: "Status",
      checked: "What was checked",
      found: "What was found",
      result: "Result",
      current_stage: "Current stage",
      title: "Title",
      all_complete: "All top-level stages are confirmed",
      confirmed: "confirmed",
      partially_confirmed: "partially confirmed",
      not_confirmed: "not confirmed",
      no_signals: "no signals available for checking",
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
      aggregated_scope: "Aggregated check of child items",
      exact_point: "Exact point check",
      stage_line: "{code} — {status}",
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
    return status;
  }

  return { t, humanStatus };
}

function describeCheckShort(entry, t) {
  const check = entry.check || {};
  if (check.type === "file_exists") return t("explicit_file");
  if (check.type === "basename_exists") return t("basename_signal");
  if (check.type === "structured_index_exists") return t("structured_index");
  if (check.type === "text_exists") {
    if (String(check.label || "").startsWith("command token:")) {
      return t("command_surface");
    }
    return t("repo_token");
  }
  return t("repo_token");
}

function summarizeEvidence(entries, t) {
  if (!entries.length) return t("no_clear_evidence");
  const kinds = new Set(entries.map((e) => describeCheckShort(e, t)));
  return Array.from(kinds).slice(0, 3).join(", ");
}

export function formatSingleItemOutput({
  baseItem,
  scopeItems,
  aggregate,
  t,
  humanStatus,
}) {
  const lines = [];

  lines.push(t("header_single", { code: baseItem.code }));
  lines.push(`${t("workflow")}: ${baseItem.title || "-"}`);
  lines.push(`${t("status")}: ${humanStatus(aggregate.status)}`);

  if (scopeItems.length > 1) {
    lines.push(`${t("checked")}: ${t("aggregated_scope")}`);
  } else {
    lines.push(`${t("checked")}: ${t("exact_point")}`);
  }

  if (aggregate.status === "COMPLETE") {
    lines.push(`${t("found")}: ${summarizeEvidence(aggregate.passedEntries, t)}`);
    lines.push(`${t("result")}: ${t("confirmed")}`);
    return lines.join("\n");
  }

  if (aggregate.status === "PARTIAL") {
    lines.push(`${t("found")}: ${summarizeEvidence(aggregate.passedEntries, t)}`);
    lines.push(`${t("result")}: ${t("partially_confirmed")}`);
    return lines.join("\n");
  }

  if (aggregate.status === "NO_SIGNALS") {
    lines.push(`${t("found")}: ${t("no_signals")}`);
    lines.push(`${t("result")}: ${t("not_confirmed")}`);
    return lines.join("\n");
  }

  lines.push(`${t("found")}: ${summarizeEvidence(aggregate.passedEntries, t)}`);
  lines.push(`${t("result")}: ${t("not_confirmed")}`);
  return lines.join("\n");
}

export function formatAllStagesOutput({
  topLevelItems,
  evaluatedItems,
  t,
  humanStatus,
}) {
  const lines = [];
  lines.push(t("header_all"));

  if (!topLevelItems.length) {
    lines.push(`${t("result")}: ${t("no_clear_evidence")}`);
    return lines.join("\n");
  }

  for (const stage of topLevelItems) {
    const scopeItems = evaluatedItems.filter(
      (item) => item.code === stage.code || item.code.startsWith(`${stage.code}.`)
    );

    const aggregate = aggregateScope(scopeItems);

    lines.push(
      t("stage_line", {
        code: stage.code,
        status: humanStatus(aggregate.status),
      })
    );
  }

  return lines.join("\n");
}

export function formatCurrentOutput({
  topLevelItems,
  evaluatedItems,
  t,
  humanStatus,
}) {
  const lines = [];
  lines.push(t("header_current"));

  for (const stage of topLevelItems) {
    const scopeItems = evaluatedItems.filter(
      (item) => item.code === stage.code || item.code.startsWith(`${stage.code}.`)
    );

    const aggregate = aggregateScope(scopeItems);

    if (aggregate.status === "OPEN" || aggregate.status === "PARTIAL") {
      lines.push(`${t("current_stage")}: ${stage.code}`);
      lines.push(`${t("title")}: ${stage.title || "-"}`);
      lines.push(`${t("status")}: ${humanStatus(aggregate.status)}`);
      return lines.join("\n");
    }
  }

  for (const stage of topLevelItems) {
    const scopeItems = evaluatedItems.filter(
      (item) => item.code === stage.code || item.code.startsWith(`${stage.code}.`)
    );

    const aggregate = aggregateScope(scopeItems);

    if (aggregate.status === "NO_SIGNALS") {
      continue;
    }

    lines.push(`${t("current_stage")}: ${stage.code}`);
    lines.push(`${t("title")}: ${stage.title || "-"}`);
    lines.push(`${t("status")}: ${humanStatus(aggregate.status)}`);
    return lines.join("\n");
  }

  lines.push(t("all_complete"));
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
        })}`
      );
    }
  } else {
    lines.push("checkResults=[]");
  }

  return lines.join("\n");
}