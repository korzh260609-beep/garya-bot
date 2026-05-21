// src/memory/index.js
// SG 2.0 — Memory Public Boundary
//
// Purpose:
// - Provide one stable import surface for SG memory/context modules.
// - Prevent chaotic direct imports from internal memory subfolders.
// - Keep this file dependency-light and deterministic.
//
// Hard rules:
// - Do not add DB access here.
// - Do not add Telegram or transport logic here.
// - Do not add AI provider/model calls here.
// - Do not add source fetching here.
// - Do not turn this file into MemoryService monolith.
// - Runtime integration must happen later through Core Orchestrator -> Memory/Context -> AI Layer.

export {
  CONTEXT_PACK_VERSION,
  CONTEXT_ITEM_TYPES,
  CONTEXT_SOURCE_PRIORITIES,
  CONTEXT_TRUST_LEVELS,
  createEmptyContextPack,
  createContextItem,
} from "./context/contextTypes.js";

export { buildContextPack } from "./context/contextPackBuilder.js";

export {
  CONTEXT_PROMPT_FORMAT_VERSION,
  DEFAULT_CONTEXT_PROMPT_FORMAT_LIMITS,
  formatContextPackForPrompt,
} from "./context/contextPackPromptFormatter.js";

export {
  PROJECT_MEMORY_VERSION,
  PROJECT_MEMORY_TYPES,
  PROJECT_MEMORY_SCOPES,
  PROJECT_MEMORY_TRUST,
  PROJECT_MEMORY_SOURCE_TYPES,
  createProjectMemoryItem,
} from "./project/projectMemoryTypes.js";

export {
  PROJECT_MEMORY_OWNERSHIP_VERSION,
  PROJECT_MEMORY_OWNER_TYPES,
  PROJECT_MEMORY_VISIBILITY,
  SG_PROJECT_MEMORY_KEY,
  buildSgProjectMemoryRef,
  buildUserProjectMemoryKey,
  buildUserProjectMemoryRef,
  parseProjectMemoryKey,
  canReadProjectMemory,
  canWriteProjectMemoryCandidate,
} from "./project/projectMemoryOwnership.js";

export { ProjectMemoryService } from "./project/projectMemoryService.js";

export {
  PROJECT_MEMORY_SCHEMA_VERSION,
  PROJECT_MEMORY_TABLES,
  getProjectMemorySchemaSql,
  createProjectMemorySchema,
  ensureProjectMemorySchema,
} from "./project/projectMemorySchema.js";

export { ProjectMemoryStore } from "./project/projectMemoryStore.js";

export {
  PROJECT_MEMORY_CONFIRMATION_VERSION,
  PROJECT_MEMORY_CONFIRMATION_MODES,
  PROJECT_MEMORY_CONFIRMATION_DECISIONS,
  ProjectMemoryConfirmation,
} from "./project/projectMemoryConfirmation.js";

export {
  PROJECT_MEMORY_CONFIRMED_READ_FLOW_VERSION,
  PROJECT_MEMORY_CONFIRMED_READ_FLOW_MODES,
  PROJECT_MEMORY_CONFIRMED_READ_FLOW_DECISIONS,
  buildProjectMemoryConfirmedReadFlowStatus,
  getProjectMemoryConfirmedReadFlowBoundaries,
  readConfirmedProjectMemoryContext,
} from "./project/projectMemoryConfirmedReadFlow.js";

export {
  PROJECT_MEMORY_EXPLICIT_CONFIRMATION_FLOW_VERSION,
  PROJECT_MEMORY_EXPLICIT_CONFIRMATION_FLOW_MODES,
  PROJECT_MEMORY_EXPLICIT_CONFIRMATION_FLOW_DECISIONS,
  buildProjectMemoryExplicitConfirmationFlowStatus,
  getProjectMemoryExplicitConfirmationFlowBoundaries,
  confirmExplicitProjectMemoryCandidate,
} from "./project/projectMemoryExplicitConfirmationFlow.js";

export {
  PROJECT_MEMORY_TRUSTED_CONFIRMATION_FLOW_VERSION,
  PROJECT_MEMORY_TRUSTED_CONFIRMATION_FLOW_MODES,
  PROJECT_MEMORY_TRUSTED_CONFIRMATION_DECISIONS,
  buildProjectMemoryTrustedConfirmationFlowStatus,
  getProjectMemoryTrustedConfirmationFlowBoundaries,
  confirmTrustedProjectMemoryCandidate,
} from "./project/projectMemoryTrustedConfirmationFlow.js";

