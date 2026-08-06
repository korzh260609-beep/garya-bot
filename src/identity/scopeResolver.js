import { createScopeContext } from '../contracts/context.js';

function required(value, field) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${field} is required`);
  return value;
}

export function createScopeResolver({ capabilityPolicy = () => [] } = {}) {
  if (typeof capabilityPolicy !== 'function') throw new TypeError('capabilityPolicy must be a function');
  return Object.freeze({
    resolve({ identityContext, projectScope, groupScope = null, threadScope = null, dataClassification = 'internal' }) {
      if (!identityContext?.globalUserId) throw new TypeError('identityContext is required');
      required(projectScope, 'projectScope');
      if (threadScope && !groupScope) throw new TypeError('threadScope requires groupScope');
      const allowedCapabilities = capabilityPolicy({ identityContext, projectScope, groupScope, threadScope });
      return createScopeContext({
        userScope: identityContext.globalUserId,
        projectScope,
        groupScope,
        threadScope,
        dataClassification,
        allowedCapabilities
      });
    },
    assertBounded(identityContext, scopeContext) {
      if (!identityContext?.globalUserId || !scopeContext?.userScope) throw new TypeError('identity and scope contexts are required');
      if (identityContext.globalUserId !== scopeContext.userScope) throw new TypeError('Scope does not belong to resolved identity');
      required(scopeContext.projectScope, 'projectScope');
      if (scopeContext.threadScope && !scopeContext.groupScope) throw new TypeError('threadScope requires groupScope');
      return true;
    }
  });
}
