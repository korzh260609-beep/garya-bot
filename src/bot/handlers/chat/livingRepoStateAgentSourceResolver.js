// src/bot/handlers/chat/livingRepoStateAgentSourceResolver.js
// ============================================================================
// Living RepoStateAgent Source Resolver
//
// Purpose:
// - keep RepoStateAgent source-result runtime wiring out of generic sourceFlow;
// - run RepoStateAgent only through the approved Living SG read-only path;
// - adapt fastReadOnly result into providerResult and sourceResultEnvelope.
//
// Hard boundaries:
// - read-only only;
// - require fresh project map;
// - no repository writes;
// - no write authorization;
// - no executor;
// - no direct scan call;
// - no forced AI analysis;
// - no slash-command routing;
// - no Technical Mode expansion.
// ============================================================================

import {
  adaptLivingRepoSourceProviderResult,
} from "../../../core/living-sg/LivingRepoSourceProviderResultAdapter.js";
import {
  adaptRepoStateAgentResultToLivingProviderResult,
} from "../../../core/living-sg/LivingRepoStateAgentProviderResult.js";
import { RepoStateAgentService } from "../../../simpleAgents/repoStateAgent/RepoStateAgentService.js";

export function shouldUseLivingRepoStateAgentProvider(livingSGPlan = null) {
  return (
    livingSGPlan?.intentPlan?.intentKind === "project_thinking" &&
    livingSGPlan?.capabilityPlan?.actionType === "read_only" &&
    livingSGPlan?.gate?.canExecute === true &&
    livingSGPlan?.gate?.canChangeState === false
  );
}

export async function resolveLivingRepoStateAgentEnvelope({ livingSGPlan = null } = {}) {
  if (!shouldUseLivingRepoStateAgentProvider(livingSGPlan)) {
    return {
      sourceResultEnvelope: null,
      repoStateAgentResult: null,
      repoStateAgentProviderAdapterResult: null,
      repoStateAgentEnvelopeAdapterResult: null,
      evidenceMode: "missing_source_result_evidence",
      reason: "living_repo_state_agent_provider_not_requested",
    };
  }

  try {
    const service = new RepoStateAgentService();
    const repoStateAgentResult = await service.run({
      fastReadOnly: true,
      requireFreshProjectMap: true,
      repoFullName: "korzh260609-beep/garya-bot",
      branch: "main",
      triggerType: "living_sg_source_flow",
      triggerMetadata: {
        source: "chat_source_flow",
        readOnly: true,
      },
    });

    const repoStateAgentProviderAdapterResult = adaptRepoStateAgentResultToLivingProviderResult({
      repoStateAgentResult,
      repository: "korzh260609-beep/garya-bot",
      ref: "main",
      scope: "repo_state_agent_project_map",
    });

    const repoStateAgentEnvelopeAdapterResult = adaptLivingRepoSourceProviderResult({
      providerKind: repoStateAgentProviderAdapterResult.providerKind,
      providerResult: repoStateAgentProviderAdapterResult.providerResult,
    });

    const sourceResultEnvelope = repoStateAgentEnvelopeAdapterResult?.ok === true
      ? repoStateAgentEnvelopeAdapterResult.sourceResultEnvelope
      : null;

    return {
      sourceResultEnvelope,
      repoStateAgentResult,
      repoStateAgentProviderAdapterResult,
      repoStateAgentEnvelopeAdapterResult,
      evidenceMode: sourceResultEnvelope
        ? "repo_state_agent_source_result_envelope"
        : "repo_state_agent_source_result_unverified",
      reason: sourceResultEnvelope
        ? "repo_state_agent_fast_read_only_envelope_confirmed"
        : "repo_state_agent_fast_read_only_envelope_unverified",
    };
  } catch (e) {
    console.error("ERROR living RepoStateAgent source flow failed (fail-open):", e);
    return {
      sourceResultEnvelope: null,
      repoStateAgentResult: null,
      repoStateAgentProviderAdapterResult: null,
      repoStateAgentEnvelopeAdapterResult: null,
      evidenceMode: "repo_state_agent_source_result_failed",
      reason: "repo_state_agent_fast_read_only_failed_open",
      error: e?.message || "unknown_error",
    };
  }
}

export default {
  shouldUseLivingRepoStateAgentProvider,
  resolveLivingRepoStateAgentEnvelope,
};
