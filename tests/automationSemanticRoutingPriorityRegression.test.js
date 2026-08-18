import test from 'node:test';
import assert from 'node:assert/strict';
import { createProductionMeaningInterpreter } from '../src/ai/productionMeaningInterpreter.js';

const traceContext = Object.freeze({ traceId: 'trace:aw220-live-routing', requestId: 'request:aw220-live-routing' });

test('live existing-task activity mutation precedes generic conversation rules and keeps executable routing data', async () => {
  let routed;
  const probe = Object.assign(new Error('probe complete'), { code: 'PROBE_COMPLETE', retryable: false });
  const interpreter = createProductionMeaningInterpreter({
    fallbackOnFailure: true,
    aiRouter: {
      async route(input) {
        routed = input;
        throw probe;
      }
    }
  });
  const canonicalInput = {
    text: 'Добавь к задаче на 7 утра привет монарх информацию по активности в группах где ты есть',
    locale: 'ru',
    identityContext: { roles: ['monarch'] },
    scopeContext: { userScope: 'usr-monarch', projectScope: 'sg2.1' },
    traceContext,
    metadata: {}
  };

  await interpreter.interpret(canonicalInput);
  const instruction = routed.messages[0].content;
  assert.equal(instruction.startsWith('PRIORITY AUTOMATION ROUTING RULES:'), true);
  assert.equal(instruction.indexOf('add-workspace-activity') < instruction.indexOf('Other ordinary conversational requests'), true);
  assert.match(instruction, /never a conversational capability explanation/i);
  assert.match(instruction, /do not claim that SG lacks a group list/i);
  assert.match(instruction, /short unquoted content fragment/i);
  assert.match(instruction, /selector\.localTime/i);
  assert.match(instruction, /full existing message/i);
  assert.equal(JSON.parse(routed.messages[1].content).text, canonicalInput.text);
});
