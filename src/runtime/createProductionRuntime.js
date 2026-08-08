import { buildCanonicalInput } from '../semantic/canonicalInput.js';
import { createActionRequestFromDecision } from '../action/actionRequest.js';
import { redactSensitiveText } from '../secrets/redaction.js';

function responseFromGate(gateDecision, responsePlan) {
  if (gateDecision.outcome === 'allow') return null;
  if (gateDecision.outcome === 'require-confirmation') return { status: 'confirmation-required', message: gateDecision.reason, data: { gateDecision } };
  if (gateDecision.outcome === 'downgrade') return { status: 'prepare-only', message: responsePlan?.message ?? gateDecision.reason, data: { gateDecision } };
  return { status: 'denied', message: gateDecision.reason, data: { gateDecision } };
}
function scopeForRequirement(requestInput) {
  return { globalUserId: requestInput.identityContext.globalUserId, projectScope: requestInput.scopeContext.projectScope };
}
function languagePayload(requestInput, semantic) {
  const language = requestInput.metadata?.languageContext;
  const settings = requestInput.metadata?.userSettingsContext;
  const presentation = settings ? {
    responseLength: settings.settings.responseLength,
    units: settings.settings.units,
    dateFormat: settings.settings.dateFormat,
    numberFormat: settings.settings.numberFormat,
    accessibility: settings.settings.accessibility
  } : null;
  if (semantic.decisionEnvelope.selectedAction?.name !== 'compose-answer') return presentation ? { presentationPreferences: presentation } : {};
  return { responseLanguage: language?.responseLanguage ?? null, locale: language?.locale ?? null, presentationPreferences: presentation };
}
function capabilityOverrides(capability) {
  if (!capability) return {};
  const riskMap = { low: 'low', medium: 'medium', high: 'high', critical: 'critical' };
  return { requiredPermissions: capability.requiredPermissions, requiredSources: capability.requiredSources, requiredTools: capability.requiredTools, riskLevel: riskMap[capability.safety?.risk] ?? 'low', estimatedCostUsd: capability.estimatedCostUsd ?? 0, actionClass: capability.safety?.changesState || capability.safety?.externalEffect ? 'protected' : 'analysis' };
}
function selectedResourceRequirement(semantic) {
  const selected = semantic?.decisionEnvelope?.selectedAction;
  const requirement = selected?.resourceRequirement ?? selected?.payload?.resourceRequirement ?? null;
  if (!requirement) return null;
  if (typeof requirement.resourceId !== 'string' || requirement.resourceId.trim() === '' || typeof requirement.relation !== 'string' || requirement.relation.trim() === '') throw new TypeError('resourceRequirement requires resourceId and relation');
  return Object.freeze({ resourceId: requirement.resourceId.trim(), relation: requirement.relation.trim() });
}

