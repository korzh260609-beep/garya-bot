import {
  normalizeLowercaseStringOrEmpty,
  normalizeOptionalString,
} from "@openclaw/normalization-core/string-coerce";
import {
  resolveAgentConfig,
  resolveAgentWorkspaceDir,
  resolveSessionAgentId,
} from "../../agents/agent-scope.js";
import { normalizeExplicitSessionKey } from "../../config/sessions/explicit-session-key-normalization.js";
import {
  deriveInboundMessageHookContext,
  toPluginInboundClaimPair,
} from "../../hooks/message-hook-mappers.js";
import { isDiagnosticsEnabled } from "../../infra/diagnostic-events.js";
import { measureDiagnosticsTimelineSpan } from "../../infra/diagnostics-timeline.js";
import {
  logMessageDispatchCompleted,
  logMessageDispatchStarted,
  markDiagnosticSessionProgress,
} from "../../logging/diagnostic.js";
import { createDiagnosticMessageLifecycle } from "../../logging/message-lifecycle.js";
import { stripLegacyMediaContextFields } from "../../media/media-facts.js";
import { getGlobalHookRunner } from "../../plugins/hook-runner-global.js";
import { resolveSgIdentityContext } from "../../sg/global-profile.js";
import { normalizeTtsAutoMode } from "../../tts/tts-config.js";
import { resolveCommandAuthorization } from "../command-auth.js";
import type { FinalizedRuntimeMsgContext as FinalizedMsgContext } from "../templating.js";
import { normalizeVerboseLevel } from "../thinking.js";
import type {
  DispatchProcessedOptions,
  DispatchProcessedOutcome,
  InboundMessageAuditTerminalRecorder,
} from "./dispatch-from-config.audit.js";
import {
  resolveBoundAcpDispatchSessionKey,
  resolveSessionStoreLookup,
} from "./dispatch-from-config.context.js";
import { createShouldEmitVerboseProgress } from "./dispatch-from-config.harness-defaults.js";
import { createDispatchReplyOperationCoordinator } from "./dispatch-from-config.lifecycle.js";
import { createFinalizationAwareTtsPayloadApplier } from "./dispatch-from-config.payloads.js";
import { extendPreparedDispatchState } from "./dispatch-from-config.phase-state.js";
import {
  loadPreparedModelRuntime,
  loadRuntimePlugins,
} from "./dispatch-from-config.runtime-loaders.js";
import { createReplyHotPathTimingTracker } from "./dispatch-from-config.timing.js";
import type { DispatchFromConfigParams } from "./dispatch-from-config.types.js";
import { noteDispatchProcessedOutcome } from "./dispatch-processed-outcome.js";
import { resolveEffectiveReplyRoute } from "./effective-reply-route.js";
import type { ReplySessionBinding } from "./get-reply.types.js";
import { finalizeInboundContext, isFinalizedInboundContext } from "./inbound-context.js";
import { hasInboundAudio } from "./inbound-media.js";
import {
  resolveReplyOperationRunState,
  type ReplyOperationRunState,
} from "./reply-operation-run-state.js";
import { replyRunRegistry } from "./reply-run-registry.js";
import { isReplyProfilerEnabled } from "./reply-timing-tracker.js";
import { resolveRoutedDeliveryThreadId } from "./routed-delivery-thread.js";
import { stageRemoteInboundMediaIfNeeded } from "./stage-remote-inbound-media.js";

