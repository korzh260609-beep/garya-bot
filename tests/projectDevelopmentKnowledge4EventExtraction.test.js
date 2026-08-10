import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createDevelopmentSourceIdentity,
  createDevelopmentEventExtractor,
  PDK4_EVENT_EXTRACTION_CONTRACT_VERSION,
  PDK4_EVENT_EXTRACTION_LIMITS
} from '../src/projectDevelopmentKnowledge/index.js';

const projectKey = 'sg2.1';
const repository = 'korzh260609-beep/garya-bot';
const sha = 'a'.repeat(40);
const identity = createDevelopmentSourceIdentity({ kind: 'github-commit', projectKey, repository, sha });

function source(overrides = {}) {
  return Object.freeze({
    contractVersion: 1,
    projectKey,
    kind: 'github-commit',
    repository,
    sourceId: identity.sourceId,
    sourceFingerprint: identity.fingerprint,
    immutableIdentity: identity,
    occurredAt: '2026-08-10T16:00:00Z',
    evidenceDimension: 'code',
    verificationKinds: Object.freeze(['code', 'source']),
    trust: 'verified-source',
    contentMode: 'untrusted-data-only',
    payload: Object.freeze({
      sha,
      message: 'Implement PDK4.5 development event extraction',
      files: Object.freeze([{ path: 'src/projectDevelopmentKnowledge/developmentEventExtractor.js', status: 'added', additions: 100, deletions: 0, changes: 100, patch: '+ implement bounded extraction' }]),
      stats: Object.freeze({ additions: 100, deletions: 0, total: 100 })
    }),
    normalizedFingerprint: 'b'.repeat(64),
    ...overrides
  });
}

function classification(overrides = {}) {
  return Object.freeze({
    contractVersion: 1,
    projectKey,
    sourceId: identity.sourceId,
    sourceFingerprint: identity.fingerprint,
    normalizedFingerprint: 'b'.repeat(64),
    sourceKind: 'github-commit',
    evidenceDimension: 'code',
    verificationKinds: Object.freeze(['code', 'source']),
    significance: 'significant',
    retain: true,
    eventEligible: true,
    categories: Object.freeze(['memory']),
    reasons: Object.freeze(['meaningful PDK4 implementation']),
    deterministicPrefilter: Object.freeze({ significance: 'significant', retain: true, eventEligible: true, categories: Object.freeze(['memory']), ambiguous: false }),
    aiAssisted: false,
    trust: 'classification-only',
    authorityAllowed: false,
    classificationFingerprint: 'c'.repeat(64),
    ...overrides
  });
}

const fixedClock = () => new Date('2026-08-10T16:05:00Z');

test('PDK4.5: deterministic extraction creates provenance-backed DevelopmentEvent and unverified proposed PM3 candidate', async () => {
  const extractor = createDevelopmentEventExtractor({ clock: fixedClock });
  const result = await extractor.extract(source(), classification(), { traceContext: { traceId: 'trace-pdk45' } });

  assert.equal(result.contractVersion, PDK4_EVENT_EXTRACTION_CONTRACT_VERSION);
  assert.equal(result.event.eventType, 'implementation');
  assert.equal(result.event.domain, 'memory');
  assert.equal(result.event.component, 'Project Development Knowledge 4.0');
  assert.equal(result.event.previousState, 'implementing');
  assert.equal(result.event.newState, 'implemented');
  assert.equal(result.event.provenance[0].sourceId, identity.sourceId);
  assert.deepEqual(result.event.verification.map((item) => item.kind), ['code', 'source']);
  assert.equal(result.candidate.factType, 'project-event');
  assert.equal(result.candidate.trust, 'unverified');
  assert.equal(result.candidate.confirmed, false);
  assert.equal(result.candidate.confirmationState, 'proposed');
  assert.equal(result.trust, 'extracted-candidate');
  assert.equal(result.confirmed, false);
  assert.equal(result.authorityAllowed, false);
  assert.equal(result.aiAssisted, false);
  assert.ok(Object.isFrozen(result));
});

