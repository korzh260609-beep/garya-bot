import { parseStructuredAIOutput } from './contracts.js';
import { createSemanticInterpretation } from '../contracts/semantic.js';
import { buildDefensivePromptBoundary, deterministicAiFallback } from './productionPolicy.js';
import { PRODUCTION_CAPABILITY_NAMES } from '../capability/productionCapabilities.js';
import { MEMORY2_CAPABILITY_NAMES } from '../memory2/memory2Capabilities.js';
import { TEMPORAL_CAPABILITY_NAMES } from '../temporal/temporalCapabilities.js';
import { LANGUAGE_CAPABILITY_NAMES } from '../language/languageCapabilities.js';
import { USER_SETTINGS_CAPABILITY_NAMES } from '../settings/userSettingsCapabilities.js';

const SEMANTIC_CAPABILITY_NAMES = Object.freeze([...new Set([
  ...PRODUCTION_CAPABILITY_NAMES,
  ...MEMORY2_CAPABILITY_NAMES,
  ...TEMPORAL_CAPABILITY_NAMES,
  ...LANGUAGE_CAPABILITY_NAMES,
  ...USER_SETTINGS_CAPABILITY_NAMES,
])]);

const NAMED_VALUE_SCHEMA = Object.freeze({
  type: 'object', additionalProperties: false, required: ['name', 'value'],
  properties: { name: { type: 'string', minLength: 1 }, value: { type: 'string' } },
});
const MEMORY_CANDIDATE_SCHEMA = Object.freeze({
  type: 'object', additionalProperties: false, required: ['key', 'value', 'scopeKind', 'shared', 'tags'],
  properties: { key: { type: 'string', minLength: 1 }, value: { type: 'string', minLength: 1 }, scopeKind: { type: 'string', enum: ['user', 'user-group'] }, shared: { type: 'boolean' }, tags: { type: 'array', items: { type: 'string' } } },
});
const CONVERSATION_HISTORY_QUERY_SCHEMA = Object.freeze({
  anyOf: [
    { type: 'null' },
    {
      type: 'object', additionalProperties: false, required: ['query', 'temporalExpression', 'scope', 'maxRecords'],
      properties: {
        query: { type: 'string', minLength: 1, maxLength: 2000 },
        temporalExpression: { type: ['string', 'null'], maxLength: 300 },
        scope: { type: 'string', enum: ['current-scope', 'current-conversation', 'current-topic'] },
        maxRecords: { type: 'integer', minimum: 1, maximum: 200 }
      }
    }
  ]
});
const SUBSYSTEM_REQUEST_SCHEMA = Object.freeze({
  anyOf: [
    { type: 'null' },
    { type: 'object', additionalProperties: false, required: ['name', 'operation'], properties: { name: { type: 'string', enum: ['telegram-workspace-manager'] }, operation: { type: 'string', enum: ['configure', 'configuration-history'] } } }
  ]
});
const CANDIDATE_ACTION_SCHEMA = Object.freeze({
  type: 'object', additionalProperties: false, required: ['type', 'name', 'actionClass'],
  properties: { type: { type: 'string', minLength: 1 }, name: { type: 'string', enum: SEMANTIC_CAPABILITY_NAMES }, actionClass: { type: 'string', enum: ['analysis', 'read-only', 'external', 'state-change'] }, payload: { type: 'object', additionalProperties: true } },
});
const SEMANTIC_SCHEMA = Object.freeze({
  type: 'object', additionalProperties: false,
  required: ['meaning', 'goal', 'intent', 'entities', 'constraints', 'uncertainty', 'missingInformation', 'clarificationQuestion', 'contextNeeds', 'evidenceNeeds', 'memoryQuery', 'conversationHistoryQuery', 'subsystemRequest', 'memoryCandidates', 'candidateActions', 'rationale'],
  properties: {
    meaning: { type: 'string', minLength: 1 }, goal: { type: 'string', minLength: 1 }, intent: { type: 'string', minLength: 1 },
    entities: { type: 'array', items: NAMED_VALUE_SCHEMA }, constraints: { type: 'array', items: NAMED_VALUE_SCHEMA }, uncertainty: { type: 'number', minimum: 0, maximum: 1 },
    missingInformation: { type: 'array', items: { type: 'string' } }, clarificationQuestion: { type: ['string', 'null'] }, contextNeeds: { type: 'array', items: { type: 'string' } }, evidenceNeeds: { type: 'array', items: { type: 'string' } },
    memoryQuery: { type: ['string', 'null'] }, conversationHistoryQuery: CONVERSATION_HISTORY_QUERY_SCHEMA, subsystemRequest: SUBSYSTEM_REQUEST_SCHEMA,
    memoryCandidates: { type: 'array', items: MEMORY_CANDIDATE_SCHEMA }, candidateActions: { type: 'array', items: CANDIDATE_ACTION_SCHEMA }, rationale: { type: ['string', 'null'] },
  },
});

