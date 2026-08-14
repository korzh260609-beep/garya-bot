import test from 'node:test';
import assert from 'node:assert/strict';
import { createFoundationResponse } from '../src/index.js';
import { createIdentityContext, createScopeContext, createTraceContext } from '../src/contracts/context.js';

 test('foundation response is scoped and traceable', () => {
  const result = createFoundationResponse({ input: 'test' });
  assert.equal(result.status, 'foundation-ready');
  assert.equal(result.scopeContext.projectScope, 'sg2.1');
  assert.ok(result.traceContext.traceId);
  assert.deepEqual(result.scopeContext.allowedCapabilities, []);
});

test('identity contract fails closed', () => {
  assert.throws(() => createIdentityContext({ platform: 'local', platformUserId: 'x' }), /globalUserId/);
});

test('scope contract fails closed', () => {
  assert.throws(() => createScopeContext({ userScope: 'u' }), /projectScope/);
});

test('trace contract fails closed', () => {
  assert.throws(() => createTraceContext({ traceId: 't', requestId: 'r', environment: 'test' }), /revision/);
});
