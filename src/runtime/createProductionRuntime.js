import { createActionRequest, createActionRequestFromDecision } from '../contracts/action.js';
import { redactSensitiveText } from '../secrets/redaction.js';
import { captureSemanticMemoryCandidates } from '../memory2/semanticMemoryCandidatePolicy.js';

function directUserConfirmation(selectedName, selectedPayload, requestInput, traceContext) {
  if (selectedName === 'github-development') {
    if (selectedPayload?.mode !== 'execute') return undefined;
    if (requestInput.metadata?.githubDevelopmentRuntimeBound !== true) return undefined;
    if (!requestInput.identityContext?.roles?.includes('monarch')) return undefined;
    return { confirmed: true, requestId: traceContext.requestId, source: 'canonical-owner-github-development-instruction' };
  }
  if (selectedName !== 'task-create') return undefined;
  if (selectedPayload?.kind === 'structured-automation') {
    const plan = selectedPayload.plan;
    const originTarget = requestInput.metadata?.originTarget;
    if (!plan?.trigger?.recurrence || !plan?.trigger?.localTime || !plan?.action?.type) return undefined;
    if (!originTarget || typeof originTarget.transport !== 'string' || typeof originTarget.address !== 'string') return undefined;
    return { confirmed: true, requestId: traceContext.requestId, source: 'canonical-user-structured-automation' };
  }
  if (selectedPayload?.kind !== 'self-notification') return undefined;
  if (typeof selectedPayload?.notificationMessage !== 'string' || selectedPayload.notificationMessage.trim() === '') return undefined;
  const hasSchedule = (typeof selectedPayload?.temporalExpression === 'string' && selectedPayload.temporalExpression.trim() !== '')
    || (typeof selectedPayload?.recurrence === 'string' && selectedPayload.recurrence.trim() !== '');
  if (!hasSchedule) return undefined;
  const originTarget = requestInput.metadata?.originTarget;
  if (!originTarget || typeof originTarget.transport !== 'string' || typeof originTarget.address !== 'string') return undefined;
  return { confirmed: true, requestId: traceContext.requestId, source: 'canonical-user-self-notification' };
}

function requireMethod(value, method, name) {
  if (!value || typeof value[method] !== 'function') throw new TypeError(`${name}.${method} is required`);
  return value;
}
function responseFromGate(gateDecision, responsePlan) {
  if (gateDecision.outcome === 'require-confirmation') return { status: 'confirmation-required', message: responsePlan.message, data: { gateOutcome: gateDecision.outcome } };
  if (gateDecision.outcome !== 'allow') return { status: 'prepared', message: responsePlan.message, data: { gateOutcome: gateDecision.outcome, reasons: gateDecision.reasons } };
  return null;
}
function capabilityOverrides(capability) {
  if (!capability) return {};
  return { requiredPermission: capability.requiredPermissions[0] ?? `capability:${capability.name}`, requiredSources: capability.requiredSources, requiredTools: capability.requiredTools, risk: capability.risk, estimatedCostUsd: capability.estimatedCostUsd, confirmationRequired: capability.confirmationRequired };
}
function publicConversationReference(canonicalInput) {
  const context = canonicalInput.metadata?.conversationContext;
  if (!context) return null;
  return Object.freeze({ conversationId: context.conversationId, sessionId: context.sessionId, topicId: context.topicId, transition: context.transition });
}
function presentationPreferences(canonicalInput) {
  const settings = canonicalInput.metadata?.userSettingsContext?.settings;
  if (!settings) return null;
  return Object.freeze({ response: settings.response ?? null, units: settings.units ?? null, formatting: settings.formatting ?? null, accessibility: settings.accessibility ?? null });
}
function languagePayload(canonicalInput, semantic) {
  return Object.freeze({ text: canonicalInput.text, message: semantic.responsePlan.message, semanticMessage: semantic.responsePlan.message, languageContext: canonicalInput.metadata?.languageContext ?? null, conversationContext: publicConversationReference(canonicalInput), userPreferences: presentationPreferences(canonicalInput), workspaceRuntimePolicy: canonicalInput.metadata?.workspaceRuntimePolicy ?? null, originTarget: canonicalInput.metadata?.originTarget ?? null, userInitiatedCanonicalRequest: true, locale: canonicalInput.locale });
}
function conversationKey(input) {
  const contextId = input.metadata?.conversationContext?.conversationId;
  if (contextId) return contextId;
  const scope = input.scopeContext;
  return [input.identityContext.globalUserId, scope.projectScope, scope.groupScope ?? 'private', scope.threadScope ?? 'root'].join('|');
}
function selectedResourceRequirement(semantic) {
  const selected = semantic?.decisionEnvelope?.selectedAction;
  return selected?.resourceRequirement ?? selected?.payload?.resourceRequirement ?? null;
}
function boundedCapabilityResult(result, maxLength = 20000) {
  const envelope = {
    capability: result?.capability ?? null,
    status: result?.status ?? null,
    data: result?.data ?? null,
    sources: result?.sources ?? [],
    tools: result?.tools ?? []
  };
  const serialized = JSON.stringify(envelope);
  return Object.freeze({
    capability: envelope.capability,
    status: envelope.status,
    content: serialized.slice(0, maxLength),
    truncated: serialized.length > maxLength,
    sources: Object.freeze([...(envelope.sources ?? [])]),
    tools: Object.freeze([...(envelope.tools ?? [])])
  });
}
function repositoryAnswerNeedsComposition(semantic, actionRequest, result) {
  return semantic?.decisionEnvelope?.decisionType === 'answer'
    && actionRequest?.capability === 'repository-analyze'
    && ['success', 'partial'].includes(result?.status);
}
async function closeResource(resource) {
  if (resource?.close) await resource.close();
  else if (resource?.stop) await resource.stop();
}

