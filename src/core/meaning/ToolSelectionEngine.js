// src/core/meaning/ToolSelectionEngine.js
// ============================================================================
// CORE MEANING — Tool Selection Engine (SKELETON / DRY-RUN)
// Purpose:
// - choose candidate tools/modules from structured meaning, not from hardcoded replies
// - keep execution separate from planning
// - allow SG to understand what should be used before acting
// IMPORTANT:
// - NO DB writes
// - NO external calls
// - NO tool execution
// - NO hardcoded user replies
// ============================================================================

function safeText(value) {
  return String(value ?? "").trim();
}

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

export const TOOL_SELECTION_STATUS = Object.freeze({
  READY: "ready",
  CLARIFY: "clarify",
  NO_TOOL: "no_tool",
  BLOCKED: "blocked",
});

export class ToolSelectionEngine {
  select({ meaning = {} } = {}) {
    const suggestedAction = safeText(meaning?.suggestedAction);
    const domain = safeText(meaning?.domain);
    const intent = safeText(meaning?.intent);

    if (suggestedAction === "clarify") {
      return {
        ok: true,
        dryRun: true,
        source: "ToolSelectionEngine",
        status: TOOL_SELECTION_STATUS.CLARIFY,
        selectedTools: [],
        reasons: ["meaning_requires_clarification"],
      };
    }

    if (domain !== "project") {
      return {
        ok: true,
        dryRun: true,
        source: "ToolSelectionEngine",
        status: TOOL_SELECTION_STATUS.NO_TOOL,
        selectedTools: [],
        reasons: ["non_project_domain"],
      };
    }

    if (intent === "inspect_project_stage") {
      return {
        ok: true,
        dryRun: true,
        source: "ToolSelectionEngine",
        status: TOOL_SELECTION_STATUS.READY,
        selectedTools: [
          {
            tool: "project_context_engine",
            mode: "stage_inspection",
            requiredInputs: ["stage_id"],
            extractedInputs: {
              stageId: meaning?.extracted?.stageId || null,
            },
          },
          {
            tool: "project_evidence_pipeline",
            mode: "light_evidence_pack",
            requiredInputs: ["project_context_decision"],
            extractedInputs: {},
          },
        ],
        reasons: ["inspect_project_stage_intent"],
      };
    }

    if (ensureArray(meaning?.toolHints).length > 0) {
      return {
        ok: true,
        dryRun: true,
        source: "ToolSelectionEngine",
        status: TOOL_SELECTION_STATUS.READY,
        selectedTools: ensureArray(meaning.toolHints).map((tool) => ({
          tool: safeText(tool),
          mode: "hinted_by_meaning",
          requiredInputs: [],
          extractedInputs: {},
        })),
        reasons: ["meaning_tool_hints_present"],
      };
    }

    return {
      ok: true,
      dryRun: true,
      source: "ToolSelectionEngine",
      status: TOOL_SELECTION_STATUS.NO_TOOL,
      selectedTools: [],
      reasons: ["no_matching_tool_for_meaning"],
    };
  }
}

export function selectToolsForMeaning(input = {}) {
  return new ToolSelectionEngine().select(input);
}

export default {
  TOOL_SELECTION_STATUS,
  ToolSelectionEngine,
  selectToolsForMeaning,
};
