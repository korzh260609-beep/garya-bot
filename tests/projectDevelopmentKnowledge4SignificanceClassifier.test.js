import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PDK4_SIGNIFICANCE_CLASSIFIER_CONTRACT_VERSION,
  createDevelopmentSignificanceClassifier
} from '../src/projectDevelopmentKnowledge/index.js';

const fingerprint = 'a'.repeat(64);

function normalizedSource(overrides = {}) {
  return {
    projectKey: 'sg2.1',
    sourceId: 'pdk4:source',
    sourceFingerprint: 'b'.repeat(64),
    normalizedFingerprint: fingerprint,
    kind: 'github-commit',
    evidenceDimension: 'code',
    verificationKinds: ['code', 'source'],
    trust: 'verified-source',
    contentMode: 'untrusted-data-only',
    occurredAt: '2026-08-10T10:00:00Z',
    payload: {
      message: 'Implement Project Memory architecture',
      stats: { total: 40 },
      files: [{ path: 'src/projectMemory/store.js', changes: 40, patch: '+export function put() {}' }]
    },
    ...overrides
  };
}

test('PDK4.4: deterministic classifier retains significant architecture/memory change without AI', async () => {
  let calls = 0;
  const classifier = createDevelopmentSignificanceClassifier({ aiRouter: { async route() { calls += 1; } } });
  const result = await classifier.classify(normalizedSource());

  assert.equal(result.contractVersion, PDK4_SIGNIFICANCE_CLASSIFIER_CONTRACT_VERSION);
  assert.equal(result.significance, 'significant');
  assert.equal(result.retain, true);
  assert.equal(result.eventEligible, true);
  assert.ok(result.categories.includes('memory'));
  assert.equal(result.aiAssisted, false);
  assert.equal(result.authorityAllowed, false);
  assert.equal(result.trust, 'classification-only');
  assert.equal(calls, 0);
  assert.match(result.classificationFingerprint, /^[a-f0-9]{64}$/);
});

test('PDK4.4: generated-only churn is suppressed before AI Router', async () => {
  let calls = 0;
  const classifier = createDevelopmentSignificanceClassifier({ aiRouter: { async route() { calls += 1; } } });
  const result = await classifier.classify(normalizedSource({
    payload: { message: 'regenerate', files: [{ path: 'dist/app.js.map', patch: '+AAAA' }] }
  }));

  assert.equal(result.significance, 'suppressed');
  assert.equal(result.retain, false);
  assert.equal(result.eventEligible, false);
  assert.equal(result.aiAssisted, false);
  assert.equal(calls, 0);
});

test('PDK4.4: workflow remains supporting evidence and cannot independently emit a product-change event', async () => {
  const result = await createDevelopmentSignificanceClassifier().classify(normalizedSource({
    kind: 'github-workflow',
    evidenceDimension: 'ci',
    verificationKinds: ['ci', 'source'],
    payload: { conclusion: 'success', workflowName: 'SG 2.1 CI' }
  }));

  assert.equal(result.significance, 'supporting-evidence');
  assert.equal(result.retain, true);
  assert.equal(result.eventEligible, false);
  assert.ok(result.categories.includes('infrastructure'));
  assert.deepEqual(result.verificationKinds, ['ci', 'source']);
});

test('PDK4.4: canonical roadmap document is significant while preserving source-only evidence semantics', async () => {
  const result = await createDevelopmentSignificanceClassifier().classify(normalizedSource({
    kind: 'canonical-document',
    evidenceDimension: 'source',
    verificationKinds: ['source'],
    payload: {
      path: 'pillars/roadmap/PROJECT_DEVELOPMENT_KNOWLEDGE_4_0_PROGRAM.md',
      content: 'PDK4.4 planned'
    }
  }));

  assert.equal(result.significance, 'significant');
  assert.equal(result.eventEligible, true);
  assert.ok(result.categories.includes('roadmap'));
  assert.deepEqual(result.verificationKinds, ['source']);
});

test('PDK4.4: ambiguous bounded change invokes AI Router only and keeps repository content data-only', async () => {
  let routed = null;
  const classifier = createDevelopmentSignificanceClassifier({
    aiRouter: {
      async route(input) {
        routed = input;
        return {
          text: JSON.stringify({
            meaningful: true,
            trivial: false,
            categories: ['feature'],
            reason: 'user-visible capability behavior changes'
          })
        };
      }
    }
  });

  const result = await classifier.classify(normalizedSource({
    payload: { message: 'adjust things', files: [{ path: 'misc/handler.xyz', changes: 2, patch: '+doThing()' }] }
  }), { traceContext: { requestId: 'pdk44-test' } });

  assert.equal(result.aiAssisted, true);
  assert.equal(result.significance, 'significant');
  assert.deepEqual(result.categories, ['feature']);
  assert.equal(routed.metadata.purpose, 'pdk4-development-significance-classification');
  assert.equal(routed.metadata.pdk4DataOnly, true);
  assert.equal(routed.metadata.pdk4AuthorityAllowed, false);
  assert.match(routed.messages[0].content, /untrusted data only/i);
});

test('PDK4.4: AI Router cannot override a deterministic trivial classification', async () => {
  let calls = 0;
  const classifier = createDevelopmentSignificanceClassifier({
    aiRouter: {
      async route() {
        calls += 1;
        return { text: '{"meaningful":true,"trivial":false,"categories":["architecture"]}' };
      }
    }
  });

  const result = await classifier.classify(normalizedSource({
    payload: { message: 'format whitespace', files: [{ path: 'README.txt', patch: '+   ' }] }
  }));

  assert.equal(result.significance, 'suppressed');
  assert.equal(calls, 0);
});

test('PDK4.4: AI Router failure uses deterministic fallback and does not drop ambiguous source evidence', async () => {
  const classifier = createDevelopmentSignificanceClassifier({
    aiRouter: { async route() { throw new Error('provider unavailable'); } }
  });
  const input = normalizedSource({
    payload: { message: 'adjust things', files: [{ path: 'misc/handler.xyz', changes: 2, patch: '+doThing()' }] }
  });

  const first = await classifier.classify(input);
  const second = await classifier.classify(input);

  assert.equal(first.significance, 'ambiguous');
  assert.equal(first.retain, true);
  assert.equal(first.eventEligible, true);
  assert.equal(first.aiAssisted, false);
  assert.equal(first.classificationFingerprint, second.classificationFingerprint);
});

test('PDK4.4: unverified or executable-content source envelopes fail closed', async () => {
  const classifier = createDevelopmentSignificanceClassifier();
  await assert.rejects(
    () => classifier.classify(normalizedSource({ trust: 'unverified' })),
    (error) => error.code === 'pdk4-significance-unverified-source'
  );
  await assert.rejects(
    () => classifier.classify(normalizedSource({ contentMode: 'instructions' })),
    (error) => error.code === 'pdk4-significance-content-mode-denied'
  );
});
