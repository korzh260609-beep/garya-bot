// ============================================================================
// === src/core/stageCheck/real/realEvidenceCollector.js
// === universal real-evidence collector orchestrator
// ============================================================================

import { buildRealConnectedness } from "./realConnectedness.js";
import { discoverEntrypoints } from "./realEntrypoints.js";
import {
  collectCandidateFilesFromScope,
  findDirectEntrypointMatches,
  findRepoReferenceMatches,
  buildRealEvidence,
} from "./realCandidates.js";
import {
  buildScopeSemanticProfile,
  buildScopeStats,
} from "./realScopeProfile.js";
import { collectRuntimeFoundationEvidence } from "./realRuntimeFoundation.js";
import { collectDomainEvidence } from "./realDomainEvidence.js";
import { resolveRealNodeProfile } from "./realNodeProfileResolver.js";

export async function collectRealEvidence({
  scopeWorkflowItems,
  evaluationCtx,
} = {}) {
  const normalizedScopeItems = Array.isArray(scopeWorkflowItems)
    ? scopeWorkflowItems
    : [];

  const scopeSemanticProfile = buildScopeSemanticProfile(normalizedScopeItems);
  const scopeStats = buildScopeStats(normalizedScopeItems);
  const nodeProfile = resolveRealNodeProfile({
    scopeWorkflowItems: normalizedScopeItems,
    scopeSemanticProfile,
  });

  const entrypoints = await discoverEntrypoints(evaluationCtx);

  const candidateFiles = collectCandidateFilesFromScope(
    normalizedScopeItems,
    evaluationCtx
  );

  const directEntrypointMatches = await findDirectEntrypointMatches({
    entrypoints,
    candidateFiles,
    evaluationCtx,
  });

  const repoReferenceMatches = await findRepoReferenceMatches({
    candidateFiles,
    evaluationCtx,
  });

  const connectedness = buildRealConnectedness({
    entrypoints,
    candidateFiles,
    directEntrypointMatches,
    repoReferenceMatches,
  });

  const runtimeFoundationEvidence = await collectRuntimeFoundationEvidence({
    evaluationCtx,
    scopeSemanticProfile,
    scopeWorkflowItems: normalizedScopeItems,
    nodeProfile,
  });

  const domainEvidence = await collectDomainEvidence({
    evaluationCtx,
    scopeSemanticProfile,
    scopeWorkflowItems: normalizedScopeItems,
    nodeProfile,
  });

  const evidence = buildRealEvidence({
    candidateFiles,
    connectedness,
    runtimeFoundationEvidence,
    domainEvidence,
  });

  return {
    scopeSemanticProfile,
    scopeStats,
    nodeProfile,
    entrypoints,
    candidateFiles,
    directEntrypointMatches,
    repoReferenceMatches,
    connectedness,
    runtimeFoundationEvidence,
    domainEvidence,
    evidence,
  };
}

export default {
  collectRealEvidence,
};