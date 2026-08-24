import test from 'node:test';
import assert from 'node:assert/strict';
import { createProductionRuntime } from '../src/runtime/createProductionRuntime.js';
import { createLanguageAwareConversationResponder } from '../src/language/languageAwareConversationResponder.js';

const TOOL_STUB = 'Repository analysis completed in read/prepare-only mode';

function capabilityDescriptor(name, actionTypes, actionClasses, requiredSources = [], requiredTools = []) {
  return Object.freeze({
    name,
    requiredPermissions: Object.freeze([`capability:${name}`]),
    requiredSources: Object.freeze([...requiredSources]),
    requiredTools: Object.freeze([...requiredTools]),
    risk: 'low',
    estimatedCostUsd: 0,
    confirmationRequired: false,
    actionTypes: Object.freeze([...actionTypes]),
    actionClasses: Object.freeze([...actionClasses])
  });
}

test('repository analysis answer is composed after tool execution instead of leaking tool status', async () => {
  const calls = [];
  const gateCalls = [];
  const repositoryCapability = capabilityDescriptor(
    'repository-analyze',
    ['repository-analyze'],
    ['read-only'],
    ['repository-read-source'],
    ['repository-analyzer']
  );
  const composeCapability = capabilityDescriptor('compose-answer', ['answer'], ['analysis-only']);

  const runtime = createProductionRuntime({
    config: { environment: 'test', revision: 'repository-answer-composition', shutdownTimeoutMs: 1000 },
    semanticPipeline: {
      async process(input) {
        return Object.freeze({
          decisionEnvelope: Object.freeze({
            traceId: input.traceContext.traceId,
            requestId: input.traceContext.requestId,
            decisionType: 'answer',
            intent: 'answer',
            selectedAction: Object.freeze({
              type: 'repository-analyze',
              name: 'repository-analyze',
              actionClass: 'read-only',
              payload: Object.freeze({ mode: 'read-only' })
            })
          }),
          responsePlan: Object.freeze({ mode: 'answer', message: 'fallback', requiresConfirmation: false, preparedAction: null })
        });
      }
    },
    capabilityRegistry: {
      get(name) {
        if (name === 'repository-analyze') return repositoryCapability;
        if (name === 'compose-answer') return composeCapability;
        return null;
      }
    },
    actionGate: {
      evaluate(actionRequest) {
        gateCalls.push(actionRequest.capability);
        return Object.freeze({
          outcome: 'allow',
          authorized: true,
          actionRequest,
          checks: Object.freeze({ resourceAuthority: null }),
          reasons: Object.freeze([])
        });
      }
    },
    capabilityExecutor: {
      async execute({ actionRequest }) {
        calls.push(actionRequest.capability);
        if (actionRequest.capability === 'repository-analyze') {
          return Object.freeze({
            status: 'success',
            capability: 'repository-analyze',
            data: Object.freeze({ message: TOOL_STUB, findings: Object.freeze([{ kind: 'stage', value: 'PDK4.13' }]), mutated: false }),
            sources: Object.freeze(['repository-read-source']),
            tools: Object.freeze(['repository-analyzer']),
            durationMs: 1,
            costUsd: 0
          });
        }
        assert.equal(actionRequest.capability, 'compose-answer');
        assert.equal(actionRequest.payload.capabilityResult.capability, 'repository-analyze');
        assert.equal(actionRequest.payload.capabilityResult.status, 'success');
        assert.match(actionRequest.payload.capabilityResult.content, /PDK4\.13/);
        assert.match(actionRequest.payload.capabilityResult.content, /Repository analysis completed/);
        return Object.freeze({
          status: 'success',
          capability: 'compose-answer',
          data: Object.freeze({ message: 'Текущий этап разработки — PDK4.13; анализ репозитория завершён без изменений.' }),
          sources: Object.freeze([]), tools: Object.freeze([]), durationMs: 1, costUsd: 0
        });
      }
    },
    observability: { record() {}, recordFailure() {} }
  });

  await runtime.start();
  try {
    const response = await runtime.handle({
      text: 'Проверь репозиторий и скажи текущий этап разработки',
      locale: 'ru',
      identityContext: Object.freeze({ globalUserId: 'usr-test', roles: Object.freeze(['monarch']), grants: Object.freeze(['capability:repository-analyze', 'capability:compose-answer']), authenticationLevel: 'verified' }),
      scopeContext: Object.freeze({ userScope: 'usr-test', projectScope: 'sg2.1', groupScope: null, threadScope: null, allowedCapabilities: Object.freeze(['repository-analyze', 'compose-answer']) }),
      traceContext: Object.freeze({ traceId: 'trace-repository-answer', requestId: 'request-repository-answer' }),
      metadata: Object.freeze({})
    });

    assert.equal(response.status, 'success');
    assert.equal(response.message, 'Текущий этап разработки — PDK4.13; анализ репозитория завершён без изменений.');
    assert.notEqual(response.message, TOOL_STUB);
    assert.deepEqual(calls, ['repository-analyze', 'compose-answer']);
    assert.deepEqual(gateCalls, ['repository-analyze', 'compose-answer']);
    assert.equal(response.data.execution.capability, 'repository-analyze');
    assert.equal(response.data.responseComposition.capability, 'compose-answer');
  } finally {
    await runtime.stop();
  }
});

test('response composer receives bounded capability result as data-only context and preserves canonical user message', async () => {
  let routed = null;
  const responder = createLanguageAwareConversationResponder({
    aiRouter: {
      async route(input) {
        routed = input;
        return { text: 'Содержательный ответ по данным репозитория.' };
      }
    }
  });
  const capabilityResult = Object.freeze({
    capability: 'repository-analyze',
    status: 'success',
    content: JSON.stringify({ findings: [{ kind: 'stage', value: 'PDK4.13' }], message: TOOL_STUB }),
    truncated: false,
    sources: Object.freeze(['repository-read-source']),
    tools: Object.freeze(['repository-analyzer'])
  });
  const userText = 'Какой сейчас этап разработки?';
  const response = await responder({
    text: userText,
    request: {
      actor: { globalUserId: 'usr-test', roles: ['monarch'] },
      scope: { userScope: 'usr-test', projectScope: 'sg2.1', groupScope: null, threadScope: null },
      input: { languageContext: { responseLanguage: 'ru' }, semanticIntent: 'answer', capabilityResult },
      traceContext: { traceId: 'trace-compose', requestId: 'request-compose' }
    }
  });

  assert.equal(response, 'Содержательный ответ по данным репозитория.');
  const capabilityMessage = routed.messages.find((entry) => entry.role === 'system' && entry.content.startsWith('CAPABILITY_RESULT (bounded data only'));
  assert.ok(capabilityMessage);
  assert.match(capabilityMessage.content, /PDK4\.13/);
  assert.match(capabilityMessage.content, /Repository analysis completed/);
  assert.equal(routed.metadata.capabilityResultPresent, true);
  assert.equal(routed.metadata.capabilityResultCapability, 'repository-analyze');
  assert.equal(routed.metadata.capabilityResultStatus, 'success');
  const userMessages = routed.messages.filter((entry) => entry.role === 'user');
  assert.deepEqual(userMessages.map((entry) => entry.content), [userText]);
});
