import { isProtectedWorkflowStep } from './workflowExecutionSecurity.js';

export const DYNAMIC_COMPOSITION_MODES = Object.freeze(['deterministic', 'ai-assisted']);
export const DYNAMIC_COMPOSITION_SOURCE_STEP_TYPES = Object.freeze(['collect', 'retrieve', 'analyze']);

function failClosed(message, code) {
  const error = new Error(message);
  error.code = code;
  error.retryable = false;
  return error;
}

function requiredFunction(value, field) {
  if (typeof value !== 'function') throw new TypeError(`${field} must be a function`);
  return value;
}

function optionalText(value, field, maximum = 200) {
  if (value == null) return null;
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${field} must be a non-empty string`);
  const text = value.trim();
  if (text.length > maximum) throw new TypeError(`${field} must be at most ${maximum} characters`);
  if (/\p{Cc}/u.test(text)) throw new TypeError(`${field} must not contain control characters`);
  return text;
}

function positiveInteger(value, field, fallback) {
  if (value == null) return fallback;
  if (!Number.isInteger(value) || value < 1) throw new TypeError(`${field} must be a positive integer`);
  return value;
}

function stableJson(value) {
  if (Array.isArray(value)) return value.map(stableJson);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableJson(value[key])]));
  }
  return value;
}

function metric(value, field) {
  if (!Number.isFinite(value)) throw new TypeError(`${field} must be numeric`);
  return String(value);
}

function renderActivityData(data, collectedAt) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return `Data: ${JSON.stringify(stableJson(data))}`;
  }

  const lines = [];
  if (collectedAt) lines.push(`Collected: ${collectedAt}`);
  const totals = data.totals ?? (data.workspaceId ? data : null);
  if (totals) {
    lines.push('Totals:');
    for (const [field, label] of [
      ['publications', 'Publications'],
      ['polls', 'Polls'],
      ['tests', 'Tests']
    ]) {
      if (totals[field] != null) lines.push(`- ${label}: ${metric(totals[field], `totals.${field}`)}`);
    }
    const interactionEvents = totals.interactionEvents ?? totals.interactions?.events;
    if (interactionEvents != null) lines.push(`- Interaction events: ${metric(interactionEvents, 'totals.interactionEvents')}`);
    for (const eventType of Object.keys(totals.activityEvents ?? {}).sort()) {
      lines.push(`- Activity ${eventType}: ${metric(totals.activityEvents[eventType], `totals.activityEvents.${eventType}`)}`);
    }
  }

  if (Array.isArray(data.workspaces) && data.workspaces.length > 0) {
    lines.push('Workspaces:');
    for (const entry of data.workspaces) {
      const workspaceId = optionalText(entry?.workspaceId, 'workspace.workspaceId', 200);
      const workspaceLabel = optionalText(entry?.workspaceTitle, 'workspace.workspaceTitle', 200) ?? workspaceId;
      const uniqueActors = entry?.data?.interactions?.uniqueActors;
      const suffix = uniqueActors == null ? '' : `; unique actors: ${metric(uniqueActors, `workspace.${workspaceId}.uniqueActors`)}`;
      lines.push(`- ${workspaceLabel}${suffix}`);
    }
  } else if (data.workspaceId && data.interactions?.uniqueActors != null) {
    lines.push(`Workspace ${optionalText(data.workspaceId, 'data.workspaceId', 200)} unique actors: ${metric(data.interactions.uniqueActors, 'data.interactions.uniqueActors')}`);
  }

  if (Array.isArray(data.omissions) && data.omissions.length > 0) {
    lines.push('Omissions:');
    for (const omission of data.omissions) {
      const workspaceId = optionalText(omission?.workspaceId, 'omission.workspaceId', 200);
      const workspaceLabel = optionalText(omission?.workspaceTitle, 'omission.workspaceTitle', 200) ?? workspaceId;
      const reason = optionalText(omission?.reason ?? 'unavailable', 'omission.reason', 300);
      const errorCode = optionalText(omission?.errorCode, 'omission.errorCode', 200);
      lines.push(`- ${workspaceLabel}: ${reason}${errorCode ? ` (${errorCode})` : ''}`);
    }
  }

  return lines.length > 0 ? lines.join('\n') : `Data: ${JSON.stringify(stableJson(data))}`;
}

function normalizeSource(context) {
  const handoff = context?.handoff;
  if (!handoff || typeof handoff !== 'object' || handoff.truncated === true) {
    throw failClosed('dynamic composition requires an untruncated runtime handoff', 'dynamic_composition_runtime_handoff_required');
  }
  const previousStep = handoff.previousStep;
  if (!previousStep || typeof previousStep !== 'object') {
    throw failClosed('dynamic composition cannot use stored workflow inputs as runtime evidence', 'dynamic_composition_fresh_source_required');
  }
  if (!DYNAMIC_COMPOSITION_SOURCE_STEP_TYPES.includes(previousStep.stepType)) {
    throw failClosed('dynamic composition requires collect, retrieve or analyze runtime output', 'dynamic_composition_source_step_invalid');
  }
  if (!['completed', 'partial'].includes(previousStep.outcome)) {
    throw failClosed('dynamic composition source step must be completed or partial', 'dynamic_composition_source_outcome_invalid');
  }
  if (!previousStep.output || typeof previousStep.output !== 'object' || Array.isArray(previousStep.output)) {
    throw failClosed('dynamic composition source output must be an object', 'dynamic_composition_source_output_invalid');
  }
  if (previousStep.output.truncated === true) {
    throw failClosed('dynamic composition refuses truncated authoritative source output', 'dynamic_composition_source_output_truncated');
  }
  if (previousStep.evidenceRefs != null && !Array.isArray(previousStep.evidenceRefs)) {
    throw new TypeError('dynamic composition source evidenceRefs must be an array');
  }
  return previousStep;
}

function normalizeComposition(step) {
  const config = step?.composition ?? {};
  if (!config || typeof config !== 'object' || Array.isArray(config)) throw new TypeError('step.composition must be an object');
  const mode = config.mode ?? 'deterministic';
  if (!DYNAMIC_COMPOSITION_MODES.includes(mode)) throw failClosed(`unsupported dynamic composition mode: ${String(mode)}`, 'dynamic_composition_mode_invalid');
  return Object.freeze({
    mode,
    heading: optionalText(config.heading, 'step.composition.heading', 120) ?? 'Workspace activity',
    prefixInput: optionalText(config.prefixInput, 'step.composition.prefixInput', 100),
    audience: optionalText(config.audience, 'step.composition.audience', 200),
    tone: optionalText(config.tone, 'step.composition.tone', 100),
    specialty: optionalText(config.ai?.specialty, 'step.composition.ai.specialty', 100) ?? 'reasoning',
    preferredModelId: optionalText(config.ai?.preferredModelId, 'step.composition.ai.preferredModelId', 200),
    maxOutputTokens: positiveInteger(config.ai?.maxOutputTokens, 'step.composition.ai.maxOutputTokens', 120),
    maxIntroCharacters: positiveInteger(config.ai?.maxIntroCharacters, 'step.composition.ai.maxIntroCharacters', 280)
  });
}

function validateAiIntro(value, maximum) {
  const text = optionalText(value, 'AI dynamic composition intro', maximum);
  if (/\p{N}/u.test(text)) {
    throw failClosed('AI dynamic composition intro must not contain numeric claims', 'dynamic_composition_ai_numeric_claim_denied');
  }
  return text;
}

export function isDynamicCompositionStep(step) {
  return step?.type === 'compose';
}

export function createRuntimeDynamicComposeHandler({ aiRouter = null, clock = () => new Date().toISOString() } = {}) {
  const currentClock = requiredFunction(clock, 'clock');
  if (aiRouter != null) requiredFunction(aiRouter.route, 'aiRouter.route');

  return async function runtimeDynamicComposeHandler(context = {}) {
    const step = context?.step;
    if (!isDynamicCompositionStep(step)) {
      throw failClosed('runtime dynamic composition accepts only compose steps', 'dynamic_composition_step_type_invalid');
    }
    if (!isProtectedWorkflowStep(step)) {
      throw failClosed('dynamic composition requires execution-time protected security', 'dynamic_composition_security_required');
    }
    if (context?.securityVerdict?.allowed !== true) {
      throw failClosed('dynamic composition requires a current allowed security verdict', 'dynamic_composition_security_not_current');
    }

    const source = normalizeSource(context);
    const config = normalizeComposition(step);
    const sourceOutput = source.output;
    const authoritativeFacts = Object.freeze({
      collectedAt: sourceOutput.collectedAt ?? null,
      data: sourceOutput.data ?? sourceOutput,
      sourceMetadata: sourceOutput.sourceMetadata ?? null,
      sourceStep: Object.freeze({ stepIndex: source.stepIndex, stepType: source.stepType, outcome: source.outcome })
    });
    const deterministicBody = renderActivityData(authoritativeFacts.data, authoritativeFacts.collectedAt);
    const composedAt = currentClock();
    if (typeof composedAt !== 'string' || composedAt.trim() === '') throw new TypeError('clock must return a non-empty timestamp string');

    let intro = null;
    let ai = null;
    const prefix = config.prefixInput == null ? null : optionalText(
      context.workflow?.inputs?.[config.prefixInput],
      `workflow.inputs.${config.prefixInput}`,
      4000
    );
    const evidenceRefs = [
      ...(source.evidenceRefs ?? []),
      'composition:runtime-source',
      'composition:deterministic-facts'
    ];
    if (prefix) evidenceRefs.push('composition:static-prefix');
    if (config.mode === 'ai-assisted') {
      if (aiRouter == null) throw failClosed('AI-assisted dynamic composition requires AI Router', 'dynamic_composition_ai_router_required');
      const traceId = optionalText(context.traceContext?.traceId, 'traceContext.traceId', 300);
      const requestId = optionalText(context.traceContext?.requestId, 'traceContext.requestId', 300);
      if (!traceId || !requestId) throw failClosed('AI-assisted dynamic composition requires trace and request IDs', 'dynamic_composition_ai_trace_required');
      const result = await aiRouter.route({
        task: 'response-composition',
        reason: 'automation-dynamic-composition',
        specialty: config.specialty,
        preferredModelId: config.preferredModelId,
        maxOutputTokens: config.maxOutputTokens,
        traceContext: { traceId, requestId },
        metadata: {
          context: 'automation-runtime-dynamic-composition',
          automationId: context.workflow?.automationId ?? null,
          workflowVersion: context.workflow?.version ?? null,
          stepIndex: context.stepIndex
        },
        messages: [
          {
            role: 'system',
            content: 'Write one short neutral introduction for a current activity report. Do not include digits, quantities, comparisons, metric values, identifiers or claims not supplied by deterministic code. Return introduction text only.'
          },
          {
            role: 'user',
            content: `Audience: ${config.audience ?? 'the authorized recipient'}\nTone: ${config.tone ?? 'clear and concise'}\nThe deterministic report follows separately; do not restate its facts.`
          }
        ]
      });
      intro = validateAiIntro(result?.text, config.maxIntroCharacters);
      ai = Object.freeze({
        provider: result.provider,
        model: result.model,
        costUsd: result.costUsd ?? null,
        reason: result.reason,
        traceId: result.traceId,
        requestId: result.requestId,
        attempts: result.attempts,
        fallbackUsed: result.fallbackUsed
      });
      evidenceRefs.push(`ai:${result.provider}:${result.model}`);
    }

    return Object.freeze({
      outcome: source.outcome,
      output: Object.freeze({
        message: [prefix, intro, config.heading, deterministicBody].filter(Boolean).join('\n\n'),
        authoritativeFacts,
        compositionMetadata: Object.freeze({
          mode: config.mode,
          composedAt,
          ai
        })
      }),
      evidenceRefs: Object.freeze(evidenceRefs),
      errorCode: null,
      errorMessage: null
    });
  };
}
