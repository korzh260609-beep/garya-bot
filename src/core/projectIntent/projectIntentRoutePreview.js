// src/core/projectIntent/projectIntentRoutePreview.js
// ============================================================================
// STAGE 12A.0 — project intent route preview helper (SKELETON)
// Purpose:
// - keep human-readable route preview in ONE place
// - avoid duplicating route meaning across diagnostics / guards / future handlers
// - pure helper only
// IMPORTANT:
// - NO command execution
// - NO repo writes
// - NO side effects
// ============================================================================

function safeRouteKey(route = {}) {
  return String(route?.routeKey || "").trim();
}

export function buildProjectIntentRoutePreview(route = {}) {
  const routeKey = safeRouteKey(route);

  if (!routeKey) {
    return {
      text: "- result: UNKNOWN",
      kind: "unknown",
    };
  }

  if (routeKey === "sg_core_internal_write_denied") {
    return {
      text: "- result: BLOCK (sg_core_internal write-intent denied)",
      kind: "sg_core_internal_write_denied",
    };
  }

  if (routeKey === "sg_core_internal_read_allowed") {
    return {
      text: "- result: SG CORE INTERNAL READ-ONLY ALLOWED",
      kind: "sg_core_internal_read_allowed",
    };
  }

  if (routeKey === "sg_core_internal_read_denied") {
    return {
      text: "- result: SG CORE INTERNAL READ-ONLY DENIED",
      kind: "sg_core_internal_read_denied",
    };
  }

  if (
    routeKey === "user_project_read" ||
    routeKey === "user_project_write" ||
    routeKey === "user_project_mixed" ||
    routeKey === "user_project_unknown"
  ) {
    return {
      text: "- result: USER PROJECT PATH",
      kind: "user_project",
    };
  }

  if (
    routeKey === "generic_external_read" ||
    routeKey === "generic_external_write" ||
    routeKey === "generic_external_mixed" ||
    routeKey === "generic_external_unknown"
  ) {
    return {
      text: "- result: GENERIC EXTERNAL PATH",
      kind: "generic_external",
    };
  }

  return {
    text: "- result: UNKNOWN",
    kind: "unknown",
  };
}

export default {
  buildProjectIntentRoutePreview,
};