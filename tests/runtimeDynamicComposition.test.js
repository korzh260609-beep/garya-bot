import test from 'node:test';
import assert from 'node:assert/strict';
import { createRuntimeDynamicComposeHandler } from '../src/automation/runtimeDynamicComposition.js';

const W1 = 'tgw_aw214one';
const W2 = 'tgw_aw214two';

function context({ mode = 'deterministic', outcome = 'completed', data, ai = {}, handoff = null } = {}) {
  return {
    taskId: 'task:aw214',
    workflow: {
      automationId: 'automation:aw214',
      version: 4,
      scope: { globalUserId: 'user:aw214', projectScope: 'sg2.1' },
      inputs: { stalePreparedText: 'do not use' }
    },
    step: {
      type: 'compose',
      security: { protected: true },
      composition: {
        mode,
        heading: 'Current workspace activity',
        audience: 'workspace owner',
        tone: 'concise',
        ai
      }
    },
    stepIndex: 1,
    handoff: handoff ?? {
      previousStep: {
        stepIndex: 0,
        stepType: 'collect',
        outcome,
        output: {
          collectedAt: '2026-08-17T15:00:00.000Z',
          data: data ?? {
            requestedWorkspaceIds: [W1, W2],
            workspaces: [
              { workspaceId: W1, data: { interactions: { uniqueActors: 4 } } },
              { workspaceId: W2, data: { interactions: { uniqueActors: 5 } } }
            ],
            omissions: [],
            totals: {
              publications: 3,
              polls: 2,
              tests: 1,
              interactionEvents: 9,
              activityEvents: { 'content.published': 3 }
            }
          },
          sourceMetadata: { aggregation: 'authorized-available-workspaces-only' }
        },
        evidenceRefs: ['workspace:activity']
      }
    },
    securityVerdict: { allowed: true, evidenceRefs: ['security:compose'] },
    traceContext: { traceId: 'trace:aw214', requestId: 'request:aw214' }
  };
}

test('AW2.14 deterministically composes current runtime metrics without stored workflow inputs', async () => {
  const handler = createRuntimeDynamicComposeHandler({ clock: () => '2026-08-17T15:00:01.000Z' });
  const result = await handler(context());

  assert.equal(result.outcome, 'completed');
  assert.match(result.output.message, /Publications: 3/);
  assert.match(result.output.message, /Interaction events: 9/);
  assert.match(result.output.message, new RegExp(`${W1}; unique actors: 4`));
  assert.match(result.output.message, new RegExp(`${W2}; unique actors: 5`));
  assert.equal(result.output.message.includes('do not use'), false);
  assert.equal(result.output.authoritativeFacts.data.totals.publications, 3);
  assert.equal('uniqueActors' in result.output.authoritativeFacts.data.totals, false);
  assert.deepEqual(result.evidenceRefs, ['workspace:activity', 'composition:runtime-source', 'composition:deterministic-facts']);
});

test('dynamic composition preserves an explicitly configured notification prefix and uses workspace titles instead of internal ids', async () => {
  const handler = createRuntimeDynamicComposeHandler({ clock: () => '2026-08-17T15:00:01.000Z' });
  const value = context({ data: {
    workspaces: [{ workspaceId: W1, workspaceTitle: 'Монаршая группа', data: { interactions: { uniqueActors: 4 } } }],
    omissions: [],
    totals: { publications: 3, polls: 0, tests: 0, interactionEvents: 4, activityEvents: {} }
  } });
  value.workflow.inputs.message = 'ПРИВЕТ МОНАРХ';
  value.step.composition.prefixInput = 'message';
  const result = await handler(value);
  assert.match(result.output.message, /^ПРИВЕТ МОНАРХ/);
  assert.match(result.output.message, /Монаршая группа/);
  assert.equal(result.output.message.includes(W1), false);
  assert.ok(result.evidenceRefs.includes('composition:static-prefix'));
});