export async function gatherDispatchRequest(
  params: DispatchFromConfigParams,
  messageAuditTerminal: InboundMessageAuditTerminalRecorder | undefined,
) {
  const ctx = isFinalizedInboundContext(params.ctx)
    ? params.ctx
    : finalizeInboundContext(params.ctx);
  if (!ctx.Sg) {
    const channel = normalizeLowercaseStringOrEmpty(ctx.Surface ?? ctx.Provider ?? "");
    const senderId = normalizeOptionalString(ctx.SenderId ?? ctx.From);
    if (channel && senderId) {
      try {
        const senderIsOwner = resolveCommandAuthorization({
          ctx,
          cfg: params.cfg,
          commandAuthorized: ctx.CommandAuthorized === true,
        }).senderIsOwner;
        ctx.Sg = await resolveSgIdentityContext({
          channel,
          senderId,
          identityLinks: params.cfg.session?.identityLinks,
          senderIsOwner,
        });
      } catch (error) {
        if (!(error instanceof Error) || !error.message.startsWith("sg-global-profile-store-invalid")) {
          throw error;
        }
        // SG identity is prompt metadata, not an authorization owner. A bad
        // profile artifact must not suppress the transport's normal reply path.
        console.error(`[sg] global profile unavailable; continuing dispatch: ${error.message}`);
      }
    }
  }
  const turnAdoptionLifecycle = params.replyOptions?.turnAdoptionLifecycle;
  const turnAdoptionState = { adopted: false };
  const normalizedParams: DispatchFromConfigParams = {
    ...params,
    ctx,
    replyOptions: {
      ...params.replyOptions,
      ...(turnAdoptionLifecycle
        ? {
            turnAdoptionLifecycle: {
              ...turnAdoptionLifecycle,
              onAdopted: async () => {
                // The upstream owner is durable only after its callback commits.
                // A rejected callback must leave replay dedupe releasable.
                await turnAdoptionLifecycle.onAdopted();
                turnAdoptionState.adopted = true;
              },
            },
          }
        : {}),
    },
  };
  const state = {
    params: normalizedParams,
    messageAuditTerminal,
    inboundDedupeReplayUnsafe: false,
    turnAdoptionState: turnAdoptionLifecycle ? turnAdoptionState : undefined,
  };
  const { cfg, dispatcher } = normalizedParams;
  const replyOperationRunState: ReplyOperationRunState =
    resolveReplyOperationRunState(normalizedParams.replyOptions) ?? {};
  if (params.replyOptions?.abortSignal?.aborted) {
    noteDispatchProcessedOutcome({ outcome: "skipped", reason: "reply_operation_aborted" });
    messageAuditTerminal?.note("skipped", { reason: "reply_operation_aborted" });
    return {
      status: "complete" as const,
      result: {
        queuedFinal: false,
        counts: dispatcher.getQueuedCounts(),
      },
    };
  }
  const diagnosticsEnabled = isDiagnosticsEnabled(cfg);
  const channel = normalizeLowercaseStringOrEmpty(ctx.Surface ?? ctx.Provider ?? "unknown");
  const chatId = ctx.To ?? ctx.From;
  const messageId =
    ctx.MessageSidFull ?? ctx.MessageSid ?? ctx.MessageSidFirst ?? ctx.MessageSidLast;
  const sessionKey =
    normalizeOptionalString(ctx.SessionKey) ?? normalizeOptionalString(ctx.CommandTargetSessionKey);
  const startTime = diagnosticsEnabled ? Date.now() : 0;
  const canTrackSession = diagnosticsEnabled && Boolean(sessionKey);
  const initialSessionStoreEntry = resolveSessionStoreLookup(ctx, cfg);
  // resolveSessionStoreLookup is command-target-aware (it prefers
  // resolveCommandTurnTargetSessionKey), whereas the lifecycle's sessionKey is
  // source-first (ctx.SessionKey). On a native command turn that targets a
  // different session, the resolved entry can belong to the *target* while the
  // lifecycle reports the *source* key — so only carry the UUID when the entry
  // is for the same session the lifecycle reports, to avoid mis-associating a
  // session id with the wrong session key. When they diverge, emit sessionKey
  // only (prior behavior).
  const lifecycleSessionId =
    initialSessionStoreEntry.sessionKey === sessionKey
      ? initialSessionStoreEntry.entry?.sessionId
      : undefined;
  const messageLifecycle = createDiagnosticMessageLifecycle({
    enabled: diagnosticsEnabled,
    channel,
    chatId,
    messageId,
    sessionKey,
    sessionId: lifecycleSessionId,
    source: "dispatch",
    processingReason: "message_start",
    startedAtMs: startTime,
    trackSessionState: canTrackSession,
  });
  const traceAttributes = {
    surface: channel,
    hasSessionKey: Boolean(sessionKey),
    hasRunId: typeof params.replyOptions?.runId === "string",
  };
  const replyHotPathTiming = createReplyHotPathTimingTracker({
    profilerEnabled: isReplyProfilerEnabled({ config: cfg }),
  });
  const traceReplyPhase = <T>(name: string, run: () => Promise<T> | T): Promise<T> =>
    replyHotPathTiming.measure(name, () =>
      measureDiagnosticsTimelineSpan(name, run, {
        phase: "agent-turn",
        config: cfg,
        attributes: traceAttributes,
      }),
    );
  let agentDispatchStartedAt = 0;

  const recordProcessed = (outcome: DispatchProcessedOutcome, opts?: DispatchProcessedOptions) => {
    noteDispatchProcessedOutcome({
      outcome,
      ...(opts?.reason !== undefined ? { reason: opts.reason } : {}),
    });
    messageAuditTerminal?.note(outcome, opts);
    if (diagnosticsEnabled) {
      replyHotPathTiming.logIfSlow({
        channel,
        messageId,
        sessionKey,
        outcome,
        reason: opts?.reason,
      });
    }
    messageLifecycle.markProcessed(outcome, opts);
  };

  const recordAgentDispatchStarted = () => {
    if (!diagnosticsEnabled || agentDispatchStartedAt > 0) {
      return;
    }
    agentDispatchStartedAt = Date.now();
    logMessageDispatchStarted({
      channel,
      sessionKey: acpDispatchSessionKey,
      source: "replyResolver",
    });
  };

  const recordAgentDispatchCompleted = (
