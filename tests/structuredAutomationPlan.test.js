import test from 'node:test';
import assert from 'node:assert/strict';
import { createStructuredAutomationPlan, workflowStepsForStructuredPlan } from '../src/automation/structuredAutomationPlan.js';
import { createWorkflowRegisteredTaskStore } from '../src/automation/workflowRegisteredTaskStore.js';

const planInput = {
  trigger: { type: 'recurring', recurrence: 'FREQ=DAILY', localTime: '07:00' },
  action: { type: 'workspace-activity-report' },
  scope: { type: 'authorized-current-workspaces' },
  period: { type: 'previous-calendar-day' },
  metrics: ['messages-count', 'message-topics', 'polls-count', 'quizzes-count', 'poll-and-quiz-topics', 'active-participants'],
  delivery: { target: 'requester' }
};

test('Stage 4 canonicalizes a bounded structured automation plan', () => {
  const plan = createStructuredAutomationPlan(planInput);
  assert.equal(plan.version, 1);
  assert.equal(plan.action.type, 'workspace-activity-report');
  assert.equal(plan.period.type, 'previous-calendar-day');
  assert.equal(plan.delivery.target, 'requester');
  assert.deepEqual(workflowStepsForStructuredPlan(plan).map((step) => step.type), ['collect', 'compose', 'deliver']);
  assert.throws(() => createStructuredAutomationPlan({ ...planInput, action: { type: 'repeat-user-instruction' } }), /unsupported structured automation action/);
  assert.throws(() => createStructuredAutomationPlan({ ...planInput, trigger: { ...planInput.trigger, localTime: '7am' } }), /must be HH:MM/);
});

test('structured plan registers an executable AW2 workflow instead of a static self-notification', async () => {
  let createdRequest;
  let registered;
  const taskStore = {
    async create(request) {
      createdRequest = request;
      return {
        taskId: 'task-stage-4', createdAt: '2026-08-22T07:00:00.000Z', updatedAt: '2026-08-22T07:00:00.000Z',
        recurringSchedule: { scheduleId: 'schedule-stage-4', recurrence: 'FREQ=DAILY', timeZone: 'Europe/Kyiv', dtstartLocal: '2026-08-23T07:00:00' }
      };
    },
    async list() { return []; }, async get() { return null; }, async cancel() { return null; }
  };
  const store = createWorkflowRegisteredTaskStore({ taskStore, workflowStore: { async register(value) { registered = value; } } });
  const sourceText = 'Каждый день присылай отчёт активности за прошедший день';
  await store.create({
    scope: { userScope: 'user-1', projectScope: 'sg2.1', groupScope: null, threadScope: null },
    input: {
      kind: 'structured-automation', recurrence: 'FREQ=DAILY', localTime: '07:00', maxAttempts: 3,
      payload: { plan: planInput, delivery: { recipientGlobalUserId: 'user-1' }, traceContext: { traceId: 'trace-4' }, automation: { sourceText } }
    }
  });
  assert.equal(createdRequest.input.kind, 'structured-automation');
  assert.equal(createdRequest.input.payload.message, undefined);
  assert.deepEqual(registered.workflow.steps.map((step) => step.type), ['collect', 'compose', 'deliver']);
  assert.equal(registered.workflow.steps[0].action.type, 'workspace-activity-report');
  assert.equal(registered.workflow.inputs.plan.period.type, 'previous-calendar-day');
  assert.equal(JSON.stringify(registered.workflow.inputs).includes(sourceText), false);
  assert.equal(registered.workflow.provenance.sourceText, sourceText);
});
