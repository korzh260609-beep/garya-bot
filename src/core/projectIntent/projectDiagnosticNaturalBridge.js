// src/core/projectIntent/projectDiagnosticNaturalBridge.js
// ============================================================================
// Project Diagnostic Natural Bridge
// Purpose:
// - User speaks normal language to SG.
// - SG internally calls RepoStateAgent with safe no-real-AI options.
// - Reply stays human-readable and transport-agnostic.
//
// Boundary:
// - NO slash-command dependency.
// - NO Telegram dependency.
// - NO real AI spending.
// - NO repo writes.
// - NO pillars edits.
//
// IMPORTANT:
// - This bridge is a temporary capability adapter for RepoStateAgent.
// - It must not use phrase-bound command hacks as the factual routing base.
// - It routes by the existing projectIntent route/match object.
// ============================================================================

import { RepoStateAgentService } from "../../simpleAgents/repoStateAgent/RepoStateAgentService.js";

const REPO_STATE_DIAGNOSTIC_CAPABILITY = "repo_state_diagnostic";

function normalizeText(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function safeNumber(value, fallback = "-") {
  return Number.isFinite(value) ? String(value) : fallback;
}

function boolText(value) {
  return value === true ? "да" : "нет";
}

function countBySeverity(findings = [], severity) {
  return asArray(findings).filter((item) => item?.severity === severity).length;
}

function humanStatus(status) {
  const map = {
    high_risk: "повышенный риск",
    needs_attention: "требует внимания",
    watch: "под контролем",
    ok: "нормально",
  };

  return map[String(status || "").trim()] || "неизвестно";
}

function humanFinding(item = {}) {
  const id = String(item?.id || "").trim();

  const map = {
    large_repo_requires_maps: "Репозиторий уже большой: СГ должен сначала пользоваться картой проекта, а не читать всё подряд.",
    unresolved_internal_dependencies_present: "Есть нерешённые внутренние зависимости. Перед рефакторингом надо проверять импорты.",
    pillars_are_present_and_protected: "Файлы pillars найдены и защищены. Их нельзя менять без прямого разрешения Монарха.",
    transport_must_remain_multitransport: "Транспорт должен оставаться универсальным. Telegram — только один адаптер, не основа архитектуры.",
    legacy_root_artifacts_need_review: "В корне есть старые/служебные артефакты. Их надо сначала разобрать, а не удалять сразу.",
    unexpected_semantic_map_token_spend: "Внимание: карта проекта не должна тратить AI-токены без разрешения.",
  };

  if (map[id]) return map[id];
  if (item?.title) return String(item.title);
  return "Найден архитектурный пункт для проверки.";
}

function humanNextStep(item = {}) {
  const id = String(item?.id || "").trim();

  const map = {
    wire_safety_gates_into_reports: "Перед выбором файлов для задачи использовать правила безопасности.",
    use_recommended_read_order_for_context_restore: "Для быстрого восстановления контекста читать файлы в рекомендованном порядке.",
    review_legacy_root_artifacts: "Проверить старые файлы в корне проекта без удаления.",
    snapshot_after_verified_green_check: "После успешной проверки сделать snapshot/точку отката.",
  };

  if (map[id]) return map[id];
  if (item?.title) return String(item.title);
  return "Выполнить следующий безопасный шаг по плану.";
}

function buildTopFindingsText(findings = [], limit = 3) {
  const top = asArray(findings)
    .filter((item) => ["critical", "high", "medium"].includes(item?.severity))
    .slice(0, limit);

  if (!top.length) return "- явных критичных пунктов не найдено";

  return top.map((item) => `- ${humanFinding(item)}`).join("\n");
}

function buildNextStepsText(steps = [], limit = 3) {
  const top = asArray(steps).slice(0, limit);
  if (!top.length) return "- следующий шаг не определён";

  return top.map((item) => `- ${humanNextStep(item)}`).join("\n");
}

function hasAnyArrayValue(...values) {
  return values.some((value) => asArray(value).length > 0);
}

function hasRepoLikeRouteSignal(match = {}) {
  const semanticIntentKind = String(match?.semanticIntentKind || "").trim();

  if (
    [
      "repo_access_meta",
      "repo_structure_read",
      "repo_path_read",
      "internal_repo_read",
      "canonical_pillar_read",
      "canonical_pillar_reference",
    ].includes(semanticIntentKind)
  ) {
    return true;
  }

  if (match?.hasAccessMetaSignal === true || match?.hasRepoPathSignal === true) {
    return true;
  }

  return hasAnyArrayValue(
    match?.repoTargetPrefixHits,
    match?.repoStructureHits,
    match?.repoPathHits,
    match?.canonicalPillarHits,
    match?.strongObjectHits,
    match?.sgCoreObjectPrefixHits,
    match?.sgCoreObjectTokenStrongHits,
    match?.sgCoreStrongAnchorHits
  );
}

function hasUserProjectRouteSignal(match = {}) {
  return hasAnyArrayValue(match?.userProjectPhraseHits, match?.userProjectTokenHits);
}

function resolveRepoStateDiagnosticCapability({ text, route } = {}) {
  const normalized = normalizeText(text);
  if (!normalized) {
    return {
      shouldHandle: false,
      reason: "empty_text",
      mode: "none",
      capability: null,
    };
  }

  const match = route?.match || {};
  const routeTarget = route?.targetScope || "unknown";
  const routeAction = route?.actionMode || "unknown";
  const readOnlyRequest = routeAction !== "write" && routeAction !== "mixed";
  const repoLike = hasRepoLikeRouteSignal(match);
  const userProjectLike = hasUserProjectRouteSignal(match);

  const allowedSgCoreRead = routeTarget === "sg_core_internal" && readOnlyRequest;
  const allowedGenericRepoRead = routeTarget === "generic_external" && readOnlyRequest && repoLike && !userProjectLike;

  if (!repoLike) {
    return {
      shouldHandle: false,
      reason: "no_repo_state_capability_signal",
      mode: "none",
      capability: null,
    };
  }

  if (!allowedSgCoreRead && !allowedGenericRepoRead) {
    return {
      shouldHandle: false,
      reason: "not_repo_state_read_capability_scope",
      mode: "none",
      capability: null,
    };
  }

  return {
    shouldHandle: true,
    reason: "repo_state_diagnostic_capability_route",
    mode: "project_state",
    capability: REPO_STATE_DIAGNOSTIC_CAPABILITY,
  };
}

function buildMainPartsText(projectMap = {}) {
  const semanticMap = projectMap?.semanticMap || {};
  const modulePurposes = asArray(semanticMap?.modulePurposes);
  const important = [
    ["СГ core", ["core", "services", "decision"]],
    ["Агенты", ["simple_agents", "agent_workspace", "repo_state_collector"]],
    ["Память", ["memory", "project_memory", "project_experience"]],
    ["Источники", ["sources", "integrations"]],
    ["Транспорты", ["transport", "http"]],
  ];

  const lines = [];

  for (const [title, layers] of important) {
    const found = modulePurposes
      .filter((item) => layers.includes(item?.layer))
      .map((item) => item?.rootPath || item?.moduleKey)
      .filter(Boolean)
      .slice(0, 5);

    lines.push(`- ${title}: ${found.length ? found.join(", ") : "не найдено в краткой карте"}`);
  }

  return lines.join("\n");
}

function buildHumanDiagnosticReply({ result, mode } = {}) {
  const projectMap = result?.projectMap || {};
  const semanticMap = projectMap?.semanticMap || {};
  const nextActionPlan = result?.nextActionPlan || {};
  const architectureHealth = result?.architectureHealth || {};
  const aiAnalysis = result?.aiAnalysis || {};
  const findings = asArray(architectureHealth?.findings);
  const steps = asArray(nextActionPlan?.suggestedNextSteps);

  const tokensSpent =
    aiAnalysis?.tokensSpent === true ||
    semanticMap?.tokensSpent === true ||
    nextActionPlan?.tokensSpent === true ||
    architectureHealth?.tokensSpent === true;

  const base = [
    "Проверил репозиторий через RepoStateAgent.",
    "",
    "Что СГ понял о проекте:",
    "- Это SG / Советник GARYA: мультислойный проект, где Telegram сейчас только один транспорт.",
    "- Фактическая карта репозитория должна идти через RepoStateAgent, а не через старый RepoIndex.",
    "",
    "Главные части проекта:",
    buildMainPartsText(projectMap),
    "",
    `Состояние: ${humanStatus(architectureHealth?.status)}`,
    `Оценка архитектуры: ${safeNumber(architectureHealth?.score)}/100`,
    `Файлов: ${result?.filesCount ?? projectMap?.totals?.files ?? "-"}`,
    `Модулей: ${result?.modulesCount ?? projectMap?.totals?.modules ?? "-"}`,
    `Зависимостей: ${result?.dependenciesCount ?? projectMap?.totals?.dependencies ?? "-"}`,
    `Токены потрачены: ${boolText(tokensSpent)}`,
  ];

  const riskBlock = [
    `Риски: высокие=${countBySeverity(findings, "high")}, средние=${countBySeverity(findings, "medium")}, критичные=${countBySeverity(findings, "critical")}`,
    "",
    "Главные риски:",
    buildTopFindingsText(findings, 5),
  ];

  const nextBlock = [
    "Что делать дальше:",
    buildNextStepsText(steps, 4),
    "",
    "Как Монарх может использовать это через СГ:",
    "- просить состояние проекта обычным языком;",
    "- просить риски по репозиторию;",
    "- просить следующий безопасный шаг;",
    "- не использовать старый RepoIndex как правду.",
  ];

  if (mode === "architecture_health") {
    return [...base, "", ...riskBlock, "", "Вывод: это диагностика, код не менялся."].join("\n");
  }

  if (mode === "next_action_plan") {
    return [...base, "", ...nextBlock].join("\n");
  }

  return [...base, "", ...riskBlock, "", ...nextBlock].join("\n");
}

export async function maybeHandleProjectDiagnosticNaturalBridge({
  text,
  route,
  replyAndLog,
  isMonarchUser = false,
  isPrivateChat = false,
  transport = "unknown",
  chatId = null,
  globalUserId = null,
} = {}) {
  const diagnostic = resolveRepoStateDiagnosticCapability({ text, route });

  if (!diagnostic.shouldHandle) {
    return {
      handled: false,
      reason: diagnostic.reason,
    };
  }

  if (!isMonarchUser || !isPrivateChat) {
    if (typeof replyAndLog === "function") {
      await replyAndLog(
        "Это внутренняя диагностика СГ. Она доступна только Монарху в приватном/доверенном контексте.",
        {
          handler: "projectDiagnosticNaturalBridge",
          event: "project_diagnostic_access_denied",
          capability: diagnostic.capability,
          transport_agnostic: true,
          read_only: true,
          transport,
          chatId,
          globalUserId,
        }
      );
    }

    return {
      handled: true,
      reason: "project_diagnostic_access_denied",
    };
  }

  if (typeof replyAndLog === "function") {
    await replyAndLog("Принял. Проверяю репозиторий через RepoStateAgent без real AI токенов.", {
      handler: "projectDiagnosticNaturalBridge",
      event: "project_diagnostic_started",
      capability: diagnostic.capability,
      mode: diagnostic.mode,
      transport_agnostic: true,
      read_only: true,
      tokens_spent: false,
    });
  }

  const service = new RepoStateAgentService();
  const result = await service.run({
    forceAiAnalysis: false,
    allowRealAi: false,
  });

  const reply = buildHumanDiagnosticReply({
    result,
    mode: diagnostic.mode,
  });

  if (typeof replyAndLog === "function") {
    await replyAndLog(reply, {
      handler: "projectDiagnosticNaturalBridge",
      event: "project_diagnostic_completed",
      capability: diagnostic.capability,
      mode: diagnostic.mode,
      transport_agnostic: true,
      read_only: true,
      tokens_spent: false,
      architectureHealthStatus: result?.architectureHealth?.status || null,
      architectureHealthScore: result?.architectureHealth?.score ?? null,
      scanRunId: result?.persistence?.scanRunId || null,
    });
  }

  return {
    handled: true,
    reason: "project_diagnostic_completed",
    mode: diagnostic.mode,
    capability: diagnostic.capability,
    result,
  };
}

export default {
  maybeHandleProjectDiagnosticNaturalBridge,
};
