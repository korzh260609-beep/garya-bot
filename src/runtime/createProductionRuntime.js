import { createActionRequestFromDecision } from '../contracts/action.js';

function requireMethod(value, method, name) {
  if (!value || typeof value[method] !== 'function') throw new TypeError(`${name}.${method} is required`);
  return value;
}

function responseFromGate(gateDecision, responsePlan) {
  if (gateDecision.outcome === 'require-confirmation') {
    return { status: 'confirmation-required', message: responsePlan.message, data: { gateOutcome: gateDecision.outcome } };
  }
  if (gateDecision.outcome !== 'allow') {
    return { status: 'prepared', message: responsePlan.message, data: { gateOutcome: gateDecision.outcome, reasons: gateDecision.reasons } };
  }
  return null;
}

function capabilityOverrides(capability) {
  if (!capability) return {};
  return {
    requiredPermission: capability.requiredPermissions[0] ?? `capability:${capability.name}`,
    requiredSources: capability.requiredSources,
    requiredTools: capability.requiredTools,
    risk: capability.risk,
    estimatedCostUsd: capability.estimatedCostUsd,
    confirmationRequired: capability.confirmationRequired
  };
}

export function createProductionRuntime({
  config,
  semanticPipeline,
  actionGate,
  capabilityRegistry = null,
  capabilityExecutor,
  domainRuntime = null,
  observability,
  resources = []
} = {}) {
  if (!config?.environment || !config?.revision || !config?.shutdownTimeoutMs) throw new TypeError('validated runtime config is required');
  requireMethod(semanticPipeline, 'process', 'semanticPipeline');
  requireMethod(actionGate, 'evaluate', 'actionGate');
  requireMethod(capabilityExecutor, 'execute', 'capabilityExecutor');
  requireMethod(observability, 'record', 'observability');
  if (capabilityRegistry) requireMethod(capabilityRegistry, 'get', 'capabilityRegistry');
  if (domainRuntime) requireMethod(domainRuntime, 'execute', 'domainRuntime');
  if (!Array.isArray(resources)) throw new TypeError('resources must be an array');

  let phase = 'created';
  let accepting = false;
  let inFlight = 0;
  let failure = null;
  const waiters = new Set();

  function snapshot() {
    return Object.freeze({ phase, accepting, inFlight, failed: Boolean(failure), failure: failure?.message ?? null });
  }

  function notifyDrained() {
    if (inFlight !== 0) return;
    for (const resolve of waiters) resolve();
    waiters.clear();
  }

  async function start() {
    if (phase !== 'created') throw new Error(`runtime cannot start from phase ${phase}`);
    phase = 'starting';
    try {
      for (const resource of resources) {
        if (resource?.start) await resource.start();
      }
      accepting = true;
      phase = 'ready';
      return snapshot();
    } catch (error) {
      failure = error;
      accepting = false;
      phase = 'failed';
      throw error;
    }
  }

  async function handle(canonicalInput) {
    if (!accepting || phase !== 'ready') throw new Error('runtime is not ready');
    inFlight += 1;
    const traceContext = canonicalInput?.traceContext;
    try {
      observability.record({ eventClass: 'request_received', channel: 'telemetry', stage: 'runtime', traceContext, actorRef: canonicalInput.identityContext.globalUserId, transport: canonicalInput.metadata?.transport ?? null });
      const semantic = await semanticPipeline.process(canonicalInput);
      observability.record({ eventClass: 'semantic_decision_created', channel: 'telemetry', stage: 'decision-engine', traceContext, outcome: semantic.decisionEnvelope.decisionType, data: { intent: semantic.decisionEnvelope.intent } });

      const selectedName = semantic.decisionEnvelope.selectedAction?.name ?? semantic.decisionEnvelope.selectedAction?.type;
      const declaredCapability = capabilityRegistry?.get(selectedName) ?? null;
      const actionRequest = createActionRequestFromDecision({
        decisionEnvelope: semantic.decisionEnvelope,
        identityContext: canonicalInput.identityContext,
        scopeContext: canonicalInput.scopeContext,
        overrides: capabilityOverrides(declaredCapability)
      });
      const gateDecision = actionGate.evaluate(actionRequest);
      observability.record({ eventClass: 'action_gate_decision', channel: 'audit', stage: 'action-gate', traceContext, outcome: gateDecision.outcome, data: { capability: actionRequest.capability, authorized: gateDecision.authorized } });

      const gatedResponse = responseFromGate(gateDecision, semantic.responsePlan);
      if (gatedResponse) return gatedResponse;

      let result;
      if (actionRequest.payload?.domainId) {
        if (!domainRuntime) throw new Error('domain runtime is required for domain execution');
        result = await domainRuntime.execute({
          domainId: actionRequest.payload.domainId,
          capability: actionRequest.capability,
          input: actionRequest.payload,
          identityContext: canonicalInput.identityContext,
          scopeContext: canonicalInput.scopeContext,
          traceContext
        });
      } else {
        observability.record({ eventClass: 'capability_started', channel: 'telemetry', stage: 'capability', traceContext, data: { capability: actionRequest.capability } });
        result = await capabilityExecutor.execute({ actionRequest, gateDecision });
        observability.record({ eventClass: 'capability_completed', channel: 'telemetry', stage: 'capability', traceContext, outcome: result.status, durationMs: result.durationMs, costUsd: result.costUsd, data: { capability: result.capability } });
      }

      const message = result?.data?.message ?? result?.data?.text ?? semantic.responsePlan.message;
      return { status: result.status ?? 'success', message, data: { decisionEnvelope: semantic.decisionEnvelope, gateDecision, execution: result } };
    } catch (error) {
      failure = phase === 'ready' ? null : error;
      observability.recordFailure({ traceContext, stage: 'runtime', reason: error.message, code: error.code ?? 'runtime-request-failed' });
      throw error;
    } finally {
      inFlight -= 1;
      notifyDrained();
    }
  }

  async function stop() {
    if (phase === 'stopped') return snapshot();
    accepting = false;
    phase = 'stopping';
    if (inFlight > 0) {
      await Promise.race([
        new Promise((resolve) => waiters.add(resolve)),
        new Promise((_, reject) => setTimeout(() => reject(new Error('runtime shutdown drain timeout')), config.shutdownTimeoutMs))
      ]);
    }
    for (const resource of [...resources].reverse()) {
      if (resource?.close) await resource.close();
      else if (resource?.stop) await resource.stop();
    }
    phase = 'stopped';
    return snapshot();
  }

  return Object.freeze({
    start,
    stop,
    handle,
    health: () => Object.freeze({ ok: phase !== 'failed', ...snapshot() }),
    readiness: () => Object.freeze({ ready: phase === 'ready' && accepting, ...snapshot() })
  });
}
