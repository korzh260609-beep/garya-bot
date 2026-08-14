import test from 'node:test';
import assert from 'node:assert/strict';
import { createMemory2Record } from '../src/memory2/memory2.js';

function record(value) {
  return {
    id: 'mem-secret-regression',
    layer: 'project-memory',
    key: 'security-policy-history',
    value,
    memoryScope: {
      kind: 'project',
      ownerGlobalUserId: null,
      projectScope: 'sg2.1',
      groupScope: null,
      threadScope: null
    },
    privacyClass: 'project',
    provenance: {
      sourceType: 'project-development-knowledge',
      sourceId: 'github:test',
      actorId: null,
      sourceTimestamp: '2026-08-13T03:00:00.000Z'
    },
    trust: 'verified',
    confirmed: true,
    confirmationState: 'confirmed',
    lifecycleState: 'active',
    createdAt: '2026-08-13T03:00:00.000Z',
    updatedAt: '2026-08-13T03:00:00.000Z',
    tags: ['security', 'project-history'],
    retentionClass: 'durable',
    recordVersion: 1,
    metadata: {}
  };
}

test('Memory 2.0 hydration accepts security terminology when no secret value is present', () => {
  const value = {
    summary: 'GitHub token, API key, credentials and authorization headers must never enter Project Memory.',
    decision: 'Secrets remain outside AI context and ordinary diagnostics.'
  };
  const hydrated = createMemory2Record(record(value));
  assert.deepEqual(hydrated.value, value);
});

test('Memory 2.0 still rejects actual secret-shaped assignments and bearer credentials', () => {
  const rejected = [
    { api_key: 'abc12345' },
    'token=abcdef123456',
    'Authorization: Bearer abcdefghijklmnop',
    `ghp_${'A'.repeat(30)}`,
    `sk-${'B'.repeat(24)}`,
    '-----BEGIN PRIVATE KEY-----'
  ];
  for (const value of rejected) {
    assert.throws(
      () => createMemory2Record(record(value)),
      (error) => error.code === 'memory-secret-rejected'
    );
  }
});