export {
  PROJECT_MEMORY_MANUAL_CANDIDATE_FLOW_VERSION,
  PROJECT_MEMORY_MANUAL_CANDIDATE_FLOW_MODES,
  PROJECT_MEMORY_MANUAL_CANDIDATE_FLOW_DECISIONS,
  buildProjectMemoryManualCandidateFlowStatus,
  getProjectMemoryManualCandidateFlowBoundaries,
  prepareManualProjectMemoryCandidate,
} from "./project/projectMemoryManualCandidateFlow.js";

export {
  PROJECT_MEMORY_AUTOMATIC_CANDIDATE_PIPELINE_VERSION,
  PROJECT_MEMORY_AUTOMATIC_CANDIDATE_PIPELINE_MODES,
  PROJECT_MEMORY_AUTOMATIC_CANDIDATE_EVENT_TYPES,
  PROJECT_MEMORY_AUTOMATIC_CANDIDATE_DECISIONS,
  buildProjectMemoryAutomaticCandidatePipelineStatus,
  getProjectMemoryAutomaticCandidatePipelineBoundaries,
  prepareProjectMemoryCandidateFromEvent,
} from "./project/projectMemoryAutomaticCandidatePipeline.js";

export {
  PROJECT_MEMORY_AUTOMATIC_DURABLE_CANDIDATE_FLOW_VERSION,
  PROJECT_MEMORY_AUTOMATIC_DURABLE_CANDIDATE_FLOW_MODES,
  PROJECT_MEMORY_AUTOMATIC_DURABLE_CANDIDATE_DECISIONS,
  buildProjectMemoryAutomaticDurableCandidateFlowStatus,
  getProjectMemoryAutomaticDurableCandidateFlowBoundaries,
  createDurableProjectMemoryCandidateFromEvent,
} from "./project/projectMemoryAutomaticDurableCandidateFlow.js";

export {
  PROJECT_MEMORY_AUTOMATIC_ORCHESTRATOR_VERSION,
  PROJECT_MEMORY_AUTOMATIC_ORCHESTRATOR_MODES,
  PROJECT_MEMORY_AUTOMATIC_ORCHESTRATOR_DECISIONS,
  buildProjectMemoryAutomaticOrchestratorStatus,
  getProjectMemoryAutomaticOrchestratorBoundaries,
  processProjectMemoryAutomaticEvent,
} from "./project/projectMemoryAutomaticOrchestrator.js";

export {
  PROJECT_MEMORY_TRUSTED_EVENT_SOURCE_VERSION,
  PROJECT_MEMORY_TRUSTED_EVENT_SOURCE_MODES,
  PROJECT_MEMORY_TRUSTED_EVENT_SOURCE_KINDS,
  PROJECT_MEMORY_TRUSTED_EVENT_SOURCE_DECISIONS,
  buildProjectMemoryTrustedEventSourceStatus,
  getProjectMemoryTrustedEventSourceBoundaries,
  normalizeTrustedProjectEvent,
  createTrustedProjectEventForPrMerged,
  createTrustedProjectEventForRenderDeployEvidence,
} from "./project/projectMemoryTrustedEventSource.js";

export {
  PROJECT_MEMORY_AUTO_CONFIRMATION_POLICY_VERSION,
  PROJECT_MEMORY_AUTO_CONFIRMATION_POLICY_MODES,
  PROJECT_MEMORY_AUTO_CONFIRMATION_SOURCE_KINDS,
  PROJECT_MEMORY_AUTO_CONFIRMATION_DECISIONS,
  PROJECT_MEMORY_AUTO_CONFIRMATION_DENY_REASONS,
  buildProjectMemoryAutoConfirmationPolicyStatus,
  getProjectMemoryAutoConfirmationPolicyBoundaries,
  evaluateProjectMemoryAutoConfirmation,
} from "./project/projectMemoryAutoConfirmationPolicy.js";

export {
  PROJECT_MEMORY_TRUSTED_EVENT_SOURCE_ORCHESTRATOR_BRIDGE_VERSION,
  PROJECT_MEMORY_TRUSTED_EVENT_SOURCE_ORCHESTRATOR_BRIDGE_MODES,
  PROJECT_MEMORY_TRUSTED_EVENT_SOURCE_ORCHESTRATOR_BRIDGE_DECISIONS,
  buildProjectMemoryTrustedEventSourceOrchestratorBridgeStatus,
  getProjectMemoryTrustedEventSourceOrchestratorBridgeBoundaries,
  processTrustedEventSourceOutputThroughOrchestrator,
} from "./project/projectMemoryTrustedEventSourceOrchestratorBridge.js";