test('PDK4.5: replay is deterministic for event semantics and extraction fingerprint', async () => {
  const extractor = createDevelopmentEventExtractor({ clock: fixedClock });
  const first = await extractor.extract(source(), classification(), { traceContext: { traceId: 'trace-pdk45' } });
  const second = await extractor.extract(source(), classification(), { traceContext: { traceId: 'trace-pdk45' } });
  assert.equal(first.event.eventId, second.event.eventId);
  assert.equal(first.event.semanticFingerprint, second.event.semanticFingerprint);
  assert.equal(first.extractionFingerprint, second.extractionFingerprint);
});

test('PDK4.5: suppressed and supporting-evidence classifications cannot become DevelopmentEvents', async () => {
  const extractor = createDevelopmentEventExtractor({ clock: fixedClock });
  await assert.rejects(
    () => extractor.extract(source(), classification({ significance: 'suppressed', retain: false, eventEligible: false })),
    (error) => error.code === 'pdk4-extraction-not-event-eligible'
  );
  await assert.rejects(
    () => extractor.extract(source(), classification({ significance: 'supporting-evidence', retain: true, eventEligible: false })),
    (error) => error.code === 'pdk4-extraction-not-event-eligible'
  );
});

test('PDK4.5: source/classification trust and immutable linkage fail closed', async () => {
  const extractor = createDevelopmentEventExtractor({ clock: fixedClock });
  await assert.rejects(
    () => extractor.extract(source({ trust: 'unverified' }), classification()),
    (error) => error.code === 'pdk4-extraction-source-denied'
  );
  await assert.rejects(
    () => extractor.extract(source(), classification({ trust: 'verified' })),
    (error) => error.code === 'pdk4-extraction-classification-denied'
  );
  await assert.rejects(
    () => extractor.extract(source(), classification({ normalizedFingerprint: 'd'.repeat(64) })),
    (error) => error.code === 'pdk4-extraction-source-mismatch'
  );
});

test('PDK4.5: AI Router can enrich bounded semantic fields but cannot confirm the candidate', async () => {
  const calls = [];
  const aiRouter = {
    async route(input) {
      calls.push(input);
      return {
        text: JSON.stringify({
          eventType: 'implementation',
          component: 'PDK4 Event Extraction',
          title: 'Extract structured development events',
          summary: 'Adds bounded event extraction after significance filtering.',
          intent: 'Preserve project development history as structured candidates.',
          problem: 'Verified source evidence needs semantic event structure.',
          rationale: 'Keep extraction separate from trust and confirmation.',
          alternatives: ['Store raw commits directly', 'Let the model write Project Memory'],
          implementation: 'Create DevelopmentEvent and an unverified PM3 candidate.',
          result: 'Structured candidate is available for later PM3 ingestion.',
          limitations: ['No direct confirmation', 'No deployment inference'],
          previousState: 'implementing',
          newState: 'implemented',
          confidence: 0.9
        })
      };
    }
  };
  const extractor = createDevelopmentEventExtractor({ aiRouter, clock: fixedClock });
  const result = await extractor.extract(source(), classification(), { traceContext: { traceId: 'trace-ai' } });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].metadata.purpose, 'pdk4-development-event-extraction');
  assert.equal(calls[0].metadata.pdk4DataOnly, true);
  assert.equal(calls[0].metadata.pdk4AuthorityAllowed, false);
  assert.equal(calls[0].metadata.pdk4CanConfirm, false);
  assert.ok(calls[0].messages[1].content.length <= PDK4_EVENT_EXTRACTION_LIMITS.maxAiPayloadChars);
  assert.equal(result.aiAssisted, true);
  assert.equal(result.event.rationale, 'Keep extraction separate from trust and confirmation.');
  assert.deepEqual(result.event.alternatives, ['Store raw commits directly', 'Let the model write Project Memory']);
  assert.equal(result.candidate.trust, 'unverified');
  assert.equal(result.candidate.confirmed, false);
  assert.equal(result.candidate.confirmationState, 'proposed');
});

