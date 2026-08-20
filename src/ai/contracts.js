import { AIOutputValidationError } from './errors.js';
import { createTaskAssessment } from './taskAssessment.js';

export const AI_ROUTING_TIERS = Object.freeze(['L0', 'L1', 'L2', 'L3']);
export const AI_REASONING_EFFORTS = Object.freeze(['none', 'low', 'medium', 'high', 'xhigh', 'max']);

const MAX_ROUTING_LABEL_LENGTH = 128;
const MAX_ROUTING_CAPABILITIES = 32;

function object(value, field) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${field} must be an object`);
  return value;
}
function string(value, field) {
  if (typeof value !== 'string' || !value.trim()) throw new TypeError(`${field} must be a non-empty string`);
  return value.trim();
}
function nonNegative(value, field) {
  if (value == null) return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) throw new TypeError(`${field} must be a non-negative number`);
  return number;
}
function positiveInteger(value, field) {
  if (value == null) return null;
  const number = Number(value);
  if (!Number.isInteger(number) || number <= 0) throw new TypeError(`${field} must be a positive integer`);
  return number;
}
function boundedLabel(value, field) {
  const normalized = string(value, field);
  if (normalized.length > MAX_ROUTING_LABEL_LENGTH) throw new TypeError(`${field} must be at most ${MAX_ROUTING_LABEL_LENGTH} characters`);
  return normalized;
}
function optionalEnum(value, allowed, field) {
  if (value == null || value === '') return null;
  const normalized = string(value, field);
  if (!allowed.includes(normalized)) throw new TypeError(`${field} must be one of: ${allowed.join(', ')}`);
  return normalized;
}
function boundedLabels(value, field) {
  if (value == null) return Object.freeze([]);
  if (!Array.isArray(value)) throw new TypeError(`${field} must be an array`);
  if (value.length > MAX_ROUTING_CAPABILITIES) throw new TypeError(`${field} must contain at most ${MAX_ROUTING_CAPABILITIES} items`);
  return Object.freeze([...new Set(value.map((entry, index) => boundedLabel(entry, `${field}[${index}]`)))]);
}
export function createAIRoutingContract(input = {}, fallback = {}) {
  object(input, 'routing');
  const taskClass = boundedLabel(input.taskClass ?? fallback.task, 'routing.taskClass');
  const specialty = boundedLabel(input.specialty ?? fallback.specialty ?? 'reasoning', 'routing.specialty');
  const minimumTier = optionalEnum(input.minimumTier, AI_ROUTING_TIERS, 'routing.minimumTier');
  const maximumTier = optionalEnum(input.maximumTier, AI_ROUTING_TIERS, 'routing.maximumTier');
  if (minimumTier && maximumTier && AI_ROUTING_TIERS.indexOf(minimumTier) > AI_ROUTING_TIERS.indexOf(maximumTier)) {
    throw new TypeError('routing.minimumTier cannot exceed routing.maximumTier');
  }
  const assessment = input.assessment == null ? null : createTaskAssessment(object(input.assessment, 'routing.assessment').signals);
  const tierSelection = input.tierSelection == null ? null : Object.freeze({ ...object(input.tierSelection, 'routing.tierSelection') });
  const reasoningEffortSelection = input.reasoningEffortSelection == null ? null : Object.freeze({ ...object(input.reasoningEffortSelection, 'routing.reasoningEffortSelection') });
  return Object.freeze({
    taskClass,
    specialty,
    requiredCapabilities: boundedLabels(input.requiredCapabilities, 'routing.requiredCapabilities'),
    minimumTier,
    maximumTier,
    reasoningEffort: optionalEnum(input.reasoningEffort, AI_REASONING_EFFORTS, 'routing.reasoningEffort'),
    ...(assessment ? { assessment } : {}),
    ...(tierSelection ? { tierSelection } : {}),
    ...(reasoningEffortSelection ? { reasoningEffortSelection } : {}),
  });
}
function structuredJsonText(value) {
  const text = String(value ?? '').replace(/^\uFEFF/u, '').trim();
  const fenced = text.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/iu);
  return (fenced?.[1] ?? text).trim();
}
export function assertAIProvider(provider) {
  if (!provider || typeof provider.generate !== 'function') throw new TypeError('AI provider generate must be a function');
  return provider;
}
export function createAIRequest(input) {
  object(input, 'AI request');
  const task = string(input.task, 'task');
  return Object.freeze({
    task,
    reason: string(input.reason, 'reason'),
    messages: Object.freeze((input.messages ?? []).map((message, index) => Object.freeze({
      role: string(message.role, `messages[${index}].role`),
      content: string(message.content, `messages[${index}].content`),
    }))),
    responseFormat: input.responseFormat ? Object.freeze({ ...object(input.responseFormat, 'responseFormat') }) : null,
    validation: input.validation ? Object.freeze({ ...object(input.validation, 'validation') }) : null,
    maxOutputTokens: positiveInteger(input.maxOutputTokens, 'maxOutputTokens'),
    traceContext: Object.freeze({ ...object(input.traceContext, 'traceContext') }),
    metadata: Object.freeze({ ...(input.metadata ?? {}) }),
    routing: createAIRoutingContract(input.routing ?? {}, { task, specialty: input.specialty }),
  });
}
export function createAIResult(input) {
  object(input, 'AI result');
  return Object.freeze({
    text: string(input.text, 'text'),
    provider: string(input.provider, 'provider'),
    model: string(input.model, 'model'),
    ...(input.tier == null ? {} : { tier: optionalEnum(input.tier, ['L1', 'L2', 'L3'], 'tier') }),
    ...(input.reasoningEffort == null ? {} : { reasoningEffort: optionalEnum(input.reasoningEffort, AI_REASONING_EFFORTS, 'reasoningEffort') }),
    latencyMs: nonNegative(input.latencyMs, 'latencyMs'),
    usage: Object.freeze({
      inputTokens: nonNegative(input.usage?.inputTokens, 'usage.inputTokens'),
      outputTokens: nonNegative(input.usage?.outputTokens, 'usage.outputTokens'),
      totalTokens: nonNegative(input.usage?.totalTokens, 'usage.totalTokens'),
    }),
    costUsd: nonNegative(input.costUsd, 'costUsd'),
    traceId: string(input.traceId, 'traceId'),
    requestId: string(input.requestId, 'requestId'),
    reason: string(input.reason, 'reason'),
    attempts: nonNegative(input.attempts ?? 1, 'attempts'),
    fallbackUsed: Boolean(input.fallbackUsed),
    ...(input.validation == null ? {} : { validation: Object.freeze({ ...object(input.validation, 'validation') }) }),
    rawMetadata: Object.freeze({ ...(input.rawMetadata ?? {}) }),
  });
}
export function parseStructuredAIOutput(result) {
  try {
    return object(JSON.parse(structuredJsonText(result?.text)), 'structured AI output');
  } catch (cause) {
    if (cause instanceof AIOutputValidationError) throw cause;
    throw new AIOutputValidationError('AI provider returned invalid JSON', { cause });
  }
}