export {
  PROJECT_MEMORY_RUNTIME_TRUSTED_EVENT_TOOL_VERSION,
  PROJECT_MEMORY_RUNTIME_TRUSTED_EVENT_TOOL_MODES,
  PROJECT_MEMORY_RUNTIME_TRUSTED_EVENT_TOOL_DECISIONS,
  buildProjectMemoryRuntimeTrustedEventToolStatus,
  getProjectMemoryRuntimeTrustedEventToolBoundaries,
  runProjectMemoryRuntimeTrustedEventTool,
} from "./project/projectMemoryRuntimeTrustedEventTool.js";

export {
  PROJECT_MEMORY_RUNTIME_CONTEXT_VERSION,
  PROJECT_MEMORY_RUNTIME_CONTEXT_MODES,
  PROJECT_MEMORY_RUNTIME_CONTEXT_DEFAULT_LIMITS,
  ProjectMemoryRuntimeContext,
  createProjectMemoryRuntimeContext,
} from "./project/projectMemoryRuntimeContext.js";

export {
  PROJECT_MEMORY_CONFLICT_STALE_DETECTOR_VERSION,
  PROJECT_MEMORY_CONFLICT_STALE_DETECTOR_MODES,
  PROJECT_MEMORY_CONFLICT_STALE_DETECTOR_DECISIONS,
  PROJECT_MEMORY_CONFLICT_STALE_LABELS,
  buildProjectMemoryConflictStaleDetectorStatus,
  getProjectMemoryConflictStaleDetectorBoundaries,
  detectProjectMemoryConflictsAndStaleness,
} from "./project/projectMemoryConflictStaleDetector.js";

export {
  PROJECT_MEMORY_SOURCE_SYNC_INTERFACE_VERSION,
  PROJECT_MEMORY_SOURCE_SYNC_INTERFACE_MODES,
  PROJECT_MEMORY_SOURCE_SYNC_INTERFACE_DECISIONS,
  PROJECT_MEMORY_SOURCE_SYNC_SOURCE_TYPES,
  buildProjectMemorySourceSyncInterfaceStatus,
  getProjectMemorySourceSyncInterfaceBoundaries,
  prepareProjectMemorySourceSync,
} from "./project/projectMemorySourceSyncInterface.js";

export {
  PROJECT_MEMORY_DIAGNOSTICS_VERSION,
  PROJECT_MEMORY_DIAGNOSTICS_MODES,
  PROJECT_MEMORY_DIAGNOSTICS_DECISIONS,
  PROJECT_MEMORY_DIAGNOSTIC_FAMILIES,
  PROJECT_MEMORY_DIAGNOSTIC_EVIDENCE_LEVELS,
  buildProjectMemoryDiagnosticsStatus,
  getProjectMemoryDiagnosticsBoundaries,
  buildProjectMemoryDiagnostics,
} from "./project/projectMemoryDiagnostics.js";

export {
  PROJECT_MEMORY_EXPERIENCE_LESSONS_VERSION,
  PROJECT_MEMORY_EXPERIENCE_LESSONS_MODES,
  PROJECT_MEMORY_EXPERIENCE_LESSONS_DECISIONS,
  PROJECT_MEMORY_EXPERIENCE_LESSON_TYPES,
  PROJECT_MEMORY_EXPERIENCE_LESSON_REVIEW_STATES,
  buildProjectMemoryExperienceLessonsStatus,
  getProjectMemoryExperienceLessonsBoundaries,
  prepareProjectMemoryExperienceLessons,
} from "./project/projectMemoryExperienceLessons.js";

export {
  PROJECT_MEMORY_USER_PROJECT_VALIDATOR_VERSION,
  PROJECT_MEMORY_USER_PROJECT_VALIDATOR_MODES,
  ProjectMemoryUserProjectValidator,
  createProjectMemoryUserProjectValidator,
} from "./project/projectMemoryUserProjectValidator.js";

