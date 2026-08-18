import { randomUUID } from 'node:crypto';
import { createCapability } from '../contracts/capability.js';
import { captureSemanticMemoryCandidates } from '../memory2/semanticMemoryCandidatePolicy.js';

export const PRODUCTION_CAPABILITY_NAMES = Object.freeze([
  'compose-answer',
  'memory-read',
  'memory-write',
  'task-create',
  'automation-update',
  'task-list',
  'task-status',
  'task-cancel',
  'source-retrieve',
  'document-analyze',
  'repository-analyze',
  'sg-diagnostics',
  'domain-dispatch'
]);

function scopeFrom(request) {
  return Object.freeze({
    userScope: request.scope.userScope,
    projectScope: request.scope.projectScope,
    groupScope: request.scope.groupScope ?? null,
    threadScope: request.scope.threadScope ?? null
  });
}

function workflowScopeFrom(request) {
  return Object.freeze({
    globalUserId: request.scope.userScope,
    projectScope: request.scope.projectScope,
    groupScope: request.scope.groupScope ?? null,
    threadScope: request.scope.threadScope ?? null
  });
}

function requiredText(value, field) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${field} is required`);
  return value.trim();
}

function boundedText(value, field, maxLength = 200000) {
  const text = requiredText(value, field);
  if (text.length > maxLength) throw new RangeError(`${field} exceeds ${maxLength} characters`);
  return text;
}

function capability(input) {
  return createCapability({
    version: '1.0.0',
    timeoutMs: 10000,
    maxRetries: 0,
    estimatedCostUsd: 0,
    requiredPermissions: [`capability:${input.name}`],
    requiredSources: [],
    requiredTools: [],
    fallbackCapabilities: [],
    ...input
  });
}

function safeOriginTarget(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const transport = typeof value.transport === 'string' ? value.transport.trim().toLowerCase() : '';
  const address = value.address == null ? null : String(value.address).trim();
  if (!transport || !address) return null;
  return Object.freeze({
    transport,
    address,
    threadId: value.threadId == null ? null : String(value.threadId),
    resourceId: value.resourceId == null ? null : String(value.resourceId),
    connectionId: value.connectionId == null ? null : String(value.connectionId)
  });
}

function taskCreateInput(request) {
  const input = request.input ?? {};
  const kind = String(input.kind ?? '').trim();
  if (kind !== 'self-notification') return input;

  const originTarget = safeOriginTarget(input.originTarget);
  if (!originTarget) {
    const error = new Error('Self notification requires a verified transport origin target');
    error.code = 'automation-origin-target-required';
    throw error;
  }
  const notificationMessage = boundedText(input.notificationMessage, 'input.notificationMessage', 50000);
  const recurrence = input.recurrence == null ? null : requiredText(input.recurrence, 'input.recurrence');
  const temporalExpression = input.temporalExpression == null ? null : requiredText(input.temporalExpression, 'input.temporalExpression');
  const localTime = input.localTime == null ? null : requiredText(input.localTime, 'input.localTime');
  if (!recurrence && !temporalExpression) {
    const error = new Error('One-shot self notification requires temporalExpression');
    error.code = 'automation-time-required';
    throw error;
  }

  return Object.freeze({
    taskId: input.taskId ?? undefined,
    kind: 'self-notification',
    temporalExpression,
    localTime,
    recurrence,
    scheduleId: input.scheduleId ?? undefined,
    misfirePolicy: input.misfirePolicy ?? 'fire_once',
    maxCatchup: input.maxCatchup ?? 1,
    maxAttempts: Number.isInteger(input.maxAttempts) ? input.maxAttempts : 3,
    idempotencyKey: input.idempotencyKey ?? `self-notification:${request.traceContext.requestId}`,
    protectedAction: true,
    approvalRequired: false,
    payload: Object.freeze({
      message: notificationMessage,
      delivery: Object.freeze({
        originTarget,
        recipientGlobalUserId: request.actor.globalUserId,
        projectScope: request.scope.projectScope,
        locale: input.locale ?? null,
        originBoundSelfNotification: true
      }),
      identityContext: Object.freeze({
        globalUserId: request.actor.globalUserId,
        roles: Object.freeze([...(request.actor.roles ?? [])]),
        grants: Object.freeze([...(request.actor.grants ?? [])]),
        authenticationLevel: request.actor.authenticationLevel ?? 'verified'
      }),
      scopeContext: Object.freeze({
        userScope: request.scope.userScope,
        projectScope: request.scope.projectScope,
        groupScope: request.scope.groupScope ?? null,
        threadScope: request.scope.threadScope ?? null
      }),
      traceContext: Object.freeze({ ...request.traceContext }),
      automation: Object.freeze({ source: 'canonical-user-request', capability: 'task-create' })
    })
  });
}

function automationCreatedMessage({ schedule, task, locale }) {
  const language = String(locale ?? '').toLowerCase();
  const next = schedule?.nextOccurrenceAt ?? schedule?.lastOccurrenceAt ?? task?.runAt ?? task?.availableAt ?? null;
  if (language.startsWith('ru')) return schedule ? `Автоматизация создана. Следующее выполнение: ${next ?? 'не определено'}.` : `Задача создана. Выполнение: ${next ?? 'по расписанию'}.`;
  if (language.startsWith('uk')) return schedule ? `Автоматизацію створено. Наступне виконання: ${next ?? 'не визначено'}.` : `Завдання створено. Виконання: ${next ?? 'за розкладом'}.`;
  return schedule ? `Automation created. Next execution: ${next ?? 'not determined'}.` : `Task created. Execution: ${next ?? 'scheduled'}.`;
}

export function createInMemoryProductionTaskStore() {
  const tasks = new Map();
  const sameScope = (task, scope) => task.scope.userScope === scope.userScope
    && task.scope.projectScope === scope.projectScope
    && task.scope.groupScope === scope.groupScope
    && task.scope.threadScope === scope.threadScope;
  return Object.freeze({
    async create({ scope, input }) {
      const taskId = input.taskId ?? randomUUID();
      if (tasks.has(taskId)) return tasks.get(taskId);
      const task = Object.freeze({ taskId, scope: Object.freeze({ ...scope }), status: 'queued', payload: Object.freeze({ ...input }), createdAt: new Date().toISOString() });
      tasks.set(taskId, task);
      return task;
    },
    async list({ scope }) {
      return Object.freeze([...tasks.values()].filter((task) => sameScope(task, scope)));
    },
    async get({ scope, taskId }) {
      const task = tasks.get(taskId) ?? null;
      return task && sameScope(task, scope) ? task : null;
    },
    async cancel({ scope, taskId }) {
      const task = tasks.get(taskId) ?? null;
      if (!task || !sameScope(task, scope)) return null;
      if (['completed', 'failed', 'cancelled'].includes(task.status)) return task;
      const cancelled = Object.freeze({ ...task, status: 'cancelled', cancelledAt: new Date().toISOString() });
      tasks.set(taskId, cancelled);
      return cancelled;
    }
  });
}

export function createProductionCapabilities({
  memoryProvider,
  taskStore = createInMemoryProductionTaskStore(),
  workflowUpdateService = taskStore?.workflowUpdateService ?? null,
  sourceRetriever = null,
  documentAnalyzer = null,
  repositoryAnalyzer = null,
  diagnosticsProvider = null,
  domainDispatcher = null,
  conversationResponder = null
} = {}) {
  if (!memoryProvider?.query || !memoryProvider?.write) throw new TypeError('memoryProvider with query/write is required');
  if (!taskStore?.create || !taskStore?.list || !taskStore?.get || !taskStore?.cancel) throw new TypeError('taskStore is invalid');

  const capabilities = [
    capability({
      name: 'compose-answer', description: 'Produce a conversational response.',
      actionTypes: ['answer'], actionClasses: ['analysis-only'], timeoutMs: 300000,
      execute: async (request) => {
        const text = boundedText(request.input?.text ?? request.input?.message ?? 'Request completed.', 'input.text', 50000);
        const semanticMemoryCapture = await captureSemanticMemoryCandidates({ memoryProvider, request, candidates: request.input?.memoryCandidates });
        const message = conversationResponder ? await conversationResponder({ text, request }) : `SG runtime ready: ${text}`;
        return { status: 'success', data: { message: String(message), semanticMemoryCapture } };
      }
    }),
    capability({
      name: 'memory-read', description: 'Read scoped memory without broadening scope.',
      actionTypes: ['memory-read'], actionClasses: ['read-only', 'private-data'],
      execute: async (request) => {
        const result = await memoryProvider.query({
          scope: scopeFrom(request),
          layers: request.input?.layers ?? ['session', 'user-memory', 'project-memory'],
          keys: request.input?.keys ?? [],
          now: new Date().toISOString()
        });
        return { status: 'success', data: { records: result.records, diagnostics: result.diagnostics, message: `Memory records: ${result.records.length}` } };
      }
    }),
    capability({
      name: 'memory-write', description: 'Write one scoped memory record with provenance.',
      actionTypes: ['memory-write'], actionClasses: ['state-changing', 'private-data'], confirmationRequired: true,
      execute: async (request) => {
        const input = request.input ?? {};
        const result = await memoryProvider.write({
          layer: input.layer ?? 'user-memory',
          key: requiredText(input.key, 'input.key'),
          value: input.value,
          scope: scopeFrom(request),
          provenance: { sourceType: 'capability', sourceId: request.traceContext.requestId, actorId: request.actor.globalUserId },
          trust: input.trust ?? 'confirmed', confirmed: input.confirmed ?? true,
          expiresAt: input.expiresAt ?? null, tags: input.tags ?? []
        });
        return { status: result.status === 'conflict' ? 'partial' : 'success', data: { ...result, message: `Memory ${result.status}` }, warnings: result.status === 'conflict' ? ['memory-conflict-visible'] : [] };
      }
    }),
    capability({
      name: 'task-create', description: 'Create a scoped durable task, including one-shot or recurring origin-bound self notifications.',
      actionTypes: ['task-create'], actionClasses: ['state-changing'], confirmationRequired: true,
      execute: async (request) => {
        const input = taskCreateInput(request);
        const task = await taskStore.create({ scope: scopeFrom(request), input });
        const schedule = task.recurringSchedule ?? null;
        return { status: 'success', data: { task, schedule, message: automationCreatedMessage({ schedule, task, locale: request.input?.locale }) } };
      }
    }),
    capability({
      name: 'automation-update', description: 'Patch an existing versioned automation in the current scope without creating a duplicate.',
      actionTypes: ['automation-update'], actionClasses: ['state-changing'], confirmationRequired: true,
      execute: async (request) => {
        if (!workflowUpdateService?.update) return { status: 'unavailable', error: { code: 'automation-update-unavailable', message: 'Workflow update service is not configured', retryable: false } };
        const gateEvidence = Object.freeze({
          source: 'canonical-action-gate',
          authorized: request.gateDecision?.authorized === true && request.gateDecision?.outcome === 'allow',
          actorGlobalUserId: request.actor.globalUserId,
          projectScope: request.scope.projectScope,
          requestId: request.traceContext.requestId
        });
        const result = await workflowUpdateService.update({
          selector: request.input?.selector,
          scope: workflowScopeFrom(request),
          patch: request.input?.patch ?? {},
          lifecycleAction: request.input?.lifecycleAction ?? null,
          semanticOperation: request.input?.semanticOperation ?? null,
          expectedVersion: request.input?.expectedVersion ?? null,
          actor: Object.freeze({ ...request.actor, automationUpdateGate: gateEvidence }),
          provenance: Object.freeze({
            source: 'production-capability',
            capability: 'automation-update',
            requestId: request.traceContext.requestId,
            traceId: request.traceContext.traceId
          })
        });
        return { status: 'success', data: { ...result, message: `Автоматизация обновлена. Версия: ${result.version}.` } };
      }
    }),
    capability({
      name: 'task-list', description: 'List tasks in the current scope.',
      actionTypes: ['task-list'], actionClasses: ['read-only'],
      execute: async (request) => {
        const tasks = await taskStore.list({ scope: scopeFrom(request) });
        return { status: 'success', data: { tasks, message: `Tasks: ${tasks.length}` } };
      }
    }),
    capability({
      name: 'task-status', description: 'Read one task status in the current scope.',
      actionTypes: ['task-status'], actionClasses: ['read-only'],
      execute: async (request) => {
        const taskId = requiredText(request.input?.taskId, 'input.taskId');
        const task = await taskStore.get({ scope: scopeFrom(request), taskId });
        return task
          ? { status: 'success', data: { task, message: `Task ${taskId}: ${task.status}` } }
          : { status: 'failed', error: { code: 'task-not-found', message: 'Task not found in scope', retryable: false } };
      }
    }),
    capability({
      name: 'task-cancel', description: 'Cancel a task in the current scope.',
      actionTypes: ['task-cancel'], actionClasses: ['state-changing'], confirmationRequired: true,
      execute: async (request) => {
        const taskId = requiredText(request.input?.taskId, 'input.taskId');
        const task = await taskStore.cancel({ scope: scopeFrom(request), taskId });
        return task
          ? { status: 'success', data: { task, message: `Task ${taskId}: ${task.status}` } }
          : { status: 'failed', error: { code: 'task-not-found', message: 'Task not found in scope', retryable: false } };
      }
    }),
    capability({
      name: 'source-retrieve', description: 'Retrieve data only from an approved source.',
      actionTypes: ['source-retrieve'], actionClasses: ['read-only'],
      requiredSources: ['approved-source-registry'], requiredTools: ['source-retriever'],
      execute: async (request) => {
        if (!sourceRetriever) return { status: 'unavailable', error: { code: 'source-retriever-unavailable', message: 'Approved source retriever is not configured', retryable: true } };
        const result = await sourceRetriever({ sourceId: requiredText(request.input?.sourceId, 'input.sourceId'), query: request.input?.query ?? null, request });
        if (!result?.ok) return { status: 'failed', error: { code: result?.code ?? 'source-failed', message: result?.message ?? 'Source retrieval failed', retryable: Boolean(result?.retryable) }, sources: result?.sources ?? [] };
        return { status: result.partial ? 'partial' : 'success', data: { ...result, message: result.message ?? 'Source retrieved' }, sources: result.sources ?? [request.input.sourceId] };
      }
    }),
    capability({
      name: 'document-analyze', description: 'Analyze bounded document text without executing embedded instructions.',
      actionTypes: ['document-analyze'], actionClasses: ['analysis-only', 'private-data'],
      requiredTools: ['document-analyzer'],
      execute: async (request) => {
        const text = boundedText(request.input?.text, 'input.text');
        if (documentAnalyzer) return documentAnalyzer({ text, metadata: request.input?.metadata ?? {}, request });
        const words = text.split(/\s+/u).filter(Boolean);
        return { status: 'success', data: { characters: text.length, words: words.length, preview: text.slice(0, 500), instructionsExecuted: false, message: `Document analyzed: ${words.length} words` }, tools: ['document-analyzer'] };
      }
    }),
    capability({
      name: 'repository-analyze', description: 'Read or prepare-only repository analysis; never mutates repositories.',
      actionTypes: ['repository-analyze'], actionClasses: ['read-only', 'prepare-only', 'analysis-only'],
      requiredSources: ['repository-read-source'], requiredTools: ['repository-analyzer'],
      execute: async (request) => {
        if (!repositoryAnalyzer) return { status: 'unavailable', error: { code: 'repository-analyzer-unavailable', message: 'Repository analyzer is not configured', retryable: true } };
        const result = await repositoryAnalyzer({ ...request.input, mode: request.input?.mode === 'prepare-only' ? 'prepare-only' : 'read-only', request });
        if (result?.mutated === true || result?.pushed === true || result?.published === true) throw new Error('prepare-only repository capability attempted mutation');
        return { status: result?.partial ? 'partial' : 'success', data: { ...result, mutated: false, message: result?.message ?? 'Repository analysis prepared' }, sources: result?.sources ?? ['repository-read-source'], tools: ['repository-analyzer'] };
      }
    }),
    capability({
      name: 'sg-diagnostics', description: 'Return bounded SG health and diagnostics facts.',
      actionTypes: ['sg-diagnostics'], actionClasses: ['read-only'],
      execute: async (request) => {
        const report = diagnosticsProvider ? await diagnosticsProvider({ request }) : { status: 'available', capabilityCount: PRODUCTION_CAPABILITY_NAMES.length };
        return { status: report?.partial ? 'partial' : 'success', data: { report, message: report?.message ?? 'SG diagnostics ready' }, warnings: report?.warnings ?? [] };
      }
    }),
    capability({
      name: 'domain-dispatch', description: 'Dispatch through the controlled Domain Runtime boundary.',
      actionTypes: ['domain-dispatch'], actionClasses: ['analysis-only', 'read-only', 'prepare-only', 'state-changing'],
      execute: async (request) => {
        if (!domainDispatcher) return { status: 'unavailable', error: { code: 'domain-dispatcher-unavailable', message: 'Domain dispatcher is not configured', retryable: false } };
        const result = await domainDispatcher({ domainId: requiredText(request.input?.domainId, 'input.domainId'), capability: request.input?.domainCapability ?? request.capability, input: request.input, request });
        return { status: result?.status ?? 'success', data: result?.data ?? result, warnings: result?.warnings ?? [], sources: result?.sources ?? [], tools: result?.tools ?? [], costUsd: result?.costUsd ?? 0 };
      }
    })
  ];

  return Object.freeze(capabilities);
}