const AUTOMATION_ROUTING_PRIORITY = `PRIORITY AUTOMATION ROUTING RULES:
- A request to modify what an existing task/automation sends or does is an executable state change, never a conversational capability explanation.
- When the requested modification adds current activity from Telegram groups/workspaces where SG and the user currently have authorized access, select automation-update and emit payload.semanticOperation={"type":"add-workspace-activity","data":{"workspaceSelection":"authorized-current"}}.
- Identify the existing target only from attributes the user actually supplied, such as its current localTime or notificationMessage. Do not require workspace IDs, do not claim that SG lacks a group list, and do not replace execution with compose-answer merely because activity must be collected later.
- When the user identifies an existing automation by its current wall-clock time, use selector.localTime. Do not also turn a short unquoted content fragment into selector.notificationMessage as though it were the complete stored notification text. Include notificationMessage only when the user clearly identifies the target by its full existing message. The deterministic resolver must handle zero or multiple time matches without guessing.
- The runtime, not the semantic interpreter, resolves authorized-current at execution time and independently reauthorizes every workspace.
- If one scoped automation matches, update it. If zero or multiple match, let the deterministic resolver return the safe clarification. Never invent a limitation or a second automation.`;

function semanticConversationContext(canonicalInput) {
  const recentTurns = canonicalInput.metadata?.conversationContext?.recentTurns;
  if (!Array.isArray(recentTurns) || recentTurns.length === 0) return null;
  return Object.freeze({
    recentTurns: Object.freeze(recentTurns.slice(-12).flatMap((turn) => {
      if (!turn || typeof turn.text !== 'string' || turn.text.trim() === '') return [];
      const direction = turn.direction === 'outbound' ? 'assistant' : turn.direction === 'inbound' ? 'user' : 'unknown';
      return [Object.freeze({ direction, text: turn.text.slice(0, 4000) })];
    }))
  });
}
function buildUserPayload(canonicalInput) {
  return Object.freeze({ text: canonicalInput.text, locale: canonicalInput.locale, languageContext: canonicalInput.metadata?.languageContext ?? null, scope: canonicalInput.scopeContext, context: canonicalInput.metadata?.contextBundle ?? null, conversationContext: semanticConversationContext(canonicalInput), temporalContext: canonicalInput.metadata?.temporalContext ?? null, temporalResolution: canonicalInput.metadata?.temporalResolution ?? null });
}
function nonEmptyString(value) {
  return typeof value === 'string' && value.trim() !== '';
}
function deterministicExactTemporalExpression(canonicalInput) {
  const resolution = canonicalInput?.metadata?.temporalResolution;
  if (resolution?.status !== 'resolved' || resolution.ambiguous === true || !nonEmptyString(resolution.utcStart) || resolution.utcEndExclusive) return null;
  if (!['second', 'minute', 'hour'].includes(resolution.precision)) return null;
  return nonEmptyString(resolution.originalExpression) ? resolution.originalExpression.trim() : null;
}
function canonicalizeAutomationCandidate(action, canonicalInput) {
  if (!action || action.name !== 'task-create' || !action.payload || typeof action.payload !== 'object' || Array.isArray(action.payload)) return action;
  const payload = action.payload;
  if (payload.kind != null && payload.kind !== 'self-notification') return action;
  const recurrence = nonEmptyString(payload.recurrence) ? payload.recurrence.trim() : null;
  const temporalExpression = nonEmptyString(payload.temporalExpression)
    ? payload.temporalExpression.trim()
    : recurrence
      ? null
      : deterministicExactTemporalExpression(canonicalInput);
  const hasSchedule = Boolean(temporalExpression || recurrence);
  const notificationMessage = nonEmptyString(payload.notificationMessage)
    ? payload.notificationMessage.trim()
    : nonEmptyString(payload.message)
      ? payload.message.trim()
      : null;
  if (!hasSchedule || !notificationMessage) return action;
  return Object.freeze({
    ...action,
    actionClass: 'state-change',
    payload: Object.freeze({
      ...payload,
      kind: 'self-notification',
      notificationMessage,
      ...(temporalExpression ? { temporalExpression } : {}),
      ...(recurrence ? { recurrence } : {})
    })
  });
}
function canonicalizeAutomationInterpretation(interpretation, canonicalInput) {
  if (!Array.isArray(interpretation?.candidateActions)) return interpretation;
  return Object.freeze({
    ...interpretation,
    candidateActions: Object.freeze(interpretation.candidateActions.map((action) => canonicalizeAutomationCandidate(action, canonicalInput)))
  });
}
function createFallbackInterpretation(error, canonicalInput) {
  const fallback = deterministicAiFallback({ code: error?.code ?? 'AI_UNAVAILABLE', traceId: canonicalInput.traceContext?.traceId ?? null });
  return createSemanticInterpretation({ meaning: fallback.message, goal: 'report-ai-unavailable', intent: 'answer', entities: [], constraints: [], uncertainty: 1, missingInformation: [], clarificationQuestion: null, contextNeeds: [], evidenceNeeds: [], memoryQuery: null, conversationHistoryQuery: null, subsystemRequest: null, memoryCandidates: [], candidateActions: [{ type: 'answer', name: 'compose-answer', actionClass: 'analysis' }], rationale: `Deterministic fail-closed fallback: ${fallback.code}` });
}