export function createProductionRuntime({ config, semanticPipeline, actionGate, capabilityRegistry, capabilityExecutor, observability, languageContextService = null, conversationContextService = null, userSettingsService = null, policyLayer = null, resourceAuthorityRegistry = null, resources = [], clock = () => new Date().toISOString() } = {}) {
  if (!config || !semanticPipeline?.process || !actionGate?.evaluate || !capabilityRegistry?.get || !capabilityExecutor?.execute || !observability?.record) throw new TypeError('runtime dependencies are incomplete');
  let phase = 'created'; let accepting = false; let inFlight = 0; let startedAt = null; let failure = null;
  const waiters = new Set();
  const notifyDrained = () => { if (inFlight === 0) { for (const resolve of waiters) resolve(); waiters.clear(); } };
  const snapshot = () => Object.freeze({ phase, accepting, inFlight, startedAt, environment: config.environment, revision: config.revision, persistenceMode: config.persistenceMode, failure: failure ? { name: failure.name, message: redactSensitiveText(failure.message) } : null });

  async function start() {
    if (phase === 'ready') return snapshot();
    if (phase !== 'created' && phase !== 'stopped') throw new Error(`runtime cannot start from ${phase}`);
    phase = 'starting'; failure = null;
    try {
      for (const resource of resources) if (resource?.start) await resource.start();
      startedAt = clock(); accepting = true; phase = 'ready'; return snapshot();
    } catch (error) { phase = 'failed'; failure = error; accepting = false; throw error; }
  }

  function traceFor(canonicalInput) {
    return { traceId: canonicalInput.traceContext.traceId, requestId: canonicalInput.traceContext.requestId, environment: canonicalInput.traceContext.environment ?? config.environment, revision: canonicalInput.traceContext.revision ?? config.revision };
  }

  async function applyConversationContext(canonical) {
    if (!conversationContextService) return canonical;
    const platformFacts = canonical.metadata?.platformFacts ?? {};
    const scope = canonical.scopeContext;
    const result = await conversationContextService.resolveInbound({
      globalUserId: canonical.identityContext.globalUserId,
      projectScope: scope.projectScope,
      groupScope: scope.groupScope,
      threadScope: scope.threadScope,
      transport: canonical.transport,
      transportSessionId: platformFacts.transportSessionId ?? platformFacts.chatId ?? scope.threadScope ?? scope.groupScope ?? canonical.identityContext.globalUserId,
      externalMessageId: platformFacts.externalMessageId ?? platformFacts.messageId ?? canonical.traceContext.requestId,
      replyToExternalMessageId: platformFacts.replyToExternalMessageId ?? platformFacts.replyToMessageId ?? null,
      text: canonical.text,
      requestedConversationId: canonical.metadata?.conversationId ?? null,
      topicShift: canonical.metadata?.topicShift ?? false,
      topicLabel: canonical.metadata?.topicLabel ?? null,
      allowCrossTransportContinuation: canonical.metadata?.allowCrossTransportContinuation ?? false,
      traceContext: traceFor(canonical)
    });
    return buildCanonicalInput({ ...canonical, metadata: { ...canonical.metadata, conversationId: result.conversation.conversationId, sessionId: result.session.sessionId, topicId: result.topic.topicId, conversationContext: result } });
  }

  async function applyUserSettings(canonical) {
    if (!userSettingsService) return canonical;
    const settings = await userSettingsService.resolve({ globalUserId: canonical.identityContext.globalUserId, projectScope: canonical.scopeContext.projectScope, transportHints: { language: canonical.metadata?.platformLanguageHint ?? null, locale: canonical.metadata?.platformLocaleHint ?? null, timeZone: canonical.metadata?.platformTimeZoneHint ?? null } });
    return buildCanonicalInput({ ...canonical, metadata: { ...canonical.metadata, userSettingsContext: settings } });
  }

  async function applyLanguageContext(canonical) {
    if (!languageContextService) return canonical;
    const settings = canonical.metadata?.userSettingsContext;
    const language = await languageContextService.resolve({ globalUserId: canonical.identityContext.globalUserId, projectScope: canonical.scopeContext.projectScope, groupScope: canonical.scopeContext.groupScope, threadScope: canonical.scopeContext.threadScope, conversationId: canonical.metadata?.conversationId ?? null, text: canonical.text, platformLanguageHint: settings?.settings?.language ?? canonical.metadata?.platformLanguageHint ?? null, platformLocaleHint: settings?.settings?.locale ?? canonical.metadata?.platformLocaleHint ?? null, explicitResponseLanguage: canonical.metadata?.explicitResponseLanguage ?? null, traceContext: traceFor(canonical) });
    return buildCanonicalInput({ ...canonical, metadata: { ...canonical.metadata, languageContext: language } });
  }

  async function applyPolicyContext(canonical) {
    if (!policyLayer) return canonical;
    const policyContext = policyLayer.resolve({ projectScope: canonical.scopeContext.projectScope, roles: canonical.identityContext.roles });
    return buildCanonicalInput({ ...canonical, metadata: { ...canonical.metadata, policyContext } });
  }

  async function resolveResourceAuthority(requirement, requestInput, traceContext) {
    if (!requirement) return null;
    if (!resourceAuthorityRegistry) return null;
    const result = await resourceAuthorityRegistry.resolve({ globalUserId: requestInput.identityContext.globalUserId, projectScope: requestInput.scopeContext.projectScope, resourceId: requirement.resourceId, relation: requirement.relation }, { traceContext });
    return result.satisfied ? result.evidence : null;
  }

  async function persistResponse(requestInput, response) {
    if (!conversationContextService || !requestInput.metadata?.conversationContext?.conversation?.conversationId) return response;
    const context = requestInput.metadata.conversationContext;
    await conversationContextService.recordOutbound({ conversationId: context.conversation.conversationId, sessionId: context.session.sessionId, topicId: context.topic.topicId, globalUserId: requestInput.identityContext.globalUserId, projectScope: requestInput.scopeContext.projectScope, groupScope: requestInput.scopeContext.groupScope, threadScope: requestInput.scopeContext.threadScope, transport: requestInput.transport, text: response.message, traceContext: traceFor(requestInput) });
    return response;
  }

  async function handle(canonicalInput) {
    if (phase !== 'ready' || !accepting) throw new Error('runtime is not ready');
    inFlight += 1;
    const traceContext = traceFor(canonicalInput);
    try {
      observability.record({ eventClass: 'request_received', channel: 'telemetry', stage: 'runtime', traceContext, transport: canonicalInput.transport, actorRef: canonicalInput.identityContext.globalUserId, scopeRef: canonicalInput.scopeContext.projectScope });
      let requestInput = await applyConversationContext(canonicalInput);
      requestInput = await applyUserSettings(requestInput);
      requestInput = await applyLanguageContext(requestInput);
      requestInput = await applyPolicyContext(requestInput);
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
      observability.record({ eventClass: 'semantic_decision_created', channel: 'telemetry', stage: 'decision-engine', traceContext, outcome: semantic.decisionEnvelope.decisionType, data: { intent: semantic.decisionEnvelope.intent } });
      const selectedName = semantic.decisionEnvelope.selectedAction?.name ?? semantic.decisionEnvelope.selectedAction?.type;
      const declaredCapability = capabilityRegistry?.get(selectedName) ?? null;
      const requirement = selectedResourceRequirement(semantic);
      const authority = await resolveResourceAuthority(requirement, requestInput, traceContext);
      const actionRequest = createActionRequestFromDecision({ decisionEnvelope: semantic.decisionEnvelope, identityContext: requestInput.identityContext, scopeContext: requestInput.scopeContext, overrides: { ...capabilityOverrides(declaredCapability), resourceRequirement: requirement, resourceAuthority: authority, payload: { ...(semantic.decisionEnvelope.selectedAction?.payload ?? {}), ...languagePayload(requestInput, semantic) } } });
      const gateDecision = actionGate.evaluate(actionRequest, { policyContext });
      observability.record({ eventClass: 'action_gate_decision', channel: 'audit', stage: 'action-gate', traceContext, outcome: gateDecision.outcome, data: { capability: actionRequest.capability, authorized: gateDecision.authorized, resourceId: actionRequest.resourceRequirement?.resourceId ?? null, resourceAuthority: gateDecision.checks.resourceAuthority } });
      const gatedResponse = responseFromGate(gateDecision, semantic.responsePlan);
      if (gatedResponse) return persistResponse(requestInput, { ...gatedResponse, data: { ...(gatedResponse.data ?? {}), languageContext, policyContext } });

      let result;
      if (actionRequest.payload?.domainId && actionRequest.capability !== 'domain-dispatch') {
        if (!domainRuntime) throw new Error('domain runtime is required for domain execution');
        result = await domainRuntime.execute({ domainId: actionRequest.payload.domainId, capability: actionRequest.capability, input: actionRequest.payload, identityContext: requestInput.identityContext, scopeContext: requestInput.scopeContext, traceContext });
      } else {
        observability.record({ eventClass: 'capability_started', channel: 'telemetry', stage: 'capability', traceContext, data: { capability: actionRequest.capability } });
        result = await capabilityExecutor.execute({ actionRequest, gateDecision, policyContext, traceContext });
        observability.record({ eventClass: 'capability_completed', channel: 'telemetry', stage: 'capability', traceContext, outcome: result.status, durationMs: result.durationMs, costUsd: result.costUsd, data: { capability: result.capability } });
      }
      const message = result?.data?.message ?? result?.data?.text ?? semantic.responsePlan.message;
      return persistResponse(requestInput, { status: result.status ?? 'success', message, data: { decisionEnvelope: semantic.decisionEnvelope, gateDecision, execution: result, languageContext, policyContext } });
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
    for (const resource of [...resources].reverse()) { if (resource?.close) await resource.close(); else if (resource?.stop) await resource.stop(); }
    phase = 'stopped'; return snapshot();
  }

  return Object.freeze({ start, stop, handle, health: () => Object.freeze({ ok: phase !== 'failed', ...snapshot() }), readiness: () => Object.freeze({ ready: phase === 'ready' && accepting, ...snapshot() }) });
}
