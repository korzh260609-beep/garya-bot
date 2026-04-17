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

export async function collectRealEvidence({
  scopeWorkflowItems,
  evaluationCtx,
} = {}) {
  const scopeSemanticProfile = buildScopeSemanticProfile(scopeWorkflowItems);
  const scopeStats = buildScopeStats(scopeWorkflowItems);

  const entrypoints = await discoverEntrypoints(evaluationCtx);

  const candidateFiles = collectCandidateFilesFromScope(
    scopeWorkflowItems,
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
  });

  const domainEvidence = await collectDomainEvidence({
    evaluationCtx,
    scopeSemanticProfile,
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
