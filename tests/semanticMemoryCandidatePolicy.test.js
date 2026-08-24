import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeSemanticMemoryCandidates,
  captureSemanticMemoryCandidates
} from '../src/memory2/semanticMemoryCandidatePolicy.js';
import { createProductionCapabilities } from '../src/capability/productionCapabilities.js';

const scope = { userScope: 'usr-a', projectScope: 'sg2.1', groupScope: null, threadScope: null };
const actor = { globalUserId: 'usr-a', roles: ['guest'], grants: ['capability:compose-answer'], authenticationLevel: 'verified' };

test('semantic memory candidates cannot replace user text or broaden personal scope', () => {
  const normalized = normalizeSemanticMemoryCandidates({
    userText: 'The laptop I use every day is a ThinkPad T14.',
    requestScope: scope,
    candidates: [{
      key: 'device.primary-laptop',
      value: 'invented model value',
      scopeKind: 'project',
      shared: true,
      tags: ['device', 'daily-use']
    }]
  });

  assert.equal(normalized.length, 1);
  assert.equal(normalized[0].key, 'device.primary-laptop');
  assert.equal(normalized[0].value, 'The laptop I use every day is a ThinkPad T14.');
  assert.equal(normalized[0].scopeKind, 'user');
  assert.equal(normalized[0].shared, false);
  assert.deepEqual(normalized[0].tags, ['device', 'daily-use']);
});

test('semantic capture delegates to Memory 2.0 structured candidate boundary', async () => {
  const captured = [];
  const memoryProvider = {
    async capture(input) {
      captured.push(input);
      return { status: 'written', persisted: true };
    }
  };
  const request = {
    input: { text: 'У меня автомобиль Freelander 2 2008 года.' },
    scope,
    actor,
    traceContext: { requestId: 'req-1' }
  };

  const result = await captureSemanticMemoryCandidates({
    memoryProvider,
    request,
    candidates: [{ key: 'vehicle.primary', value: 'anything', scopeKind: 'project', shared: true, tags: ['vehicle'] }]
  });

  assert.equal(result[0].persisted, true);
  assert.equal(captured.length, 1);
  assert.equal(captured[0].text, request.input.text);
  assert.equal(captured[0].metadata.memoryCandidate.value, request.input.text);
  assert.equal(captured[0].metadata.memoryCandidate.scopeKind, 'user');
  assert.equal(captured[0].metadata.memoryCandidate.shared, false);
});

test('compose-answer captures semantic memory before response composition', async () => {
  const order = [];
  const memoryProvider = {
    async query() { return { records: [], diagnostics: {} }; },
    async write() { return { status: 'written' }; },
    async capture(input) {
      order.push(`capture:${input.metadata.memoryCandidate.key}`);
      return { status: 'written', persisted: true };
    }
  };
  const capabilities = createProductionCapabilities({
    memoryProvider,
    conversationResponder: async () => {
      order.push('respond');
      return 'Понял.';
    }
  });
  const compose = capabilities.find((item) => item.name === 'compose-answer');
  const result = await compose.execute({
    input: {
      text: 'Мой основной редактор — VS Code.',
      memoryCandidates: [{ key: 'software.primary-editor', value: 'wrong', scopeKind: 'user', shared: false, tags: ['software'] }]
    },
    scope,
    actor,
    traceContext: { requestId: 'req-2', traceId: 'trace-2' }
  });

  assert.deepEqual(order, ['capture:software.primary-editor', 'respond']);
  assert.equal(result.data.message, 'Понял.');
  assert.equal(result.data.semanticMemoryCapture[0].persisted, true);
});
