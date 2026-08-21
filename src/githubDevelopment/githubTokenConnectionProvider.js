function required(value, field) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${field} is required`);
  return value.trim();
}

export function createGitHubTokenConnectionProvider({
  credentialManager,
  credentialAccessContext,
  credentialId = 'sg.github.development',
  connectionId = 'github-development'
} = {}) {
  if (!credentialManager?.useCredential) throw new TypeError('credentialManager.useCredential is required');
  if (!credentialAccessContext?.actor || !credentialAccessContext?.scope) throw new TypeError('credentialAccessContext is required');
  const id = required(credentialId, 'credentialId');
  const connection = required(connectionId, 'connectionId');

  async function withInstallationToken({ connectionId: requestedConnectionId = connection, capability, repository = null, operation } = {}) {
    if (requestedConnectionId !== connection) throw new Error('gh3-connection-mismatch');
    if (typeof operation !== 'function') throw new TypeError('operation callback is required');
    const requestedCapability = required(capability, 'capability');
    return credentialManager.useCredential({
      credentialId: id,
      actor: credentialAccessContext.actor,
      scope: credentialAccessContext.scope,
      permission: 'credential:use:system',
      purpose: `gh3.${requestedCapability}`,
      connectionId: connection,
      operation: async (token) => operation(token, Object.freeze({
        connectionId: connection,
        repository: repository?.fullName ?? null,
        credentialId: id,
        capability: requestedCapability,
        authentication: 'deployment-token'
      }))
    });
  }

  async function verifyConnection() {
    return Object.freeze({ connectionId: connection, credentialId: id, authentication: 'deployment-token' });
  }

  return Object.freeze({ withInstallationToken, verifyConnection });
}
