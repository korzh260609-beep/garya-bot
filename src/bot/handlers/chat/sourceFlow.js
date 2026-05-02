// src/bot/handlers/chat/sourceFlow.js

import {
  resolveSourceContext,
  buildSourceServiceDebugBlock,
} from "../../../sources/sourceService.js";
import {
  adaptLegacySourceResultToEnvelope,
} from "../../../core/living-sg/LivingSourceResultEnvelopeAdapter.js";
import {
  adaptLivingRepoSourceProviderResult,
} from "../../../core/living-sg/LivingRepoSourceProviderResultAdapter.js";
import {
  adaptRepoStateAgentResultToLivingProviderResult,
} from "../../../core/living-sg/LivingRepoStateAgentProviderResult.js";
import { RepoStateAgentService } from "../../../simpleAgents/repoStateAgent/RepoStateAgentService.js";

function shouldUseLivingRepoStateAgentProvider(livingSGPlan = null) {
  return (
    livingSGPlan?.intentPlan?.intentKind === "project_thinking" &&
    livingSGPlan?.capabilityPlan?.actionType === "read_only" &&
    livingSGPlan?.gate?.canExecute === true &&
    livingSGPlan?.gate?.canChangeState === false
  );
}

async function resolveLivingRepoStateAgentEnvelope({ livingSGPlan = null } = {}) {
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

export async function resolveChatSourceFlow({ effective, livingSGPlan = null } = {}) {
  let sourceCtx = null;
  let sourceServiceDebugBlock = "";

  try {
    sourceCtx = await resolveSourceContext({
      text: effective,
      sourceResult: null,
      sourceKey: null,
      requireSource: false,
      allowedSourceKeys: [],
    });

    sourceServiceDebugBlock = buildSourceServiceDebugBlock({
      text: effective,
      sourceResult: null,
      sourceKey: null,
      requireSource: false,
      allowedSourceKeys: [],
    });
  } catch (e) {
    console.error("ERROR sourceService resolve failed (fail-open):", e);
    sourceCtx = {
      version: "10.6-skeleton-v1",
      ok: false,
      usedExistingSourceResult: false,
      shouldUseSourceResult: false,
      shouldRequireSourceResult: false,
      sourceRuntime: {
        decision: "skip",
        needsSource: false,
        reason: "source_service_fail_open",
      },
      sourcePlan: {
        decision: "noop",
        reason: "source_service_fail_open",
      },
      sourceResult: {
        ok: false,
        sourceKey: null,
        content: "",
        fetchedAt: null,
        meta: {
          reason: "source_service_fail_open",
        },
      },
      reason: "source_service_fail_open",
    };

    sourceServiceDebugBlock = [
      "SOURCE SERVICE:",
      "- version: 10.6-skeleton-v1",
      "- decision: noop",
      "- should_fetch: false",
      "- source_definition_found: false",
      "- source_definition_key: none",
      "- runtime_decision: skip",
      "- runtime_needs_source: false",
      "- reason: source_service_fail_open",
    ].join("\n");
  }

  const sourceContextText =
    sourceCtx?.shouldUseSourceResult === true &&
    sourceCtx?.sourceResult?.ok === true &&
    typeof sourceCtx?.sourceResult?.content === "string" &&
    sourceCtx.sourceResult.content.trim()
      ? sourceCtx.sourceResult.content.trim()
      : "";

  const sourceResultEnvelopeAdapterResult = adaptLegacySourceResultToEnvelope({
    sourceCtx,
  });

  const legacySourceResultEnvelope =
    sourceResultEnvelopeAdapterResult?.ok === true
      ? sourceResultEnvelopeAdapterResult.sourceResultEnvelope
      : null;

  const livingRepoStateAgentSource = await resolveLivingRepoStateAgentEnvelope({
    livingSGPlan,
  });

  const sourceResultEnvelope =
    livingRepoStateAgentSource.sourceResultEnvelope || legacySourceResultEnvelope;

  const legacySourceResultSystemMessage = sourceContextText
    ? {
        role: "system",
        content:
          "SOURCE RESULT:\n" +
          `- source_key: ${sourceCtx?.sourceResult?.sourceKey || "unknown"}\n` +
          `- fetched_at: ${sourceCtx?.sourceResult?.fetchedAt || "unknown"}\n` +
          "- use as runtime factual context when relevant\n\n" +
          `${sourceContextText}`,
      }
    : null;

  const sourceResultSystemMessage = sourceResultEnvelope
    ? null
    : legacySourceResultSystemMessage;

  const sourceResultEvidenceMode = sourceResultEnvelope
    ? livingRepoStateAgentSource.sourceResultEnvelope
      ? "repo_state_agent_source_result_envelope"
      : "source_result_envelope"
    : legacySourceResultSystemMessage
      ? "legacy_source_result_system_message"
      : livingRepoStateAgentSource.evidenceMode || "missing_source_result_evidence";

  const sourceServiceSystemMessage =
    sourceServiceDebugBlock && String(sourceServiceDebugBlock).trim()
      ? {
          role: "system",
          content:
            `${sourceServiceDebugBlock}\n\n` +
            "SOURCE RULE:\n" +
            "- use factual source data only when SOURCE RESULT exists\n" +
            "- if source was skipped or failed, do not pretend it was used",
        }
      : null;

  return {
    sourceCtx,
    sourceServiceDebugBlock,
    sourceContextText,
    sourceResultEnvelope,
    sourceResultEnvelopeAdapterResult,
    sourceResultEvidenceMode,
    sourceResultSystemMessage,
    legacySourceResultSystemMessage,
    livingRepoStateAgentSource,
    sourceServiceSystemMessage,
  };
}