export {
  MEMORY_CONTRACT_VERSION,
  MEMORY_ACTION_CLASSES,
  MEMORY_SCOPES,
  MEMORY_OWNER_TYPES,
  MEMORY_TRANSPORT_TYPES,
  MEMORY_SOURCE_PRIORITIES,
  MEMORY_FAILURE_MODES,
  MEMORY_PRIVACY_LEVELS,
  createMemoryRequestContract,
  createMemoryResultContract,
  createMemoryOwnershipContract,
  getMemoryContractPolicy,
} from "./contracts.js";

export {
  RAW_PROMPT_POLICY_VERSION,
  getRawPromptPolicy,
  assertRawPromptAllowed,
} from "./policies/rawPromptPolicy.js";

export {
  PROJECT_MEMORY_POLICY_VERSION,
  getProjectMemoryPolicy,
  assertProjectMemoryCandidateAllowed,
} from "./policies/projectMemoryPolicy.js";

export {
  CONFIRMED_MEMORY_POLICY_VERSION,
  getConfirmedMemoryPolicy,
  assertConfirmedMemoryAllowed,
} from "./policies/confirmedMemoryPolicy.js";

export {
  GROUP_MEMORY_POLICY_VERSION,
  getGroupMemoryPolicy,
  assertGroupMemoryAllowed,
} from "./policies/groupMemoryPolicy.js";

export function getMemoryModuleStatus() {
  return {
    ok: true,
    module: "memory",
    status: "public_boundary_ready",
    runtimeConnected: false,
    hasDb: false,
    hasStorageBoundary: true,
    hasDurableProjectMemoryConfirmationBoundary: true,
    hasProjectMemoryConfirmedReadFlow: true,
    hasProjectMemoryExplicitConfirmationFlow: true,
    hasProjectMemoryManualCandidateFlow: true,
    hasProjectMemoryAutomaticCandidatePipeline: true,
    hasProjectMemoryAutomaticTrustedEventSource: true,
    hasProjectMemoryAutoConfirmationPolicy: true,
    hasProjectMemoryTrustedEventSourceOrchestratorBridge: true,
    hasProjectMemoryRuntimeTrustedEventTool: true,
    hasProjectMemoryRuntimeReadBridge: true,
    hasProjectMemoryConflictStaleDetector: true,
    hasProjectMemorySourceSyncInterface: true,
    hasProjectMemoryDiagnostics: true,
    hasProjectMemoryExperienceLessons: true,
    hasProjectMemoryOwnershipBoundary: true,
    hasProjectMemoryUserProjectValidator: true,
    hasRenderDeployEvidenceTrustedPath: true,
    hasTransportLogic: false,
    hasAICalls: false,
    hasSourceFetching: false,
    principles: {
      sourceFirst: true,
      transportIndependent: true,
      telegramIsDeliveryOnly: true,
      globalUserIdOwnsUnifiedUserMemory: true,
      oneUserMayOwnManyProjects: true,
      projectMemorySeparatesSgAndUserProjects: true,
      memorySupportsLivingSg: true,
      memoryIsNotCommandRouter: true,
      memoryIsNotTechnicalMode: true,
      durableProjectMemoryRequiresConfirmation: true,
      projectMemoryAutoWriteDisabled: true,
      projectMemoryAutomaticCandidatePrepareOnly: true,
      projectMemoryAutomaticTrustedEventSourceNormalizesOnly: true,
      projectMemoryAutoConfirmationPolicyPureEvaluationOnly: true,
      projectMemoryTrustedEventSourceOrchestratorBridgePolicyGatedAutoConfirm: true,
      projectMemoryRuntimeTrustedEventToolPolicyGatedAutoConfirm: true,
      projectMemoryRenderDeployEvidenceTrustedAutoConfirmPath: true,
      projectMemoryConflictStaleDetectorProvidedInputOnly: true,
      projectMemoryConflictStaleDetectorNoWrites: true,
      projectMemorySourceSyncInterfaceProvidedSourcesOnly: true,
      projectMemorySourceSyncInterfaceCandidatesOnly: true,
      projectMemoryDiagnosticsProvidedSnapshotOnly: true,
      projectMemoryDiagnosticsSanitizedOnly: true,
      projectMemoryExperienceLessonsProvidedLessonsOnly: true,
      projectMemoryExperienceLessonsCandidatesOnly: true,
      projectMemoryManualCandidateOnly: true,
      projectMemoryExplicitConfirmationOnly: true,
      projectMemoryConfirmedReadOnly: true,
      projectMemoryRuntimeReadConfirmedOnly: true,
    },
  };
}

export default {
  getMemoryModuleStatus,
};