function required(value, name) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${name} is required`);
  return value.trim();
}

export function registerProductionDevelopmentKnowledgeCredential({ credentialManager, env = process.env, projectScope = 'sg2.1', credentialId = 'sg.github.pdk4' } = {}) {
  if (!credentialManager?.registerCredential) throw new TypeError('credentialManager.registerCredential is required');
  const tokenKey = typeof env.SG_PDK4_GITHUB_TOKEN === 'string' && env.SG_PDK4_GITHUB_TOKEN !== ''
    ? 'SG_PDK4_GITHUB_TOKEN'
    : (typeof env.GITHUB_TOKEN === 'string' && env.GITHUB_TOKEN !== '' ? 'GITHUB_TOKEN' : null);
  if (!tokenKey) return Object.freeze({ registered: false, credentialId: required(credentialId, 'credentialId'), tokenKey: null });
  const id = required(credentialId, 'credentialId');
  credentialManager.registerCredential({
    credentialId: id,
    type: 'service-credential',
    secretRef: { provider: 'environment', key: tokenKey },
    ownerUserId: 'system:runtime',
    projectScope: required(projectScope, 'projectScope'),
    connectionId: 'github-pdk4',
    requiredPermission: 'credential:use:system',
    metadata: { purpose: 'pdk4-production-github-read' }
  });
  return Object.freeze({ registered: true, credentialId: id, tokenKey });
}