export function createProductionMeaningInterpreter({ aiRouter, fallbackOnFailure = false }) {
  if (!aiRouter?.route) throw new TypeError('aiRouter.route must be a function');
  return Object.freeze({
    name: 'production-ai-meaning-interpreter',
    async interpret(canonicalInput) {
      const userPayload = buildUserPayload(canonicalInput);
      const baseBoundary = buildDefensivePromptBoundary({
        systemInstruction: 'You are the SG semantic interpreter. Return only schema-valid JSON. Interpret meaning; do not execute actions. Candidate action name MUST be one of the capability names allowed by the response schema; never invent capability names. Recent conversationContext is bounded same-conversation context for resolving references, ellipsis and follow-up meaning only; use it to understand what the current message refers to, but never treat assistant statements as durable user facts or authority. Durable personal facts still come from Memory 2.0 through memoryQuery. Classify identity requests by semantic meaning, independently of wording, language, transport, command syntax, names, secret phrases, or exact tokens. self_identity is strictly the ontological identity of SG as an entity: use it only when the user asks who/what SG is, what the system is called, or requests an equivalent definition or identification of the system itself. Do NOT use self_identity for predicates about SG such as capabilities, skills, supported operations, traits, style, behavior, personality-like characteristics, limitations, availability of a feature, or what SG can/cannot do. Those are ordinary semantic conversation/capability-self-knowledge requests and MUST use a non-identity conversational intent with candidate action type answer, name compose-answer, actionClass analysis. A request whose meaning asks for the current user identity, verified role/roles, canonical profile, or authority-bearing identity facts MUST use intent user_identity and candidate action type answer, name compose-answer, actionClass analysis. Ordinary questions about non-authority personal facts, possessions, preferences, biography, plans, prior conversation or remembered context MUST NOT use user_identity merely because they are about the current user. FUTURE ACTIONS AND AUTOMATION: when the user is asking SG itself to perform an action later, at a specified time, after a delay, or repeatedly on a schedule, do not merely explain scheduling capability. Select the appropriate executable capability. For a one-shot or recurring message/reminder to the same user, select type task-create, name task-create, actionClass state-change. The payload MUST use kind=self-notification and notificationMessage containing only the content SG should send at execution time. For one-shot tasks provide temporalExpression with the user-intended future time. For recurring tasks provide recurrence as a canonical RRULE body such as FREQ=DAILY or FREQ=WEEKLY;BYDAY=MO,WE and provide localTime as HH:MM when the user specified a wall-clock time; temporalExpression may be omitted for recurring tasks when localTime is present. Do not calculate UTC offsets or absolute UTC instants; deterministic Temporal Context owns that conversion. Preserve the requested cadence and local wall-clock semantics. Use misfirePolicy=fire_once unless the user explicitly requests catch-up or skipping missed occurrences. If an essential scheduling parameter is genuinely missing, ask at most one clarification and use compose-answer rather than inventing it. Requests to list recurring schedules use type schedule-list, name schedule-list, actionClass read-only. When the user explicitly limits the list by lifecycle status, set payload.statuses to an array containing only the expressed canonical values active, paused, cancelled or error; otherwise omit statuses. Do not infer a status that was not expressed. Inspect one uses type schedule-status, name schedule-status, actionClass read-only; pause uses schedule-pause; resume uses schedule-resume; cancel a recurring schedule uses schedule-cancel. EXISTING RECURRING AUTOMATION TARGETS: lifecycle operations on an existing recurring self-notification MUST identify the target semantically, not by requiring the user to know an internal id. If the user explicitly supplied a valid scheduleId, preserve it. Otherwise put only the target attributes actually expressed by the user into payload.selector using recurrence, notificationMessage and/or localTime. recurrence in selector describes the EXISTING cadence and MUST be a canonical RRULE body; notificationMessage describes the content the existing automation sends; localTime is HH:MM when the existing target is identified by its wall-clock time. Never invent a scheduleId or selector attribute. The deterministic scoped schedule resolver owns the final identity match and must fail closed when zero or multiple schedules match. Personal automation lifecycle is runtime behavior, so subsystemRequest MUST be null for create/list/status/update/pause/resume/cancel of the user own reminders or recurring notifications. A request to change, move, reschedule or otherwise modify the timing or cadence of an EXISTING recurring schedule MUST use schedule-update rather than task-create. For schedule-update, payload.selector describes the EXISTING target, while top-level payload.localTime, payload.recurrence and payload.timeZone describe only the NEW requested schedule values. Never use the new cadence as the selector for the old schedule unless the user explicitly says the existing schedule already has that cadence. Never create a second recurring task to represent an update to an existing schedule. EXECUTABLE WORKFLOW LIFECYCLE: when the user asks to change what an existing automation does, add or remove a workflow part, also collect/check a source, replace its behavior, change its output style, change cadence/time, pause/resume/cancel it, or restore an earlier workflow version, select type automation-update, name automation-update, actionClass state-change. payload.selector identifies only the EXISTING target with the structured semantic selector rules above. payload.semanticOperation MUST be one typed object {type,data}; type is exactly one of add-step, remove-step, replace-workflow, change-output-style, change-trigger, pause, resume, cancel, restore-version. For add-step data.step is a canonical typed workflow step and optional data.position is structured; remove-step data.target uses an explicit step index or a step type that must resolve uniquely; replace-workflow data supplies canonical steps and optional inputs/delivery/executionPolicy; change-output-style data uses deliveryPatch and/or composePatch; change-trigger data.trigger is the complete new canonical trigger; pause/resume/cancel use empty data; restore-version data.version is an earlier numeric version. Preserve only facts actually expressed by the user, never invent selectors, step configuration, targets, cadence, versions or authority. If essential operation data is missing, ask one clarification. Do not parse lifecycle by exact phrase or keyword tables: infer semantic meaning and emit this typed contract; deterministic runtime validation owns the final mutation and ambiguity checks. Requests to list/status a non-recurring task use the matching task capability with actionClass read-only; cancellation is state-changing. Conversation History and Memory 2.0 are distinct retrieval systems. Use conversationHistoryQuery ONLY when the requested answer depends on actual prior conversation messages. conversationHistoryQuery.query is a concise semantic description of which prior discussion is needed AND MUST preserve the retrieval objective by meaning: whether the user wants an overview/topics across a range, relevant evidence about a subject, or the earliest/first occurrence of a subject. Do not collapse an earliest-occurrence request into a generic topic query. If the user expresses a time period, copy only that temporal expression into temporalExpression; do not calculate dates yourself. Temporal Context/temporalResolution is authoritative for normalized ranges. Choose current-scope for history that may span topics/conversations in the same authorized user/project/group/thread scope, current-conversation when explicitly limited to this conversation, and current-topic only when explicitly limited to this topic. For conversation-history recall, include conversation-history in contextNeeds, keep memoryQuery null unless durable Memory 2.0 facts are independently needed, and keep the final candidate action type answer, name compose-answer, actionClass analysis. Never substitute Memory 2.0 for Conversation History. Use memoryQuery only for durable remembered knowledge/facts appropriate to Memory 2.0. A memory lookup that returns zero records is valid absence of context, not an execution failure. subsystemRequest is normally null; use telegram-workspace-manager only when the meaning is genuinely to configure a managed Telegram workspace/group/channel or inspect its configuration-change history. Ordinary conversation history, user memory, project-development history, general Telegram questions, and ordinary personal reminders MUST have subsystemRequest=null. Classify requests about the development biography of SG or project components using project_development_* semantic intents only when genuinely about project development, never ordinary remembered conversation. Other ordinary conversational requests use type answer, name compose-answer, actionClass analysis. For ordinary user statements, propose zero or more durable factual memoryCandidates only for useful non-secret facts actually asserted by the user; never infer roles, permissions, authority, credentials or secrets. Automatic Memory 2.0 persistence remains reported and unconfirmed. Language Context is authoritative for response-language metadata but original text remains authoritative for meaning. Temporal Context is authoritative for current time, timezone and normalized relative dates; never recalculate or guess those values. Read-only requests MUST use actionClass read-only when selecting a read-only capability. External or state-changing requests must be candidates with actionClass external or state-change. Ask one clarification only when essential information is missing; otherwise answer with known/unknown/uncertain state naturally.',
        userInput: JSON.stringify(userPayload),
      });
      const boundary = Object.freeze({
        ...baseBoundary,
        system: baseBoundary.system.replace(
          'add-step, remove-step, replace-workflow',
          'add-step, add-workspace-activity, remove-step, replace-workflow'
        )
      });
      try {
        const result = await aiRouter.route({ task: 'semantic-interpretation', specialty: 'semantic-interpretation', reason: 'Interpret canonical user meaning for Semantic Kernel', traceContext: canonicalInput.traceContext, identityContext: canonicalInput.identityContext, role: canonicalInput.identityContext?.roles?.[0] ?? 'guest', messages: [{ role: 'system', content: `${AUTOMATION_ROUTING_PRIORITY}\n\n${boundary.system}\n\nRecurring automation identifiers are internal. Never ask the user to read, copy or choose a scheduleId. If the user explicitly refers to a numbered automation from a previously displayed list (for example first, second or number 2), put that one-based number in payload.selector.position. Use position only when the user expressed it; never invent it. The scoped resolver must still fail closed when no explicit position or other selector uniquely identifies a target.` }, { role: 'user', content: boundary.user }], responseFormat: { name: 'semantic_interpretation', jsonSchema: SEMANTIC_SCHEMA, strict: false }, metadata: { locale: canonicalInput.locale, languageContext: canonicalInput.metadata?.languageContext ?? null, roles: canonicalInput.identityContext?.roles ?? [], context: userPayload } });
        return createSemanticInterpretation(canonicalizeAutomationInterpretation(parseStructuredAIOutput(result), canonicalInput));
      } catch (error) {
        if (!fallbackOnFailure) throw error;
        return createFallbackInterpretation(error, canonicalInput);
      }
    },
  });
}