test('PDK4.5: AI Router cannot promote code evidence to deployed or live-verified', async () => {
  const aiRouter = {
    async route() {
      return { text: JSON.stringify({ eventType: 'implementation', previousState: 'ci-verified', newState: 'live-verified', summary: 'Claim live state without runtime evidence.' }) };
    }
  };
  const extractor = createDevelopmentEventExtractor({ aiRouter, clock: fixedClock });
  const result = await extractor.extract(source(), classification());
  assert.equal(result.event.previousState, 'implementing');
  assert.equal(result.event.newState, 'implemented');
  assert.doesNotMatch(JSON.stringify(result.event.verification), /runtime|deployment/);
});

test('PDK4.5: source-only canonical roadmap extraction cannot claim implemented state even when AI asks for it', async () => {
  const documentIdentity = createDevelopmentSourceIdentity({
    kind: 'canonical-document', projectKey, repository,
    path: 'pillars/roadmap/PROJECT_DEVELOPMENT_KNOWLEDGE_4_0_PROGRAM.md', revision: sha
  });
  const document = source({
    kind: 'canonical-document',
    sourceId: documentIdentity.sourceId,
    sourceFingerprint: documentIdentity.fingerprint,
    immutableIdentity: documentIdentity,
    evidenceDimension: 'source',
    verificationKinds: Object.freeze(['source']),
    payload: Object.freeze({
      path: 'pillars/roadmap/PROJECT_DEVELOPMENT_KNOWLEDGE_4_0_PROGRAM.md',
      revision: sha,
      content: 'PDK4.5 roadmap plan and decision for event extraction.'
    })
  });
  const docClassification = classification({
    sourceId: documentIdentity.sourceId,
    sourceFingerprint: documentIdentity.fingerprint,
    sourceKind: 'canonical-document',
    evidenceDimension: 'source',
    verificationKinds: Object.freeze(['source']),
    categories: Object.freeze(['roadmap'])
  });
  const extractor = createDevelopmentEventExtractor({
    aiRouter: { async route() { return { text: JSON.stringify({ eventType: 'implementation', previousState: 'implementing', newState: 'implemented' }) }; } },
    clock: fixedClock
  });
  const result = await extractor.extract(document, docClassification);
  assert.notEqual(result.event.newState, 'implemented');
  assert.deepEqual(result.event.verification.map((item) => item.kind), ['source']);
});

test('PDK4.5: malformed/unavailable AI falls back deterministically', async () => {
  const malformed = createDevelopmentEventExtractor({ aiRouter: { async route() { return { text: 'not-json' }; } }, clock: fixedClock });
  const failing = createDevelopmentEventExtractor({ aiRouter: { async route() { throw new Error('provider unavailable'); } }, clock: fixedClock });
  const baseline = createDevelopmentEventExtractor({ clock: fixedClock });
  const a = await malformed.extract(source(), classification());
  const b = await failing.extract(source(), classification());
  const c = await baseline.extract(source(), classification());
  assert.equal(a.event.semanticFingerprint, c.event.semanticFingerprint);
  assert.equal(b.event.semanticFingerprint, c.event.semanticFingerprint);
  assert.equal(a.aiAssisted, false);
  assert.equal(b.aiAssisted, false);
});

test('PDK4.5: AI output is bounded and secret-shaped strings are redacted before candidate creation', async () => {
  const secret = `ghp_${'A'.repeat(30)}`;
  const extractor = createDevelopmentEventExtractor({
    aiRouter: {
      async route() {
        return { text: JSON.stringify({
          eventType: 'implementation',
          summary: `Authorization: ${secret}`,
          rationale: `api_key=${secret}`,
          alternatives: Array.from({ length: 30 }, (_, i) => `${i}:${'x'.repeat(900)}`)
        }) };
      }
    },
    clock: fixedClock
  });
  const result = await extractor.extract(source(), classification());
  const serialized = JSON.stringify(result);
  assert.doesNotMatch(serialized, new RegExp(secret));
  assert.match(result.event.summary, /\[REDACTED\]/);
  assert.match(result.event.rationale, /\[REDACTED\]/);
  assert.ok(result.event.alternatives.length <= PDK4_EVENT_EXTRACTION_LIMITS.maxListItems);
  assert.ok(result.event.alternatives.every((item) => item.length <= PDK4_EVENT_EXTRACTION_LIMITS.maxListItemChars));
});
