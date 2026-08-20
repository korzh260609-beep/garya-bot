import test from 'node:test';
import assert from 'node:assert/strict';
import { createTaskAssessment } from '../src/ai/taskAssessment.js';
import { createAIRouter } from '../src/ai/router.js';
import { createModelRegistry } from '../src/ai/modelRegistry.js';
import { createInMemoryAITelemetry } from '../src/ai/telemetry.js';

const traceContext = { traceId: 'trace-ar24', requestId: 'request-ar24' };

test('AR2.4 deterministically normalizes a closed set of structured runtime signals', () => {
  const assessment = createTaskAssessment({ complexity: 0.7, ambiguity: 0.2, evidenceConflict: 1 });
  assert.equal(assessment.version, 'AR2.4');
  assert.equal(assessment.source, 'deterministic-runtime-facts');
  assert.equal(assessment.signals.complexity, 0.7);
  assert.equal(assessment.signals.reasoningDepth, 0);
  assert.equal(assessment.signals.evidenceConflict, 1);
  assert.equal(assessment.suppliedSignalCount, 3);
  assert.equal(Object.isFrozen(assessment.signals), true);
});

test('AR2.4 rejects unknown and out-of-range assessment signals', () => {
  assert.throws(() => createTaskAssessment({ userRequestedExpensiveModel: 1 }), /unknown task assessment signal/);
  assert.throws(() => createTaskAssessment({ risk: 1.1 }), /must be a number in \[0,1\]/);
  assert.throws(() => createTaskAssessment({ ambiguity: -0.1 }), /must be a number in \[0,1\]/);
});

test('AR2.4 assessment depends on structured facts and not user wording', () => {
  const signals = { complexity: 0.4, toolDepth: 0.5 };
  const first = createTaskAssessment(signals);
  const second = createTaskAssessment(signals);
  assert.deepEqual(first, second);
});

test('AR2.4 router attaches assessment before provider execution without changing model selection', async () => {
  let providerRequest;
  const telemetry = createInMemoryAITelemetry();
  const registry = createModelRegistry([{
    id: 'existing', provider: 'fixture', model: 'existing-model', specialties: ['reasoning'], tier: 'L2'
  }]);
  const router = createAIRouter({
    registry, telemetry,
    providers: { fixture: { async generate({ request }) { providerRequest = request; return { text: 'unchanged AI result' }; } } }
  });
  const result = await router.route({
    task: 'analysis', reason: 'AR2.4 test', messages: [{ role: 'user', content: 'arbitrary wording' }],
    traceContext, taskAssessmentSignals: { complexity: 0.6, reasoningDepth: 0.7 }
  });
  assert.equal(result.model, 'existing-model');
  assert.equal(providerRequest.routing.assessment.signals.complexity, 0.6);
  const event = telemetry.list().find((entry) => entry.type === 'ai.task.assessed');
  assert.equal(event.taskClass, 'analysis');
  assert.equal(JSON.stringify(event).includes('arbitrary wording'), false);
});