test('AW2.14 preserves partial outcome and renders denied or unavailable workspaces as explicit omissions', async () => {
  const handler = createRuntimeDynamicComposeHandler();
  const data = {
    workspaces: [{ workspaceId: W1, data: { interactions: { uniqueActors: 2 } } }],
    totals: { publications: 1, polls: 0, tests: 0, interactionEvents: 2, activityEvents: {} },
    omissions: [{ workspaceId: W2, reason: 'workspace-collection-unavailable', errorCode: 'workspace_store_unavailable' }]
  };
  const result = await handler(context({ outcome: 'partial', data }));

  assert.equal(result.outcome, 'partial');
  assert.match(result.output.message, /Omissions:/);
  assert.match(result.output.message, new RegExp(`${W2}: workspace-collection-unavailable \\(workspace_store_unavailable\\)`));
  assert.deepEqual(result.output.authoritativeFacts.data.omissions, data.omissions);
});

test('AW2.14 AI-assisted mode uses AI Router with cost/reason evidence while deterministic code owns all metrics', async () => {
  const calls = [];
  const handler = createRuntimeDynamicComposeHandler({
    clock: () => '2026-08-17T15:00:01.000Z',
    aiRouter: {
      async route(request) {
        calls.push(request);
        return {
          text: 'Here is the current authorized activity summary.',
          provider: 'openai',
          model: 'gpt-test',
          costUsd: 0.002,
          reason: request.reason,
          traceId: request.traceContext.traceId,
          requestId: request.traceContext.requestId,
          attempts: 1,
          fallbackUsed: false
        };
      }
    }
  });

  const result = await handler(context({ mode: 'ai-assisted', ai: { maxOutputTokens: 80 } }));

  assert.equal(calls.length, 1);
  assert.equal(calls[0].task, 'response-composition');
  assert.equal(calls[0].reason, 'automation-dynamic-composition');
  assert.deepEqual(calls[0].traceContext, { traceId: 'trace:aw214', requestId: 'request:aw214' });
  assert.equal(calls[0].messages.some((message) => message.content.includes('publications')), false);
  assert.match(result.output.message, /^Here is the current authorized activity summary\./);
  assert.match(result.output.message, /Publications: 3/);
  assert.equal(result.output.compositionMetadata.ai.costUsd, 0.002);
  assert.equal(result.output.compositionMetadata.ai.reason, 'automation-dynamic-composition');
  assert.deepEqual(result.evidenceRefs, ['workspace:activity', 'composition:runtime-source', 'composition:deterministic-facts', 'ai:openai:gpt-test']);
});

test('AW2.14 rejects an AI intro containing invented numeric claims before it reaches the final message', async () => {
  const handler = createRuntimeDynamicComposeHandler({
    aiRouter: {
      async route(request) {
        return {
          text: 'Activity increased by 99 percent.',
          provider: 'openai', model: 'gpt-test', costUsd: 0.001,
          reason: request.reason, traceId: request.traceContext.traceId, requestId: request.traceContext.requestId,
          attempts: 1, fallbackUsed: false
        };
      }
    }
  });

  await assert.rejects(
    () => handler(context({ mode: 'ai-assisted' })),
    (error) => error.code === 'dynamic_composition_ai_numeric_claim_denied'
  );
});

test('AW2.14 fails closed for wrong step/security, stale initial handoff, truncated evidence and missing AI Router', async () => {
  const handler = createRuntimeDynamicComposeHandler();
  await assert.rejects(
    () => handler({ ...context(), step: { type: 'analyze', security: { protected: true } } }),
    (error) => error.code === 'dynamic_composition_step_type_invalid'
  );
  await assert.rejects(
    () => handler({ ...context(), step: { type: 'compose', composition: {} } }),
    (error) => error.code === 'dynamic_composition_security_required'
  );
  await assert.rejects(
    () => handler({ ...context(), securityVerdict: { allowed: false } }),
    (error) => error.code === 'dynamic_composition_security_not_current'
  );
  await assert.rejects(
    () => handler(context({ handoff: { workflowInputs: { stale: true } } })),
    (error) => error.code === 'dynamic_composition_fresh_source_required'
  );
  await assert.rejects(
    () => handler(context({ handoff: { truncated: true, preview: '{}' } })),
    (error) => error.code === 'dynamic_composition_runtime_handoff_required'
  );
  await assert.rejects(
    () => handler(context({ mode: 'ai-assisted' })),
    (error) => error.code === 'dynamic_composition_ai_router_required'
  );
});
