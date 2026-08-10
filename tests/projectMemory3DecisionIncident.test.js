import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createPostgresPersistence, runMigrations } from '../src/persistence/index.js';
import {
  createPostgresProjectMemoryStore,
  createProjectMemoryHybridRetrieval,
  createProjectMemoryTemporalHistory,
  createProjectDecision,
  createProjectIncident,
  createProjectDecisionIncidentMemory
} from '../src/projectMemory/index.js';

function baseInput(projectKey, memoryId, entityKey, validFrom) {
  return {
    memoryId,
    projectKey,
    entityKey,
    source: { kind: 'github', ref: `commit:${memoryId}`, actorId: 'monarch', timestamp: validFrom },
    sourceEventId: `event:${memoryId}`,
    trust: 'verified', confirmed: true, confirmationState: 'confirmed', lifecycleState: 'active',
    validFrom, createdAt: validFrom, updatedAt: validFrom,
    tags: ['pm3.10']
  };
}

function authorize({ actor, projectKey }) { return actor?.projects?.includes(projectKey) === true; }

const connectionString = process.env.DATABASE_URL;
const integration = connectionString ? test : test.skip;

test('PM3.10: decision and incident contracts enforce structured evidence rules', () => {
  const projectKey = 'sg2.1';
  const decision = createProjectDecision({
    ...baseInput(projectKey, 'pm310:decision', 'ai-routing', '2026-08-10T10:00:00Z'),
    status: 'active',
    decision: 'All AI calls use AI Router.',
    rationale: 'Central policy, cost, telemetry and provider control.',
    alternatives: ['Direct provider calls'],
    consequences: ['No direct model-to-provider bypass']
  });
  assert.equal(decision.factType, 'architecture-decision');
  assert.equal(decision.namespace, 'project.sg2.1.decisions');
  assert.equal(decision.fact.rationale.includes('policy'), true);

  assert.throws(() => createProjectIncident({
    ...baseInput(projectKey, 'pm310:incident:bad', 'timeout', '2026-08-10T10:00:00Z'),
    status: 'investigating', symptom: 'Responses time out.', rootCause: 'Provider latency', rootCauseEvidenceConfirmed: false
  }), (error) => error.code === 'project-memory-incident-root-cause-unconfirmed');

  assert.throws(() => createProjectIncident({
    ...baseInput(projectKey, 'pm310:incident:closed', 'timeout', '2026-08-10T10:00:00Z'),
    status: 'closed', symptom: 'Responses time out.', rootCause: 'Provider latency', rootCauseEvidenceConfirmed: true
  }), (error) => error.code === 'project-memory-incident-fix-required');
});

integration('PM3.10: current decision, rationale and temporal decision history are correct', async () => {
  const persistence = createPostgresPersistence({ connectionString, ssl: false, applicationName: 'pm3.10-decision-test' });
  await persistence.start();
  await runMigrations(persistence.database);
  const store = createPostgresProjectMemoryStore(persistence.database);
  const retrieval = createProjectMemoryHybridRetrieval({ database: persistence.database, store, authorize, clock: () => new Date('2026-08-10T13:00:00Z') });
  const temporalHistory = createProjectMemoryTemporalHistory({ store, database: persistence.database, clock: () => new Date('2026-08-10T13:00:00Z') });
  const service = createProjectDecisionIncidentMemory({ retrieval, temporalHistory, authorize });
  const projectKey = `pm310-${randomUUID().slice(0, 8)}`;
  const actor = { projects: [projectKey] };

  const oldDecision = createProjectDecision({
    ...baseInput(projectKey, `pm310:${projectKey}:decision:v1`, 'ai-routing', '2026-08-10T10:00:00Z'),
    decision: 'Direct provider calls are temporarily allowed.',
    rationale: 'Legacy bootstrap behavior.'
  });
  const newDecision = createProjectDecision({
    ...baseInput(projectKey, `pm310:${projectKey}:decision:v2`, 'ai-routing', '2026-08-10T12:00:00Z'),
    decision: 'All AI calls must use AI Router.',
    rationale: 'Central policy, telemetry, fallback and cost control.',
    alternatives: ['Direct provider calls'], consequences: ['Provider bypass is forbidden']
  });
  await store.put(oldDecision);
  await store.put(newDecision);
  await temporalHistory.supersede({ projectKey, currentMemoryId: oldDecision.memoryId, successorMemoryId: newDecision.memoryId, effectiveAt: newDecision.validFrom });

  const current = await service.getCurrentDecision({ actor, projectKey, entityKey: 'ai-routing' });
  assert.equal(current.decision, 'All AI calls must use AI Router.');
  assert.equal(current.current, true);
  const historical = await service.getDecisionAt({ actor, projectKey, entityKey: 'ai-routing', at: '2026-08-10T11:00:00Z' });
  assert.equal(historical.decision, 'Direct provider calls are temporarily allowed.');
  const explanation = await service.explainDecision({ actor, projectKey, entityKey: 'ai-routing' });
  assert.match(explanation.answer, /Rationale:/);
  assert.match(explanation.answer, /telemetry/);
  const chain = await service.getDecisionHistory({ actor, projectKey, memoryId: newDecision.memoryId });
  assert.equal(chain.length, 2);
  assert.equal(chain[0].successorMemoryId, newDecision.memoryId);

  await assert.rejects(
    () => service.getCurrentDecision({ actor: { projects: [] }, projectKey, entityKey: 'ai-routing' }),
    (error) => error.code === 'project-memory-decision-incident-unauthorized'
  );
  await persistence.close();
});

