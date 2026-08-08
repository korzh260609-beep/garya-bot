import test from 'node:test';
import assert from 'node:assert/strict';
import { createLanguageContextService, createInMemoryLanguageStore, detectLanguageDeterministically, detectExplicitResponseLanguage } from '../src/language/languageContextService.js';
import { createLanguageCapabilities } from '../src/language/languageCapabilities.js';
import { createLocalProductionHarness } from '../src/runtime/localProductionHarness.js';

const cases = [
  ['Привіт, як справи?', 'uk'],
  ['Привет, как у тебя дела?', 'ru'],
  ['Please explain how this works', 'en'],
  ['Proszę wyjaśnij jak to działa', 'pl'],
  ['Bitte erkläre mir wie das funktioniert', 'de'],
  ['مرحبا كيف يعمل هذا', 'ar'],
  ['こんにちは、これはどう動きますか', 'ja'],
  ['안녕하세요 어떻게 작동하나요', 'ko'],
  ['你好，这是怎么工作的', 'zh']
];

test('detects representative languages without transport keyword routing', () => {
  for (const [text, expected] of cases) {
    const result = detectLanguageDeterministically(text);
    assert.equal(result.language, expected, `${text} -> ${result.language}`);
    assert.ok(result.confidence >= 0.6);
  }
});

test('mixed technical text preserves conversational language', () => {
  assert.equal(detectLanguageDeterministically('Перевір deployment status мого проєкту').language, 'uk');
  assert.equal(detectLanguageDeterministically('Проверь deployment status моего проекта').language, 'ru');
});

test('language-free input remains bounded and uses fallback hierarchy', async () => {
  const service = createLanguageContextService({ fallbackLanguage: 'en' });
  const result = await service.resolve({ globalUserId: 'u1', text: '👍', platformLocale: null });
  assert.equal(result.messageLanguage, 'und');
  assert.equal(result.responseLanguage, 'en');
  assert.equal(result.responseLanguageSource, 'system-fallback');
});

test('explicit one-message response language overrides detected language but does not persist preference', async () => {
  const store = createInMemoryLanguageStore();
  const service = createLanguageContextService({ store });
  const result = await service.resolve({ globalUserId: 'u1', text: 'Поясни це. Now answer in English', platformLocale: 'uk-UA' });
  assert.equal(detectExplicitResponseLanguage('Now answer in English'), 'en');
  assert.equal(result.responseLanguage, 'en');
  assert.equal(result.responseLanguageSource, 'explicit-user-instruction');
  assert.equal(await service.getPreferred('u1'), null);
});

test('preferred language is scoped by global user id and survives service recreation over shared store', async () => {
  const store = createInMemoryLanguageStore();
  const first = createLanguageContextService({ store });
  await first.setPreferred('global-1', 'pl', { locale: 'pl-PL' });
  const second = createLanguageContextService({ store });
  const result = await second.resolve({ globalUserId: 'global-1', text: 'OK' });
  assert.equal(result.preferredLanguage, 'pl');
  assert.equal(result.responseLanguage, 'pl');
  assert.equal(result.locale, 'pl-PL');
  assert.equal((await second.getPreferred('global-1')).language, 'pl');
  assert.equal(await second.getPreferred('global-2'), null);
});

test('language capabilities expose safe global preference read/write contracts', () => {
  const service = createLanguageContextService();
  const capabilities = createLanguageCapabilities({ languageContextService: service });
  assert.deepEqual(capabilities.map((item) => item.name), ['language-preference-set', 'language-preference-get']);
  assert.equal(capabilities[0].actionClasses.includes('state-changing'), true);
  assert.equal(capabilities[1].actionClasses.includes('read-only'), true);
});

test('runtime resolves language context before semantic processing and returns it as diagnostic evidence', async () => {
  let seenInput = null;
  const harness = createLocalProductionHarness({
    interpretationResolver: (input) => {
      seenInput = input;
      return {
        meaning: `Echo: ${input.text}`,
        goal: 'respond', intent: 'answer', entities: [], constraints: [], uncertainty: 0,
        missingInformation: [], clarificationQuestion: null, contextNeeds: [], evidenceNeeds: [],
        candidateActions: [{ type: 'answer', name: 'compose-answer', actionClass: 'analysis' }], rationale: 'fixture'
      };
    }
  });
  await harness.runtime.start();
  try {
    const result = await harness.transport.send({ text: 'Привіт, поясни це', locale: 'uk-UA', userId: 'gary', projectId: 'sg2.1' });
    assert.equal(seenInput.metadata.languageContext.messageLanguage, 'uk');
    assert.equal(seenInput.metadata.languageContext.responseLanguage, 'uk');
    assert.equal(result.response.data.languageContext.responseLanguage, 'uk');
    assert.equal(result.response.data.languageContext.platformLocale, 'uk-UA');
  } finally {
    await harness.runtime.stop();
  }
});

test('different users can resolve different languages without cross-user contamination', async () => {
  const service = createLanguageContextService();
  await service.setPreferred('a', 'uk');
  await service.setPreferred('b', 'pl');
  const a = await service.resolve({ globalUserId: 'a', text: 'OK' });
  const b = await service.resolve({ globalUserId: 'b', text: 'OK' });
  assert.equal(a.responseLanguage, 'uk');
  assert.equal(b.responseLanguage, 'pl');
});
