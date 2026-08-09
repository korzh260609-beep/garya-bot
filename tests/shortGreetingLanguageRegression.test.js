import test from 'node:test';
import assert from 'node:assert/strict';
import { createLanguageContextService, detectLanguageDeterministically } from '../src/language/languageContextService.js';

test('short unique Russian greeting is deterministically Russian', () => {
  const result = detectLanguageDeterministically('привет');
  assert.equal(result.language, 'ru');
  assert.ok(result.confidence >= 0.6);
});

test('short unique Ukrainian greeting is deterministically Ukrainian', () => {
  const result = detectLanguageDeterministically('привіт');
  assert.equal(result.language, 'uk');
  assert.ok(result.confidence >= 0.6);
});

test('short Russian greeting does not spend an AI language-detection call', async () => {
  let calls = 0;
  const service = createLanguageContextService({
    detector: { async detect() { calls += 1; return { language: 'en', confidence: 1, source: 'test' }; } }
  });
  const result = await service.resolve({ globalUserId: 'u', text: 'привет', conversationKey: 'u|sg2.1|private|root' });
  assert.equal(result.messageLanguage, 'ru');
  assert.equal(result.responseLanguage, 'ru');
  assert.equal(calls, 0);
});
