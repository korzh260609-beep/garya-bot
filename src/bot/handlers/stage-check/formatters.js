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
      formal_status: "Формальный статус",
      real_status: "Реальный статус",
      status_gap: "Разрыв статусов",
      gap_reason: "Причина разрыва",
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
      result: "Итог",
      no_clear_evidence: "Явного подтверждения в репозитории не найдено",
      current_stage: "Текущий этап",
      all_complete: "Все верхние этапы подтверждены",
      real_diag_header: "Real diagnostics",
      chosen_rule: "Сработавшее правило",
      metrics: "Метрики",
      child_statuses: "Дочерние статусы",
      own_exact_rule: "Правило exact-review",
      probability_score: "probabilityScore",
      foundation_signal_score: "foundationSignalScore",
      coverage_score: "coverageScore",
      candidate_count: "candidateCount",
      direct_entrypoint_count: "directEntrypointCount",
      repo_ref_files: "repoRefFiles",
      impl_anchors: "distinctImplementationAnchors",
      runtime_foundation_count: "runtimeFoundationCount",
      active_ratio: "activeRatio",
      partial_or_better_count: "partialOrBetterCount",
      reachability_children: "reachabilityChildren",
      strong_foundation_children: "strongFoundationChildren",
      own_exact_status: "ownExactStatus",
      own_probability_score: "ownProbabilityScore",
      own_foundation_signal_score: "ownFoundationSignalScore",
      own_coverage_score: "ownCoverageScore",
      own_direct_entrypoint_count: "ownDirectEntrypointCount",
      own_candidate_count: "ownCandidateCount",
      own_repo_ref_files: "ownRepoRefFiles",
      own_impl_anchors: "ownImplementationAnchors",
      own_has_meaningful_signals: "ownHasMeaningfulSignals",
      own_strong_foundation: "ownStrongFoundation",
      no_diag: "diagnostics отсутствуют",
      draft_profile_header: "Draft profile diagnostics",
      draft_profile_key: "draftProfileKey",
      draft_profile_family: "draftProfileFamily",
      draft_profile_score: "draftProfileScore",
      draft_profile_tags: "draftSemanticTags",
    },
    uk: {
      header_single: "Перевірка етапу: {code}",
      header_all: "Перевірка етапів: усі",
      header_current: "Перевірка етапів: поточний",
      formal_status: "Формальний статус",
      real_status: "Реальний статус",
      status_gap: "Розрив статусів",
      gap_reason: "Причина розриву",
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
      result: "Підсумок",
      no_clear_evidence: "Явного підтвердження в репозиторії не знайдено",
      current_stage: "Поточний етап",
      all_complete: "Усі верхні етапи підтверджені",
      real_diag_header: "Real diagnostics",
      chosen_rule: "Правило, що спрацювало",
      metrics: "Метрики",
      child_statuses: "Дочірні статуси",
      own_exact_rule: "Правило exact-review",
      probability_score: "probabilityScore",
      foundation_signal_score: "foundationSignalScore",
      coverage_score: "coverageScore",
      candidate_count: "candidateCount",
      direct_entrypoint_count: "directEntrypointCount",
      repo_ref_files: "repoRefFiles",
      impl_anchors: "distinctImplementationAnchors",
      runtime_foundation_count: "runtimeFoundationCount",
      active_ratio: "activeRatio",
      partial_or_better_count: "partialOrBetterCount",
      reachability_children: "reachabilityChildren",
      strong_foundation_children: "strongFoundationChildren",
      own_exact_status: "ownExactStatus",
      own_probability_score: "ownProbabilityScore",
      own_foundation_signal_score: "ownFoundationSignalScore",
      own_coverage_score: "ownCoverageScore",
      own_direct_entrypoint_count: "ownDirectEntrypointCount",
      own_candidate_count: "ownCandidateCount",
      own_repo_ref_files: "ownRepoRefFiles",
      own_impl_anchors: "ownImplementationAnchors",
      own_has_meaningful_signals: "ownHasMeaningfulSignals",
      own_strong_foundation: "ownStrongFoundation",
      no_diag: "diagnostics відсутні",
      draft_profile_header: "Draft profile diagnostics",
      draft_profile_key: "draftProfileKey",
      draft_profile_family: "draftProfileFamily",
      draft_profile_score: "draftProfileScore",
      draft_profile_tags: "draftSemanticTags",
    },
    en: {
      header_single: "Stage check: {code}",
      header_all: "Stage check: all",
      header_current: "Stage check: current",
      formal_status: "Formal status",
      real_status: "Real status",
      status_gap: "Status gap",
      gap_reason: "Gap reason",
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
      result: "Result",
      no_clear_evidence: "No clear evidence found in repository",
      current_stage: "Current stage",
      all_complete: "All top-level stages are confirmed",
      real_diag_header: "Real diagnostics",
      chosen_rule: "Chosen rule",
      metrics: "Metrics",
      child_statuses: "Child statuses",
      own_exact_rule: "Exact-review rule",
      probability_score: "probabilityScore",
      foundation_signal_score: "foundationSignalScore",
      coverage_score: "coverageScore",
      candidate_count: "candidateCount",
      direct_entrypoint_count: "directEntrypointCount",
      repo_ref_files: "repoRefFiles",
      impl_anchors: "distinctImplementationAnchors",
      runtime_foundation_count: "runtimeFoundationCount",
      active_ratio: "activeRatio",
      partial_or_better_count: "partialOrBetterCount",
      reachability_children: "reachabilityChildren",
      strong_foundation_children: "strongFoundationChildren",
      own_exact_status: "ownExactStatus",
      own_probability_score: "ownProbabilityScore",
      own_foundation_signal_score: "ownFoundationSignalScore",
      own_coverage_score: "ownCoverageScore",
      own_direct_entrypoint_count: "ownDirectEntrypointCount",
      own_candidate_count: "ownCandidateCount",
      own_repo_ref_files: "ownRepoRefFiles",
      own_impl_anchors: "ownImplementationAnchors",
      own_has_meaningful_signals: "ownHasMeaningfulSignals",
      own_strong_foundation: "ownStrongFoundation",
      no_diag: "diagnostics missing",
      draft_profile_header: "Draft profile diagnostics",
      draft_profile_key: "draftProfileKey",
      draft_profile_family: "draftProfileFamily",
      draft_profile_score: "draftProfileScore",
      draft_profile_tags: "draftSemanticTags",
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

function pushLine(lines, value) {
  if (value !== null && value !== undefined && String(value).trim() !== "") {
    lines.push(String(value));
  }
}

function buildMetricsLines(realDiag, t) {
  const m = realDiag?.metrics || {};
  const lines = [];

  if (!realDiag) {
    lines.push(`${t("real_diag_header")}: ${t("no_diag")}`);
    return lines;
  }

  const hasExactMetrics =
    m.probabilityScore !== undefined ||
    m.foundationSignalScore !== undefined ||
    m.coverageScore !== undefined ||
    m.candidateCount !== undefined ||
    m.directEntrypointCount !== undefined ||
    m.repoRefFiles !== undefined ||
    m.distinctImplementationAnchors !== undefined ||
    m.runtimeFoundationCount !== undefined;

  const hasAggregateOwnMetrics =
    m.ownExactStatus !== undefined ||
    m.ownProbabilityScore !== undefined ||
    m.ownFoundationSignalScore !== undefined ||
    m.ownCoverageScore !== undefined ||
    m.ownDirectEntrypointCount !== undefined ||
    m.ownCandidateCount !== undefined ||
    m.ownRepoRefFiles !== undefined ||
    m.ownImplementationAnchors !== undefined ||
    m.ownHasMeaningfulSignals !== undefined ||
    m.ownStrongFoundation !== undefined;

  lines.push(`${t("real_diag_header")}:`);
  lines.push(`- ${t("chosen_rule")}: ${realDiag?.chosenRule || "-"}`);
  lines.push(`- ${t("metrics")}:`);

  if (hasExactMetrics) {
    pushLine(lines, `  • ${t("probability_score")}: ${m.probabilityScore ?? "-"}`);
    pushLine(lines, `  • ${t("foundation_signal_score")}: ${m.foundationSignalScore ?? "-"}`);
    pushLine(lines, `  • ${t("coverage_score")}: ${m.coverageScore ?? "-"}`);
    pushLine(lines, `  • ${t("candidate_count")}: ${m.candidateCount ?? "-"}`);
    pushLine(lines, `  • ${t("direct_entrypoint_count")}: ${m.directEntrypointCount ?? "-"}`);
    pushLine(lines, `  • ${t("repo_ref_files")}: ${m.repoRefFiles ?? "-"}`);
    pushLine(lines, `  • ${t("impl_anchors")}: ${m.distinctImplementationAnchors ?? "-"}`);
    pushLine(lines, `  • ${t("runtime_foundation_count")}: ${m.runtimeFoundationCount ?? "-"}`);
  }

  if (hasAggregateOwnMetrics) {
    pushLine(lines, `  • ${t("own_exact_status")}: ${m.ownExactStatus ?? "-"}`);
    pushLine(lines, `  • ${t("own_probability_score")}: ${m.ownProbabilityScore ?? "-"}`);
    pushLine(lines, `  • ${t("own_foundation_signal_score")}: ${m.ownFoundationSignalScore ?? "-"}`);
    pushLine(lines, `  • ${t("own_coverage_score")}: ${m.ownCoverageScore ?? "-"}`);
    pushLine(lines, `  • ${t("own_direct_entrypoint_count")}: ${m.ownDirectEntrypointCount ?? "-"}`);
    pushLine(lines, `  • ${t("own_candidate_count")}: ${m.ownCandidateCount ?? "-"}`);
    pushLine(lines, `  • ${t("own_repo_ref_files")}: ${m.ownRepoRefFiles ?? "-"}`);
    pushLine(lines, `  • ${t("own_impl_anchors")}: ${m.ownImplementationAnchors ?? "-"}`);
    pushLine(lines, `  • ${t("own_has_meaningful_signals")}: ${m.ownHasMeaningfulSignals ?? "-"}`);
    pushLine(lines, `  • ${t("own_strong_foundation")}: ${m.ownStrongFoundation ?? "-"}`);
  }

  if (m.activeRatio !== undefined) {
    pushLine(lines, `  • ${t("active_ratio")}: ${m.activeRatio}`);
  }
  if (m.partialOrBetterCount !== undefined) {
    pushLine(lines, `  • ${t("partial_or_better_count")}: ${m.partialOrBetterCount}`);
  }
  if (m.reachabilityChildren !== undefined) {
    pushLine(lines, `  • ${t("reachability_children")}: ${m.reachabilityChildren}`);
  }
  if (m.strongFoundationChildren !== undefined) {
    pushLine(lines, `  • ${t("strong_foundation_children")}: ${m.strongFoundationChildren}`);
  }

  return lines;
}

function buildChildStatusesLines(realDiag, t) {
  const childStatuses = Array.isArray(realDiag?.childStatuses)
    ? realDiag.childStatuses
    : [];

  if (childStatuses.length === 0) {
    return [];
  }

  const lines = [];
  lines.push(`- ${t("child_statuses")}:`);

  for (const child of childStatuses.slice(0, 8)) {
    lines.push(
      `  • ${child.code || "-"}: ${child.status || "-"} | ${t("chosen_rule")}: ${child.chosenRule || "-"}`
    );
  }

  return lines;
}

function buildOwnExactRuleLines(realDiag, t) {
  const ownExactRule = realDiag?.ownExactDiagnostics?.chosenRule || null;
  if (!ownExactRule) return [];
  return [`- ${t("own_exact_rule")}: ${ownExactRule}`];
}

function buildDraftProfileLines(draftProfileDiag, t) {
  if (!draftProfileDiag) return [];

  const tags = Array.isArray(draftProfileDiag?.semanticTags)
    ? draftProfileDiag.semanticTags
    : [];

  return [
    `${t("draft_profile_header")}:`,
    `- ${t("draft_profile_key")}: ${draftProfileDiag?.profileKey || "generic.default"}`,
    `- ${t("draft_profile_family")}: ${draftProfileDiag?.family || "generic"}`,
    `- ${t("draft_profile_score")}: ${Number(draftProfileDiag?.score || 0)}`,
    `- ${t("draft_profile_tags")}: ${tags.length > 0 ? tags.join(", ") : "-"}`,
  ];
}

export function formatSingleItemOutput({
  review,
  t,
  humanStatus,
  humanGapReason,
  includeDiagnostics = false,
}) {
  const lines = [];

  lines.push(t("header_single", { code: review?.item?.code || "-" }));
  lines.push(`${t("formal_status")}: ${humanStatus(review?.formal?.status)}`);
  lines.push(`${t("real_status")}: ${humanStatus(review?.real?.status)}`);
  lines.push(`${t("status_gap")}: ${review?.gap?.exists ? t("yes") : t("no")}`);
  lines.push(`${t("gap_reason")}: ${humanGapReason(review?.gap?.reason)}`);

  if (includeDiagnostics) {
    lines.push("");
    lines.push(...buildMetricsLines(review?.real?.diagnostics, t));
    lines.push(...buildOwnExactRuleLines(review?.real?.diagnostics, t));
    lines.push(...buildChildStatusesLines(review?.real?.diagnostics, t));
    lines.push("");
    lines.push(...buildDraftProfileLines(review?.draftProfileDiag, t));
  }

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
  includeDiagnostics = false,
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
      `${review?.item?.code || "-"} — ${buildStageLineStatus(review, humanStatus, humanGapReason)}`
    );

    if (includeDiagnostics) {
      const chosenRule = review?.real?.diagnostics?.chosenRule || "-";
      const profileKey = review?.draftProfileDiag?.profileKey || "generic.default";
      const profileFamily = review?.draftProfileDiag?.family || "generic";
      lines.push(`  ${t("chosen_rule")}: ${chosenRule}`);
      lines.push(`  ${t("draft_profile_key")}: ${profileKey}`);
      lines.push(`  ${t("draft_profile_family")}: ${profileFamily}`);
    }
  }

  return lines.join("\n");
}

function isStageReviewComplete(review) {
  const formalStatus = String(review?.formal?.status || "NO_SIGNALS");
  const realStatus = String(review?.real?.status || "UNKNOWN");

  return formalStatus === "COMPLETE" && realStatus === "COMPLETE";
}

function chooseCurrentStageReview(stageReviews) {
  const list = Array.isArray(stageReviews) ? stageReviews : [];

  if (list.length === 0) {
    return null;
  }

  // Canonical current stage rule:
  // choose the FIRST top-level stage from the top that is not fully complete yet.
  for (const review of list) {
    if (!isStageReviewComplete(review)) {
      return review;
    }
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
  includeDiagnostics = false,
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

  if (includeDiagnostics) {
    lines.push("");
    lines.push(...buildMetricsLines(chosen?.real?.diagnostics, t));
    lines.push(...buildOwnExactRuleLines(chosen?.real?.diagnostics, t));
    lines.push(...buildChildStatusesLines(chosen?.real?.diagnostics, t));
    lines.push("");
    lines.push(...buildDraftProfileLines(chosen?.draftProfileDiag, t));
  }

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