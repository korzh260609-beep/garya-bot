import { createHash } from 'node:crypto';
import { boundedText, boundedArray, assertEntityId } from './workspaceOperationsContract.js';
import { deepFreeze, uid, hashKey } from './workspaceOperationsCore.js';

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const callback = Object.freeze({ start: (testId) => `twmt|s|${testId}`, answer: (sessionId, optionIndex) => `twmt|a|${sessionId}|${optionIndex}` });

function normalizeOption(value, index, profileMode) {
  if (typeof value === 'string') return deepFreeze({ text: boundedText(value, 'option.text', 200), scoreKey: profileMode ? LETTERS[index] ?? String(index + 1) : null });
  const text = boundedText(value?.text, 'option.text', 200);
  const scoreKey = profileMode ? boundedText(value?.scoreKey ?? LETTERS[index] ?? String(index + 1), 'option.scoreKey', 40) : null;
  return deepFreeze({ text, scoreKey });
}

function normalizeProfiles(results) {
  if (!Array.isArray(results) || results.length === 0) return null;
  const seen = new Set();
  const rows = boundedArray(results, 'results', 30).map((result) => {
    const key = boundedText(result?.key, 'result.key', 40);
    if (seen.has(key)) throw new TypeError(`duplicate result key: ${key}`);
    seen.add(key);
    return deepFreeze({ key, title: boundedText(result?.title ?? key, 'result.title', 200), description: boundedText(result?.description ?? '', 'result.description', 1200, { allowEmpty: true }) });
  });
  return deepFreeze(rows);
}

function normalizeQuestions(questions, profileMode) {
  return boundedArray(questions, 'questions', 50).map((question, questionIndex) => {
    const rawOptions = boundedArray(question?.options, `questions[${questionIndex}].options`, 12);
    if (rawOptions.length < 2) throw new TypeError(`questions[${questionIndex}].options requires at least 2 options`);
    const options = rawOptions.map((option, optionIndex) => normalizeOption(option, optionIndex, profileMode));
    let correctOptionIndex = null;
    if (!profileMode) {
      correctOptionIndex = Number(question?.correctOptionIndex);
      if (!Number.isSafeInteger(correctOptionIndex) || correctOptionIndex < 0 || correctOptionIndex >= options.length) throw new TypeError(`questions[${questionIndex}].correctOptionIndex is invalid`);
    }
    return deepFreeze({ id: assertEntityId(question?.id ?? `q_${questionIndex + 1}`), text: boundedText(question?.text, `questions[${questionIndex}].text`, 500), options, correctOptionIndex });
  });
}

function optionKeyboard(sessionId, question) {
  return { inline_keyboard: question.options.map((option, index) => [{ text: `${LETTERS[index] ?? index + 1}. ${option.text}`.slice(0, 64), callback_data: callback.answer(sessionId, index) }]) };
}

function questionText(test, questionIndex) {
  const question = test.payload.questions[questionIndex];
  return `${test.payload.title}\n\n${questionIndex + 1}/${test.payload.questions.length}. ${question.text}`;
}

function scoreProfile(test, answers) {
  const counts = new Map();
  test.payload.questions.forEach((question, index) => {
    const option = question.options[answers[index]];
    const key = option?.scoreKey;
    if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
  });
  const max = Math.max(0, ...counts.values());
  const keys = [...counts.entries()].filter(([, count]) => count === max).map(([key]) => key);
  const profiles = test.payload.results.filter((row) => keys.includes(row.key));
  return deepFreeze({ mode: 'profile', keys, profiles, counts: Object.fromEntries(counts) });
}

function scoreKnowledge(test, answers) {
  let correct = 0;
  test.payload.questions.forEach((question, index) => { if (Number(answers[index]) === Number(question.correctOptionIndex)) correct += 1; });
  return deepFreeze({ mode: 'knowledge', correct, total: test.payload.questions.length, percent: Math.round((correct / test.payload.questions.length) * 100) });
}

function resultText(test, result) {
  if (result.mode === 'knowledge') return `${test.payload.title}\n\nРезультат: ${result.correct}/${result.total} (${result.percent}%)`;
  const profiles = result.profiles.length ? result.profiles : result.keys.map((key) => ({ key, title: key, description: '' }));
  const body = profiles.map((profile) => `• ${profile.title}${profile.description ? ` — ${profile.description}` : ''}`).join('\n');
  return `${test.payload.title}\n\nРезультат:\n${body}`;
}