export function createProductionRuntime({ config, semanticPipeline, actionGate, capabilityRegistry = null, capabilityExecutor, domainRuntime = null, observability, languageContextService = null, conversationContextService = null, userSettingsService = null, policyLayer = null, resourceAuthorityRegistry = null, memoryCaptureService = null, resources = [] } = {}) {
  if (!config?.environment || !config?.revision || !config?.shutdownTimeoutMs) throw new TypeError('validated runtime config is required');
  requireMethod(semanticPipeline, 'process', 'semanticPipeline');
  requireMethod(actionGate, 'evaluate', 'actionGate');
  requireMethod(capabilityExecutor, 'execute', 'capabilityExecutor');
  requireMethod(observability, 'record', 'observability');
  if (capabilityRegistry) requireMethod(capabilityRegistry, 'get', 'capabilityRegistry');
  if (domainRuntime) requireMethod(domainRuntime, 'execute', 'domainRuntime');
  if (languageContextService) requireMethod(languageContextService, 'resolve', 'languageContextService');
  if (conversationContextService) { requireMethod(conversationContextService, 'resolveTurn', 'conversationContextService'); requireMethod(conversationContextService, 'recordOutbound', 'conversationContextService'); }
  if (userSettingsService) requireMethod(userSettingsService, 'resolve', 'userSettingsService');
  if (policyLayer) requireMethod(policyLayer, 'resolve', 'policyLayer');
  if (resourceAuthorityRegistry) requireMethod(resourceAuthorityRegistry, 'checkAuthority', 'resourceAuthorityRegistry');
  if (memoryCaptureService) requireMethod(memoryCaptureService, 'capture', 'memoryCaptureService');
  if (!Array.isArray(resources)) throw new TypeError('resources must be an array');

  let phase = 'created', accepting = false, inFlight = 0, failure = null;
  let activeResources = [];
  const waiters = new Set();
  const snapshot = () => Object.freeze({ phase, accepting, inFlight, failed: Boolean(failure), failure: failure?.message ? redactSensitiveText(failure.message) : null });
  function notifyDrained() { if (inFlight === 0) { for (const resolve of waiters) resolve(); waiters.clear(); } }

  async function start() {
    if (phase !== 'created') throw new Error(`runtime cannot start from phase ${phase}`);
    phase = 'starting';
    activeResources = [];
    try {
      for (const resource of resources) {
        if (resource?.start) await resource.start();
        activeResources.push(resource);
      }
      accepting = true; phase = 'ready'; return snapshot();
    } catch (error) {
      accepting = false;
      for (const resource of [...activeResources].reverse()) { try { await closeResource(resource); } catch {} }
      activeResources = [];
      failure = error; phase = 'failed'; throw error;
    }
  }
  function withPolicyContext(canonicalInput) {
    if (!policyLayer) return canonicalInput;
    const policyContext = policyLayer.resolve({ roles: canonicalInput.identityContext.roles });
    return Object.freeze({ ...canonicalInput, metadata: Object.freeze({ ...(canonicalInput.metadata ?? {}), policyContext }) });
  }
  async function withUserSettingsContext(canonicalInput) {
    if (!userSettingsService) return canonicalInput;
    const hints = canonicalInput.locale ? { locale: canonicalInput.locale } : null;
    const context = await userSettingsService.resolve(canonicalInput.identityContext.globalUserId, { projectScope: canonicalInput.scopeContext.projectScope, hints });
    return Object.freeze({ ...canonicalInput, metadata: Object.freeze({ ...(canonicalInput.metadata ?? {}), userSettingsContext: context }) });
  }
  async function withConversationContext(canonicalInput) {
    if (!conversationContextService) return canonicalInput;
    const scope = canonicalInput.scopeContext;
    const context = await conversationContextService.resolveTurn({
      globalUserId: canonicalInput.identityContext.globalUserId,
      projectScope: scope.projectScope,
      groupScope: scope.groupScope,
      threadScope: scope.threadScope,
      transport: canonicalInput.metadata?.transport ?? 'unknown',
      transportSessionId: canonicalInput.metadata?.transportSessionId ?? null,
      platformMessageId: canonicalInput.metadata?.platformMessageId ?? null,
      replyToMessageId: canonicalInput.metadata?.replyToMessageId ?? null,
      continueConversationId: canonicalInput.metadata?.continueConversationId ?? null,
      topicShift: canonicalInput.metadata?.topicShift === true,
      topicKey: canonicalInput.metadata?.topicKey ?? null,
      text: canonicalInput.text,
      metadata: { traceId: canonicalInput.traceContext.traceId, requestId: canonicalInput.traceContext.requestId, platformMessageId: canonicalInput.metadata?.platformMessageId ?? null }
    });
    observability.record({ eventClass: 'audit_event', channel: 'telemetry', stage: 'conversation-context', traceContext: canonicalInput.traceContext, outcome: context.transition, actorRef: canonicalInput.identityContext.globalUserId, data: { contextEventClass: 'conversation_context_resolved', conversationId: context.conversationId, sessionId: context.sessionId, topicId: context.topicId, recentTurnCount: context.recentTurns.length } });
    return Object.freeze({ ...canonicalInput, metadata: Object.freeze({ ...(canonicalInput.metadata ?? {}), conversationContext: context }) });
  }
  async function withLanguageContext(canonicalInput) {
    if (!languageContextService) return canonicalInput;
    const context = await languageContextService.resolve({ globalUserId: canonicalInput.identityContext.globalUserId, text: canonicalInput.text, platformLocale: canonicalInput.locale, conversationLanguage: canonicalInput.metadata?.conversationLanguage ?? null, conversationKey: conversationKey(canonicalInput), traceContext: canonicalInput.traceContext, identityContext: canonicalInput.identityContext });
    return Object.freeze({ ...canonicalInput, locale: context.locale ?? canonicalInput.locale, metadata: Object.freeze({ ...(canonicalInput.metadata ?? {}), languageContext: context }) });
  }
  async function captureMemory(requestInput, semantic) {
    if (!memoryCaptureService) return null;
    if (requestInput.metadata?.workspaceRuntimePolicy?.workspaceMemoryEnabled === false && requestInput.scopeContext?.groupScope) {
      return Object.freeze({ status: 'suppressed', persisted: false, reason: 'workspace-memory-disabled' });
    }
    const explicitCandidate = requestInput.metadata?.memoryCandidate ?? null;
    const semanticCandidates = semantic?.decisionEnvelope?.selectedAction?.payload?.memoryCandidates ?? [];
    const candidates = explicitCandidate?.key ? [explicitCandidate, ...semanticCandidates] : semanticCandidates;
    if (candidates.length === 0) {
      return Object.freeze({ status: 'suppressed', persisted: false, reason: 'semantic-candidate-required' });
    }
    const results = await captureSemanticMemoryCandidates({
      memoryProvider: memoryCaptureService,
      request: {
        input: {
          text: requestInput.text,
          conversationContext: {
            ...(requestInput.metadata?.conversationContext ?? {}),
            platformMessageId: requestInput.metadata?.platformMessageId ?? null
          }
        },
        scope: requestInput.scopeContext,
        actor: requestInput.identityContext,
        traceContext: requestInput.traceContext
      },
      candidates
    });
    for (const result of results) {
      if (result.status !== 'failed') continue;
      observability.recordFailure({ traceContext: requestInput.traceContext, stage: 'memory2-capture', reason: result.reason ?? 'semantic memory capture failed', code: result.reason ?? 'memory2-capture-failed' });
    }
    const persistedCount = results.filter((result) => result.persisted).length;
    return Object.freeze({
      status: results.some((result) => result.status === 'failed') ? 'partial' : 'completed',
      persisted: persistedCount > 0,
      persistedCount,
      candidateCount: results.length,
      results
    });
  }
  async function persistResponse(requestInput, response) {
    const conversationContext = requestInput.metadata?.conversationContext;
    if (!conversationContextService || !conversationContext || !response?.message) return response;
    const scope = requestInput.scopeContext;
    await conversationContextService.recordOutbound({ conversationContext, globalUserId: requestInput.identityContext.globalUserId, projectScope: scope.projectScope, groupScope: scope.groupScope, threadScope: scope.threadScope, transport: requestInput.metadata?.transport ?? 'unknown', text: response.message, metadata: { traceId: requestInput.traceContext.traceId, requestId: requestInput.traceContext.requestId } });
    return { ...response, data: { ...(response.data ?? {}), conversationContext } };
  }
  async function resolveResourceAuthority(requirement, requestInput, traceContext) {
    if (!requirement) return null;
    if (!resourceAuthorityRegistry) return Object.freeze({ allowed: false, reason: 'resource-authority-registry-unavailable', actorGlobalUserId: requestInput.identityContext.globalUserId, projectScope: requestInput.scopeContext.projectScope, resourceId: requirement.resourceId, requiredRelation: requirement.relation, evidence: null });
    let decision;
    try { decision = await resourceAuthorityRegistry.checkAuthority({ actorGlobalUserId: requestInput.identityContext.globalUserId, projectScope: requestInput.scopeContext.projectScope, resourceId: requirement.resourceId, relation: requirement.relation }); }
    catch (error) { decision = { allowed: false, reason: error?.code ?? 'resource-authority-resolution-failed', resourceId: requirement.resourceId, requiredRelation: requirement.relation, evidence: null }; }
    const resolved = Object.freeze({ ...decision, actorGlobalUserId: requestInput.identityContext.globalUserId, projectScope: requestInput.scopeContext.projectScope, resourceId: requirement.resourceId, requiredRelation: requirement.relation });
    observability.record({ eventClass: 'audit_event', channel: 'audit', stage: 'resource-authority', traceContext, outcome: resolved.allowed ? 'allow' : 'deny', actorRef: requestInput.identityContext.globalUserId, data: { authorityEventClass: 'resource_authority_resolved', resourceId: resolved.resourceId, requiredRelation: resolved.requiredRelation, reason: resolved.reason, authorityId: resolved.evidence?.authorityId ?? null } });
    return resolved;
  }

  async function handle(canonicalInput) {
    if (!accepting || phase !== 'ready') throw new Error('runtime is not ready');
    inFlight += 1;
    const traceContext = canonicalInput?.traceContext;
    try {
      const settingsInput = await withUserSettingsContext(withPolicyContext(canonicalInput));
      const requestInput = await withLanguageContext(await withConversationContext(settingsInput));
      observability.record({ eventClass: 'request_received', channel: 'telemetry', stage: 'runtime', traceContext, actorRef: requestInput.identityContext.globalUserId, transport: requestInput.metadata?.transport ?? null });
      const policyContext = requestInput.metadata?.policyContext ?? null;
      if (policyContext) observability.record({ eventClass: 'policy_context_resolved', channel: 'telemetry', stage: 'configuration-policy', traceContext, outcome: 'resolved', data: { roles: policyContext.roles, provenance: policyContext.provenance } });
      const userSettingsContext = requestInput.metadata?.userSettingsContext ?? null;
      if (userSettingsContext) {
        const explicitFields = Object.entries(userSettingsContext.provenance ?? {}).filter(([, value]) => value?.explicit === true).map(([path]) => path).sort();
        observability.record({ eventClass: 'audit_event', channel: 'telemetry', stage: 'user-settings', traceContext, outcome: 'resolved', actorRef: requestInput.identityContext.globalUserId, data: { settingsEventClass: 'user_settings_resolved', projectScope: userSettingsContext.projectScope, explicitFields } });
      }
      const languageContext = requestInput.metadata?.languageContext ?? null;
      if (languageContext) observability.record({ eventClass: 'language_context_resolved', channel: 'telemetry', stage: 'language-context', traceContext, outcome: languageContext.responseLanguage, data: { detectedLanguage: languageContext.messageLanguage, confidence: languageContext.confidence, responseLanguage: languageContext.responseLanguage, detectionSource: languageContext.detectionSource, responseLanguageSource: languageContext.responseLanguageSource, locale: languageContext.locale } });

      const semantic = await semanticPipeline.process(requestInput);
      const memoryCapture = await captureMemory(requestInput, semantic);
      observability.record({ eventClass: 'semantic_decision_created', channel: 'telemetry', stage: 'decision-engine', traceContext, outcome: semantic.decisionEnvelope.decisionType, data: { intent: semantic.decisionEnvelope.intent } });
      if (semantic.decisionEnvelope.decisionType === 'clarification') {
        return persistResponse(requestInput, {
          status: 'clarification-required',
          message: semantic.responsePlan.message,
          data: {
            decisionEnvelope: semantic.decisionEnvelope,
            canonicalResolution: semantic.canonicalSemanticModel
              ? Object.freeze({
                version: semantic.canonicalSemanticModel.version ?? null,
                status: semantic.canonicalSemanticModel.resolutionStatus ?? null,
                confidence: semantic.canonicalSemanticModel.confidence ?? null,
                missingInformation: semantic.canonicalSemanticModel.missingInformation ?? []
              })
              : null,
            languageContext,
            policyContext,
            memoryCapture
          }
        });
      }
      const selectedName = semantic.decisionEnvelope.selectedAction?.name ?? semantic.decisionEnvelope.selectedAction?.type;
      const selectedPayload = semantic.decisionEnvelope.selectedAction?.payload ?? {};
      const declaredCapability = capabilityRegistry?.get(selectedName) ?? null;
      const requirement = selectedResourceRequirement(semantic);
      const authority = await resolveResourceAuthority(requirement, requestInput, traceContext);
      const confirmation = directUserConfirmation(selectedName, selectedPayload, requestInput, traceContext);
      const actionRequest = createActionRequestFromDecision({ decisionEnvelope: semantic.decisionEnvelope, identityContext: requestInput.identityContext, scopeContext: requestInput.scopeContext, overrides: { ...capabilityOverrides(declaredCapability), resourceRequirement: requirement, resourceAuthority: authority, confirmation, payload: { ...selectedPayload, ...languagePayload(requestInput, semantic) } } });
      const gateDecision = actionGate.evaluate(actionRequest, { policyContext });
      observability.record({ eventClass: 'action_gate_decision', channel: 'audit', stage: 'action-gate', traceContext, outcome: gateDecision.outcome, data: { capability: actionRequest.capability, authorized: gateDecision.authorized, resourceId: actionRequest.resourceRequirement?.resourceId ?? null, resourceAuthority: gateDecision.checks.resourceAuthority } });
      const gatedResponse = responseFromGate(gateDecision, semantic.responsePlan);
      if (gatedResponse) return persistResponse(requestInput, { ...gatedResponse, data: { ...(gatedResponse.data ?? {}), languageContext, policyContext, memoryCapture } });

      let result;
      if (actionRequest.payload?.domainId && actionRequest.capability !== 'domain-dispatch') {
        if (!domainRuntime) throw new Error('domain runtime is required for domain execution');
        result = await domainRuntime.execute({ domainId: actionRequest.payload.domainId, capability: actionRequest.capability, input: actionRequest.payload, identityContext: requestInput.identityContext, scopeContext: requestInput.scopeContext, traceContext, gateDecision });
      } else {
        observability.record({ eventClass: 'capability_started', channel: 'telemetry', stage: 'capability', traceContext, data: { capability: actionRequest.capability } });
        result = await capabilityExecutor.execute({ actionRequest, gateDecision, policyContext, traceContext });
        observability.record({ eventClass: 'capability_completed', channel: 'telemetry', stage: 'capability', traceContext, outcome: result.status, durationMs: result.durationMs, costUsd: result.costUsd, data: { capability: result.capability } });
      }

      let finalResult = result;
      let responseCompositionGate = null;
      if (repositoryAnswerNeedsComposition(semantic, actionRequest, result)) {
        const composeCapability = capabilityRegistry?.get('compose-answer') ?? null;
        if (!composeCapability) throw new Error('compose-answer capability is required to present repository analysis');
        const composeRequest = createActionRequest({
          capability: 'compose-answer',
          actionType: 'answer',
          actionClass: 'analysis-only',
          actor: requestInput.identityContext,
          scope: requestInput.scopeContext,
          payload: {
            ...languagePayload(requestInput, semantic),
            semanticIntent: semantic.decisionEnvelope.intent,
            capabilityResult: boundedCapabilityResult(result)
          },
          ...capabilityOverrides(composeCapability),
          traceContext
        });
        responseCompositionGate = actionGate.evaluate(composeRequest, { policyContext });
        observability.record({ eventClass: 'action_gate_decision', channel: 'audit', stage: 'action-gate', traceContext, outcome: responseCompositionGate.outcome, data: { capability: composeRequest.capability, authorized: responseCompositionGate.authorized, responseComposition: true, sourceCapability: actionRequest.capability } });
        const compositionGatedResponse = responseFromGate(responseCompositionGate, semantic.responsePlan);
        if (compositionGatedResponse) return persistResponse(requestInput, { ...compositionGatedResponse, data: { ...(compositionGatedResponse.data ?? {}), decisionEnvelope: semantic.decisionEnvelope, gateDecision, execution: result, responseCompositionGate, languageContext, policyContext, memoryCapture } });
        observability.record({ eventClass: 'capability_started', channel: 'telemetry', stage: 'capability', traceContext, data: { capability: composeRequest.capability, responseComposition: true, sourceCapability: actionRequest.capability } });
        finalResult = await capabilityExecutor.execute({ actionRequest: composeRequest, gateDecision: responseCompositionGate, policyContext, traceContext });
        observability.record({ eventClass: 'capability_completed', channel: 'telemetry', stage: 'capability', traceContext, outcome: finalResult.status, durationMs: finalResult.durationMs, costUsd: finalResult.costUsd, data: { capability: finalResult.capability, responseComposition: true, sourceCapability: actionRequest.capability } });
      }

      const message = finalResult?.data?.message ?? finalResult?.data?.text ?? semantic.responsePlan.message;
      return persistResponse(requestInput, { status: finalResult.status ?? 'success', message, data: { decisionEnvelope: semantic.decisionEnvelope, gateDecision, execution: result, responseComposition: finalResult === result ? null : finalResult, responseCompositionGate, languageContext, policyContext, memoryCapture } });
    } catch (error) {
      failure = phase === 'ready' ? null : error;
      observability.recordFailure({ traceContext, stage: 'runtime', reason: redactSensitiveText(error.message), code: error.code ?? 'runtime-request-failed' });
      throw error;
    } finally { inFlight -= 1; notifyDrained(); }
  }

  async function stop() {
    if (phase === 'stopped') return snapshot();
    accepting = false; phase = 'stopping';
    if (inFlight > 0) await Promise.race([new Promise((resolve) => waiters.add(resolve)), new Promise((_, reject) => setTimeout(() => reject(new Error('runtime shutdown drain timeout')), config.shutdownTimeoutMs))]);
    for (const resource of [...activeResources].reverse()) await closeResource(resource);
    activeResources = [];
    phase = 'stopped'; return snapshot();
  }

  return Object.freeze({ start, stop, handle, health: () => Object.freeze({ ok: phase !== 'failed', ...snapshot() }), readiness: () => Object.freeze({ ready: phase === 'ready' && accepting, ...snapshot() }) });
}