integration('PM3.10: historical incident similarity is advisory and never proves a live root cause', async () => {
  const persistence = createPostgresPersistence({ connectionString, ssl: false, applicationName: 'pm3.10-incident-test' });
  await persistence.start();
  await runMigrations(persistence.database);
  const store = createPostgresProjectMemoryStore(persistence.database);
  const retrieval = createProjectMemoryHybridRetrieval({ database: persistence.database, store, authorize, clock: () => new Date('2026-08-10T13:00:00Z') });
  const temporalHistory = createProjectMemoryTemporalHistory({ store, database: persistence.database, clock: () => new Date('2026-08-10T13:00:00Z') });
  const service = createProjectDecisionIncidentMemory({ retrieval, temporalHistory, authorize });
  const projectKey = `pm310-${randomUUID().slice(0, 8)}`;
  const actor = { projects: [projectKey] };

  const oldIncident = createProjectIncident({
    ...baseInput(projectKey, `pm310:${projectKey}:incident:v1`, 'compose-answer-timeout', '2026-08-01T10:00:00Z'),
    status: 'resolved', symptom: 'compose-answer timed out before AI Router completed.',
    rootCause: 'Capability timeout was shorter than AI Router timeout plus retry.', rootCauseEvidenceConfirmed: true,
    fix: 'Raised compose-answer timeout above Router worst-case duration.',
    affectedComponents: ['compose-answer', 'ai-router'], prevention: ['Keep outer timeout above bounded Router duration.'],
    occurredAt: '2026-08-01T10:00:00Z', resolvedAt: '2026-08-01T12:00:00Z'
  });
  const followup = createProjectIncident({
    ...baseInput(projectKey, `pm310:${projectKey}:incident:v2`, 'compose-answer-timeout', '2026-08-05T10:00:00Z'),
    status: 'closed', symptom: 'Timeout regression verification completed.',
    rootCause: 'Original timeout mismatch remained the confirmed historical cause.', rootCauseEvidenceConfirmed: true,
    fix: 'Regression test retained the corrected timeout relationship.',
    affectedComponents: ['compose-answer'], prevention: ['Regression test.'],
    occurredAt: '2026-08-05T10:00:00Z', resolvedAt: '2026-08-05T11:00:00Z'
  });
  await store.put(oldIncident);
  await store.put(followup);
  await temporalHistory.supersede({ projectKey, currentMemoryId: oldIncident.memoryId, successorMemoryId: followup.memoryId, effectiveAt: followup.validFrom });

  const guidance = await service.findIncidentGuidance({ actor, projectKey, query: 'compose answer timeout ai router', limit: 5 });
  assert.equal(guidance.advisoryOnly, true);
  assert.equal(guidance.provesLiveRootCause, false);
  assert.equal(guidance.requiresLiveVerification, true);
  assert.equal(guidance.modelContextEligible, false);
  assert.ok(guidance.incidents.length >= 1);
  assert.ok(guidance.incidents.some((incident) => incident.lifecycleState === 'archived'));
  assert.ok(guidance.incidents.every((incident) => incident.provesLiveRootCause === false));
  assert.ok(guidance.incidents.every((incident) => incident.rootCauseEvidenceConfirmed === true));

  await assert.rejects(
    () => service.findIncidentGuidance({ actor: { projects: [] }, projectKey, query: 'timeout' }),
    (error) => error.code === 'project-memory-decision-incident-unauthorized'
  );
  await persistence.close();
});