export function createWorkspaceInteractiveTestOperations({ core, botClient } = {}) {
  const { store, workspace, capabilities, gate, authority } = core;

  async function createTest(ctx, { title, intro = '', questions, results = null } = {}) {
    const profiles = normalizeProfiles(results);
    const profileMode = Boolean(profiles);
    const normalizedQuestions = normalizeQuestions(questions, profileMode);
    return gate(ctx, { operation: 'test.create', domain: 'test', risk: 'medium', confirmationRequired: true, authorityAction: 'workspace:publish', requiredPermission: 'workspace:publish' }, async () => {
      if (!botClient?.sendMessage) throw Object.assign(new Error('Telegram publication client unavailable'), { code: 'twm-test-publication-unavailable' });
      const target = await workspace(ctx.workspaceId);
      await capabilities(ctx.workspaceId, [target.workspaceType === 'channel' ? 'telegram.channel.post' : 'telegram.message.send']);
      const recordId = uid('test');
      const record = await store.createRecord({ workspaceId: ctx.workspaceId, domain: 'test', recordId, status: 'active', visibility: 'workspace', privacyClass: 'workspace', actorGlobalUserId: ctx.actorGlobalUserId, payload: { title: boundedText(title, 'title', 300), intro: boundedText(intro, 'intro', 1000, { allowEmpty: true }), questions: normalizedQuestions, results: profiles, mode: profileMode ? 'profile' : 'knowledge' } });
      const message = await botClient.sendMessage({ chatId: target.telegramChatId, text: `${record.payload.title}${record.payload.intro ? `\n\n${record.payload.intro}` : ''}\n\nВопросов: ${record.payload.questions.length}. Результат будет показан после завершения.`, replyMarkup: { inline_keyboard: [[{ text: '▶️ Начать тест', callback_data: callback.start(recordId) }]] } });
      return store.updateRecord({ workspaceId: ctx.workspaceId, domain: 'test', recordId, actorGlobalUserId: ctx.actorGlobalUserId, status: 'active', payload: { ...record.payload, telegramMessageId: message?.message_id ?? null }, expectedVersion: record.version });
    });
  }

  async function start(ctx, { testId } = {}) {
    await authority(ctx, 'workspace:view', true);
    const test = await store.getRecord({ workspaceId: ctx.workspaceId, domain: 'test', recordId: assertEntityId(testId, 'testId') });
    if (!test || test.status !== 'active') throw Object.assign(new Error('test unavailable'), { code: 'twm-test-unavailable' });
    const idempotencyKey = `interactive-test:${ctx.workspaceId}:${test.recordId}:${ctx.actorGlobalUserId}`;
    const session = await store.createRecord({ workspaceId: ctx.workspaceId, domain: 'submission', recordId: uid('submission'), status: 'in-progress', visibility: 'private', privacyClass: 'private', actorGlobalUserId: ctx.actorGlobalUserId, payload: { sourceDomain: 'test', testId: test.recordId, participantGlobalUserId: ctx.actorGlobalUserId, answers: [], nextQuestionIndex: 0 }, idempotencyKey });
    return deepFreeze({ test, session, text: questionText(test, session.payload.nextQuestionIndex ?? 0), replyMarkup: optionKeyboard(session.recordId, test.payload.questions[session.payload.nextQuestionIndex ?? 0]) });
  }

  async function answer(ctx, { sessionId, optionIndex } = {}) {
    await authority(ctx, 'workspace:view', true);
    const session = await store.getRecord({ workspaceId: ctx.workspaceId, domain: 'submission', recordId: assertEntityId(sessionId, 'sessionId') });
    if (!session || session.actorGlobalUserId !== ctx.actorGlobalUserId || session.payload?.participantGlobalUserId !== ctx.actorGlobalUserId) throw Object.assign(new Error('test session denied'), { code: 'twm-test-session-denied' });
    const test = await store.getRecord({ workspaceId: ctx.workspaceId, domain: 'test', recordId: session.payload.testId });
    if (!test) throw Object.assign(new Error('test not found'), { code: 'twm-domain-record-not-found' });
    if (session.status === 'scored') return deepFreeze({ completed: true, result: session.payload.result, text: resultText(test, session.payload.result), replyMarkup: null });
    const questionIndex = Number(session.payload.nextQuestionIndex ?? 0);
    const question = test.payload.questions[questionIndex];
    const selected = Number(optionIndex);
    if (!question || !Number.isSafeInteger(selected) || selected < 0 || selected >= question.options.length) throw Object.assign(new Error('invalid test answer'), { code: 'twm-test-answer-invalid' });
    const answers = [...(session.payload.answers ?? [])];
    answers[questionIndex] = selected;
    const nextQuestionIndex = questionIndex + 1;
    if (nextQuestionIndex < test.payload.questions.length) {
      const updated = await store.updateRecord({ workspaceId: ctx.workspaceId, domain: 'submission', recordId: session.recordId, actorGlobalUserId: ctx.actorGlobalUserId, status: 'in-progress', visibility: 'private', privacyClass: 'private', payload: { ...session.payload, answers, nextQuestionIndex }, expectedVersion: session.version });
      return deepFreeze({ completed: false, session: updated, text: questionText(test, nextQuestionIndex), replyMarkup: optionKeyboard(updated.recordId, test.payload.questions[nextQuestionIndex]) });
    }
    const result = test.payload.mode === 'profile' ? scoreProfile(test, answers) : scoreKnowledge(test, answers);
    const updated = await store.updateRecord({ workspaceId: ctx.workspaceId, domain: 'submission', recordId: session.recordId, actorGlobalUserId: ctx.actorGlobalUserId, status: 'scored', visibility: 'private', privacyClass: 'private', payload: { ...session.payload, answers, nextQuestionIndex, result, completedAt: new Date().toISOString() }, expectedVersion: session.version });
    await store.appendEvent({ workspaceId: ctx.workspaceId, eventKey: hashKey(['test.completed', test.recordId, ctx.actorGlobalUserId]), eventType: 'test.completed', recordDomain: 'test', recordId: test.recordId, actorGlobalUserId: ctx.actorGlobalUserId, evidence: { submissionId: updated.recordId, mode: test.payload.mode } });
    return deepFreeze({ completed: true, session: updated, result, text: resultText(test, result), replyMarkup: null });
  }

  return deepFreeze({ createTest, start, answer, callback });
}
