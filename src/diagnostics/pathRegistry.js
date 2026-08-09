const PATHS = Object.freeze({
  conversation: Object.freeze({
    id: 'conversation-v1',
    stages: Object.freeze([
      ['transport.receive', ['request_received', 'telegram-webhook']],
      ['identity', ['identity_resolved', 'request_received']],
      ['context', ['user_settings_resolved', 'conversation_context_resolved', 'language_context_resolved', 'memory_context_resolved']],
      ['semantic', ['semantic_decision_created']],
      ['action-gate', ['action_gate_decision']],
      ['capability', ['capability_started', 'capability_completed', 'capability_failed']],
      ['ai', ['model_call']],
      ['response', ['final_response_guard', 'response_composed', 'capability_completed']],
      ['delivery', ['delivery_attempt', 'telegram_update_completed']]
    ])
  }),
  memory: Object.freeze({
    id: 'memory-v1',
    stages: Object.freeze([
      ['transport.receive', ['request_received']],
      ['identity', ['identity_resolved', 'request_received']],
      ['memory', ['memory_query_started', 'memory_query_completed', 'memory_capture']],
      ['semantic', ['semantic_decision_created']],
      ['action-gate', ['action_gate_decision']],
      ['capability', ['capability_started', 'capability_completed', 'capability_failed']],
      ['delivery', ['delivery_attempt', 'telegram_update_completed']]
    ])
  }),
  task: Object.freeze({
    id: 'task-v1',
    stages: Object.freeze([
      ['transport.receive', ['request_received']],
      ['identity', ['identity_resolved', 'request_received']],
      ['semantic', ['semantic_decision_created']],
      ['action-gate', ['action_gate_decision']],
      ['capability', ['capability_started', 'capability_completed', 'capability_failed']],
      ['persistence', ['task_created', 'task_updated', 'capability_completed']],
      ['delivery', ['delivery_attempt', 'telegram_update_completed']]
    ])
  }),
  worker: Object.freeze({
    id: 'worker-v1',
    stages: Object.freeze([
      ['worker.claim', ['task_claimed', 'worker_claim']],
      ['action-gate', ['action_gate_decision']],
      ['capability', ['capability_started', 'capability_completed', 'capability_failed']],
      ['persistence', ['task_completed', 'task_failed', 'execution_state']],
      ['delivery', ['delivery_attempt']]
    ])
  })
});

export function createExpectedPathRegistry({ paths = PATHS } = {}) {
  return Object.freeze({
    get(pathId = 'conversation') {
      const path = paths[pathId];
      if (!path) throw new TypeError(`Unknown diagnostic path: ${pathId}`);
      return path;
    },
    list() { return Object.freeze(Object.keys(paths)); },
    infer(evidence = []) {
      const names = new Set(evidence.flatMap((item) => [item.stage, item.payload?.eventClass, item.payload?.eventType].filter(Boolean)));
      if ([...names].some((value) => String(value).includes('worker') || String(value).includes('task_claim'))) return 'worker';
      if ([...names].some((value) => String(value).includes('memory'))) return 'memory';
      if ([...names].some((value) => String(value).includes('task'))) return 'task';
      return 'conversation';
    }
  });
}

export function eventNames(evidence) {
  return Object.freeze([
    evidence.stage,
    evidence.payload?.eventClass,
    evidence.payload?.eventType,
    evidence.payload?.data?.operationalEventType,
    evidence.payload?.data?.operationalEventClass
  ].filter(Boolean).map(String));
}
