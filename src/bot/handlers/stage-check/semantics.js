// ============================================================================
// === src/bot/handlers/stage-check/semantics.js
// === single source of truth for stage-check semantics
// ============================================================================

import {
  extractFunctionLikeTokens,
  extractSlashListItems,
} from "./extractors.js";

export function isPolicyLikeText(text) {
  const lower = String(text || "").toLowerCase();

  if (!lower) return false;

  return (
    lower.includes("safety rules") ||
    lower.includes("safe_policies") ||
    lower.includes("privacy-first") ||
    lower.includes("retention minimal") ||
    lower.includes("retention-policy") ||
    lower.includes("policy") ||
    lower.includes("policies") ||
    lower.includes("rules") ||
    lower.includes("hard ban") ||
    lower.includes("no diagnosis") ||
    lower.includes("no labels") ||
    lower.includes("no therapy") ||
    lower.includes("no therapy replacement") ||
    lower.includes("must not ") ||
    lower.includes("forbidden") ||
    lower.includes("privacy")
  );
}

export function isArchitectureLikeText(text) {
  const lower = String(text || "").toLowerCase();

  if (!lower) return false;

  return (
    lower.includes(" unified") ||
    lower.includes("transport thin") ||
    lower.includes("continues ") ||
    lower.includes("channel switch") ||
    lower.includes(" = ") ||
    lower.includes(" ≠ ") ||
    lower.includes("core/") ||
    lower.includes("memory/") ||
    lower.includes("access/")
  );
}

export function isInterfaceLikeTitle(title) {
  const lowerTitle = String(title || "").toLowerCase();

  return (
    lowerTitle.includes("interface") ||
    lowerTitle.includes("contract") ||
    lowerTitle.includes("methods")
  );
}

export function isModuleLikeTitle(title) {
  const lower = String(title || "").toLowerCase();

  return (
    lower.includes("module") ||
    lower.includes("модуль") ||
    lower.includes("capability") ||
    lower.includes("integration") ||
    lower.includes("integrations") ||
    lower.includes("source-first") ||
    lower.includes("voice") ||
    lower.includes("ui / api") ||
    lower.includes("web ui") ||
    lower.includes("discord") ||
    lower.includes("billing") ||
    lower.includes("support mode")
  );
}

export function isFoundationRuntimeLikeText(text) {
  const lower = String(text || "").toLowerCase();

  if (!lower) return false;

  return (
    lower.includes("telegram-bot") ||
    lower.includes("telegram bot") ||
    lower.includes("basic bot reply") ||
    lower.includes("bot reply") ||
    lower.includes("respond to messages") ||
    lower.includes("reply to messages") ||
    lower.includes("reply") ||
    lower.includes("webhook") ||
    lower.includes("render") ||
    lower.includes("node.js") ||
    lower.includes("express") ||
    lower.includes("base infrastructure") ||
    lower.includes("bootstrap") ||
    lower.includes("entrypoint") ||
    lower.includes("transport") ||
    lower.includes("runtime")
  );
}

export function isLikelyRealFunctionToken(token) {
  const raw = String(token || "").trim();
  if (!raw) return false;

  const lower = raw.toLowerCase();

  if (
    lower === "hard" ||
    lower === "soft" ||
    lower === "rules" ||
    lower === "rule" ||
    lower === "policy" ||
    lower === "policies" ||
    lower === "safety" ||
    lower === "privacy" ||
    lower === "diagnosis" ||
    lower === "labels" ||
    lower === "therapy" ||
    lower === "claims" ||
    lower === "support" ||
    lower === "mode"
  ) {
    return false;
  }

  if (
    raw.includes("/") ||
    raw.includes(":") ||
    raw.includes(",") ||
    raw.includes(";") ||
    raw.includes("—") ||
    raw.includes("–")
  ) {
    return false;
  }

  if (raw.startsWith("(") || raw.endsWith(")")) {
    return false;
  }

  if (raw.includes(" ") || raw.length < 3) {
    return false;
  }

  if (/^[A-Za-z_][A-Za-z0-9_]*\($/.test(raw)) return true;
  if (/^[A-Za-z_][A-Za-z0-9_]*\([^()]*\)$/.test(raw)) return true;
  if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(raw)) return true;

  return false;
}

export function sanitizeFunctionLikeTokens(tokens) {
  return Array.from(
    new Set(
      (tokens || [])
        .map((x) => String(x || "").trim())
        .filter(Boolean)
        .filter(isLikelyRealFunctionToken)
    )
  );
}

export function classifyWorkflowItemSemantics(item) {
  const ownText = `${item?.title || ""}\n${item?.body || ""}`;
  const title = String(item?.title || "");

  const policyLike = isPolicyLikeText(ownText);
  const architectureLike = !policyLike && isArchitectureLikeText(ownText);
  const foundationRuntimeLike =
    !policyLike &&
    !architectureLike &&
    isFoundationRuntimeLikeText(ownText);

  const rawFnTokens = extractFunctionLikeTokens(ownText);
  const fnTokens = sanitizeFunctionLikeTokens(rawFnTokens);

  const hasExplicitSignature = fnTokens.some(
    (x) =>
      /^[A-Za-z_][A-Za-z0-9_]*\($/.test(String(x || "").trim()) ||
      /^[A-Za-z_][A-Za-z0-9_]*\([^()]*\)$/.test(String(x || "").trim())
  );

  const hasFunctionName = fnTokens.some((x) =>
    /^[A-Za-z_][A-Za-z0-9_]*$/.test(String(x || "").trim())
  );

  const hasInterfaceWord = isInterfaceLikeTitle(title);
  const slashList = extractSlashListItems(ownText);
  const hasSlashList = slashList.length > 0;

  let semanticType = "generic";

  if (policyLike) {
    semanticType = "policy_like";
  } else if (architectureLike) {
    semanticType = "architecture_like";
  } else if (hasInterfaceWord && hasSlashList) {
    semanticType = "interface_like";
  } else if (hasExplicitSignature || hasFunctionName) {
    semanticType = "signature_like";
  } else if (foundationRuntimeLike) {
    semanticType = "foundation_runtime_like";
  }

  return {
    semanticType,
    functionTokens: fnTokens,
    hasInterfaceWord,
    hasSlashList,
    isPolicyLike: policyLike,
    isArchitectureLike: architectureLike,
    isFoundationRuntimeLike: foundationRuntimeLike,
  };
}

export function determineSemanticTypeFromChecks(item, autoChecks = []) {
  const base = classifyWorkflowItemSemantics(item);

  if (
    base.semanticType === "policy_like" ||
    base.semanticType === "architecture_like"
  ) {
    return base;
  }

  const labels = autoChecks.map((x) => String(x?.label || "").toLowerCase());

  const hasCarrier = labels.some((x) =>
    x.includes("contract carrier token:")
  );

  const hasSignature = labels.some(
    (x) =>
      x.includes("function signature token:") ||
      x.includes("function call token:")
  );

  if (hasCarrier) {
    return { ...base, semanticType: "interface_like" };
  }

  if (hasSignature) {
    return { ...base, semanticType: "signature_like" };
  }

  return base;
}