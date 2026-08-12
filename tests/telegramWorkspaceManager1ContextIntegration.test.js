import test from 'node:test';
import assert from 'node:assert/strict';
import { createScopeContext } from '../src/contracts/context.js';

test('TWM1.1: canonical request scope carries optional Telegram workspace root', () => {
  const scope = createScopeContext({
    userScope: 'usr_48cc07c069030fb3',
    projectScope: 'sg2.1',
    groupScope: 'telegram:-100123',
    workspaceScope: 'tgw_workspace_a_1234',
    allowedCapabilities: ['compose-answer']
  });

  assert.equal(scope.workspaceScope, 'tgw_workspace_a_1234');
  assert.equal(scope.groupScope, 'telegram:-100123');
  assert.ok(Object.isFrozen(scope));
});

test('TWM1.1: existing non-workspace request scopes remain backward compatible', () => {
  const scope = createScopeContext({
    userScope: 'usr_a',
    projectScope: 'sg2.1'
  });
  assert.equal(scope.workspaceScope, null);
});

test('TWM1.1: non-canonical workspace scope fails closed at the canonical context boundary', () => {
  assert.throws(
    () => createScopeContext({
      userScope: 'usr_a',
      projectScope: 'sg2.1',
      workspaceScope: 'telegram:-100123'
    }),
    /canonical tgw_\* workspace id/i
  );
});
