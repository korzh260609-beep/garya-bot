export function createIdentityAndScopeService({ identityResolver, scopeResolver } = {}) {
  if (!identityResolver?.resolve) throw new TypeError('identityResolver is required');
  if (!scopeResolver?.resolve || !scopeResolver?.assertBounded) throw new TypeError('scopeResolver is required');

  return Object.freeze({
    resolve({ platform, platformUserId, authenticationLevel, projectScope, groupScope, threadScope, dataClassification }) {
      const identityContext = identityResolver.resolve({ platform, platformUserId, authenticationLevel });
      const scopeContext = scopeResolver.resolve({
        identityContext,
        projectScope,
        groupScope,
        threadScope,
        dataClassification
      });
      scopeResolver.assertBounded(identityContext, scopeContext);
      return Object.freeze({ identityContext, scopeContext });
    }
  });
}
