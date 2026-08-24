import { createPostgresTelegramWorkspaceOperationsStore } from './postgresWorkspaceOperationsStore.js';
import { createTelegramWorkspaceOperationsService, createScheduledContentTaskHandler } from './workspaceOperationsService.js';
import { createTelegramWorkspacePollUpdateHandler } from './telegramWorkspacePollUpdateHandler.js';
import { registerDeploymentTaskHandler } from '../automation/taskHandlerRegistry.js';

export function createTelegramWorkspaceProductionOperations({
  harness,
  botClient,
  workspaceRegistry,
  workspaceStore,
  authorityResolver,
  mutationGate,
  botCapabilityService,
  identityResolver
} = {}) {
  if (!harness?.persistence?.database) throw new TypeError('PostgreSQL persistence is required');
  if (!harness?.taskStore) throw new TypeError('production task store is required');
  if (!workspaceStore || !workspaceRegistry || !authorityResolver || !mutationGate || !botCapabilityService) return null;

  const store = createPostgresTelegramWorkspaceOperationsStore(harness.persistence.database);
  const audit = async (event) => {
    const correlation = event.traceId ?? event.requestId ?? `twm1.14-1.15:${event.workspaceId ?? 'unknown'}:${event.operation ?? 'operation'}`;
    return harness.observability.record({
      eventClass: 'audit_event',
      channel: 'audit',
      stage: 'telegram-workspace-operations',
      traceContext: {
        traceId: correlation,
        requestId: event.requestId ?? correlation,
        environment: harness.config.environment,
        revision: harness.config.revision
      },
      actorRef: event.actorGlobalUserId ?? null,
      outcome: event.outcome ?? 'observed',
      data: {
        operationsEventClass: event.eventClass ?? 'telegram_workspace_operations',
        operation: event.operation ?? null,
        domain: event.domain ?? null,
        recordId: event.recordId ?? null,
        workspaceId: event.workspaceId ?? null
      }
    });
  };

  const baseService = createTelegramWorkspaceOperationsService({
    store,
    workspaceRegistry,
    authorityResolver,
    mutationGate,
    botCapabilityService,
    botClient,
    taskStore: harness.taskStore,
    temporalService: harness.temporalService,
    projectScope: harness.config.projectScope,
    audit
  });
  const service = Object.freeze({
    ...baseService,
    conversationContextService: harness.conversationContextService ?? null
  });
  const scheduledContentHandler = registerDeploymentTaskHandler(harness, createScheduledContentTaskHandler(service));
  const pollUpdates = createTelegramWorkspacePollUpdateHandler({
    operationsService: service,
    identityResolver,
    projectScope: harness.config.projectScope,
    observability: harness.observability
  });

  return Object.freeze({ store, service, scheduledContentHandler, pollUpdates });
}
