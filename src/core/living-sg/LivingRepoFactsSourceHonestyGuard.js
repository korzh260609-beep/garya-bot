// src/core/living-sg/LivingRepoFactsSourceHonestyGuard.js
// ============================================================================
// LIVING SG — Repo Facts Source-Honesty Guard
//
// Purpose:
// - enforce existing source-first / no-fantasy policy at runtime;
// - prevent current repository fact questions from falling through to generic AI
//   when no deterministic verified answer is available;
// - allow imagination only when the user explicitly asks for invention/modeling.
//
// Boundaries:
// - no repository reads;
// - no repository writes;
// - no source calls;
// - no executor;
// - no slash-command routing;
// - no keyword/phrase router;
// - semantic classification only decides whether generic AI may claim facts.
// ============================================================================

function safeText(value) {
  return String(value ?? "").trim();
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function clampConfidence(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

function parseJsonObjectFromText(value) {
  const text = safeText(value);
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {}

  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace < 0 || lastBrace <= firstBrace) return null;

  try {
    return JSON.parse(text.slice(firstBrace, lastBrace + 1));
  } catch {
    return null;
  }
}

function hasConfirmedSourceEnvelope(sourceResultEnvelope = null) {
  return (
    isPlainObject(sourceResultEnvelope) &&
    sourceResultEnvelope.canClaimVerifiedFacts === true &&
    sourceResultEnvelope?.confirmation?.status === "confirmed"
  );
}

function getProjectMap(sourceResultEnvelope = null) {
  const payload = sourceResultEnvelope?.payload;
  if (!isPlainObject(payload)) return null;
  if (isPlainObject(payload.projectMap)) return payload.projectMap;
  if (isPlainObject(payload.payload?.projectMap)) return payload.payload.projectMap;
  return null;
}

function fallbackAllow(reason = "repo_facts_source_honesty_guard_not_applicable") {
  return {
    handled: false,
    shouldBlockGenericAiFacts: false,
    shouldAllowGenericAi: true,
    reason,
  };
}

function buildBlockedReply({ sourceResultEnvelope = null, deterministicRepoAnswer = null } = {}) {
  const hasConfirmedSource = hasConfirmedSourceEnvelope(sourceResultEnvelope);
  const projectMap = getProjectMap(sourceResultEnvelope);
  const repo = projectMap?.repo || {};
  const totals = projectMap?.totals || {};

  const lines = [
    "Не буду придумывать.",
    hasConfirmedSource
      ? `Источник repo/projectMap подтверждён для ${safeText(repo.fullName) || "репозитория"} на ветке ${safeText(repo.branch) || "unknown"}.`
      : "Подтверждённого source-result для текущих repo facts нет.",
    "Но для этого точного фактического ответа нет поддержанного deterministic verified answer.",
  ];

  if (projectMap) {
    lines.push(
      "Доступные verified summary-факты:",
      `- файлов всего: ${Number.isFinite(Number(totals.files)) ? Number(totals.files) : "не подтверждено"}`,
      `- модулей: ${Number.isFinite(Number(totals.modules)) ? Number(totals.modules) : "не подтверждено"}`,
      `- dependencies: ${Number.isFinite(Number(totals.dependencies)) ? Number(totals.dependencies) : "не подтверждено"}`,
      `- структура полная: ${totals.structureComplete === true ? "да" : "нет/не подтверждено"}`
    );
  }

  lines.push(
    "Чтобы ответить точнее, нужно добавить deterministic обработчик для этого типа repo facts, а не отдавать вопрос обычному AI.",
    deterministicRepoAnswer?.reason
      ? `Причина bypass deterministic builder: ${safeText(deterministicRepoAnswer.reason)}`
      : ""
  );

  return lines.filter(Boolean).join("\n");
}

export async function guardRepoFactsSourceHonesty({
  callAI,
  userText,
  livingSGPlan = null,
  sourceResultEnvelope = null,
  deterministicRepoAnswer = null,
} = {}) {
  if (deterministicRepoAnswer?.handled === true) {
    return fallbackAllow("deterministic_repo_answer_already_handled");
  }

  if (livingSGPlan?.intentPlan?.intentKind !== "project_thinking") {
    return fallbackAllow("not_project_thinking");
  }

  const text = safeText(userText);
  if (!text) return fallbackAllow("empty_user_text");
  if (typeof callAI !== "function") return fallbackAllow("callai_missing");

  const messages = [
    {
      role: "system",
      content:
        "You are a strict runtime source-honesty guard for an assistant.\n" +
        "Decide whether the user asks for CURRENT FACTUAL REPOSITORY FACTS that must not be answered by generic AI unless a deterministic verified source-backed answer is available.\n" +
        "Do not answer the user. Do not solve the task. Return ONLY valid JSON.\n\n" +
        "Schema:\n" +
        "{\n" +
        '  "requiresCurrentRepoFacts": boolean,\n' +
        '  "explicitlyRequestsImagination": boolean,\n' +
        '  "factNeed": "none" | "repo_count" | "repo_structure" | "repo_root_listing" | "repo_file_listing" | "repo_status" | "other_repo_fact",\n' +
        '  "mayUseGenericAI": boolean,\n' +
        '  "confidence": number,\n' +
        '  "reason": string\n' +
        "}\n\n" +
        "Rules:\n" +
        "- requiresCurrentRepoFacts=true when the user asks what is currently in the repository, counts, names, structure, root items, files, modules, paths, status, or other verifiable repo facts.\n" +
        "- explicitlyRequestsImagination=true only when the user clearly asks to invent, imagine, simulate, brainstorm, or design a hypothetical answer.\n" +
        "- mayUseGenericAI=false when current repo facts are required and imagination is not requested.\n" +
        "- Do not use keyword matching as the reason. Judge semantic intent and required evidence.\n" +
        "- If unsure whether a factual repo claim is required, prefer source-honesty and set mayUseGenericAI=false.\n" +
        "- Output JSON only.",
    },
    {
      role: "user",
      content: `User message:\n${text}\n`,
    },
  ];

  try {
    const raw = await callAI(messages, "low", {
      max_completion_tokens: 180,
      temperature: 0.1,
    });

    const parsed = parseJsonObjectFromText(raw);
    if (!parsed || typeof parsed !== "object") {
      return fallbackAllow("semantic_guard_json_parse_failed");
    }

    const requiresCurrentRepoFacts = parsed?.requiresCurrentRepoFacts === true;
    const explicitlyRequestsImagination = parsed?.explicitlyRequestsImagination === true;
    const confidence = clampConfidence(parsed?.confidence);
    const mayUseGenericAI = parsed?.mayUseGenericAI !== false;

    if (
      requiresCurrentRepoFacts === true &&
      explicitlyRequestsImagination !== true &&
      (mayUseGenericAI === false || confidence >= 0.55)
    ) {
      return {
        handled: true,
        source: "LivingRepoFactsSourceHonestyGuard",
        shouldBlockGenericAiFacts: true,
        shouldAllowGenericAi: false,
        reason: safeText(parsed?.reason) || "current_repo_facts_require_verified_source",
        factNeed: safeText(parsed?.factNeed) || "other_repo_fact",
        confidence,
        text: buildBlockedReply({
          sourceResultEnvelope,
          deterministicRepoAnswer,
        }),
        metadata: {
          noAiFactAnswer: true,
          noRepoRead: true,
          noRepoWrite: true,
          noSourceCall: true,
          noExecutor: true,
          enforcedExistingSourceHonestyPolicy: true,
        },
      };
    }

    return fallbackAllow("generic_ai_allowed_by_source_honesty_guard");
  } catch (error) {
    return fallbackAllow(
      error?.message
        ? `repo_facts_source_honesty_guard_error:${String(error.message)}`
        : "repo_facts_source_honesty_guard_error"
    );
  }
}

export default {
  guardRepoFactsSourceHonesty,
};
