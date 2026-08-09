import test from 'node:test';
import assert from 'node:assert/strict';
import { assessFinalResponse } from '../src/response/finalResponseGuard.js';
import { createProductionCapabilities } from '../src/capability/productionCapabilities.js';

const memoryProvider = Object.freeze({
  async query() { return { records: [], diagnostics: {} }; },
  async write() { return { status: 'written' }; }
});

test('final response guard rejects exact user echoes for representative Russian conversational inputs', () => {
  for (const text of ['привет', 'кто ты?', 'кто я?']) {
    const result = assessFinalResponse({ userText: text, candidateText: text });
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'exact-user-echo');
  }
});

test('final response guard accepts a real conversational answer', () => {
  const result = assessFinalResponse({ userText: 'кто ты?', candidateText: 'Я — СГ, Советник GARYA.' });
  assert.equal(result.ok, true);
});

test('compose-answer execution budget is aligned with the AI router instead of the old 10 second timeout', () => {
  const compose = createProductionCapabilities({ memoryProvider }).find((item) => item.name === 'compose-answer');
  assert.ok(compose);
  assert.equal(compose.timeoutMs, 60000);
});
