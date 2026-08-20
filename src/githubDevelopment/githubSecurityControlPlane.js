import { redactOperationalData } from '../operations/securityOperations.js';

export const GH3_SECURITY_CONTROL_PLANE_CONTRACT_VERSION = 1;
export const GH3_EMERGENCY_MODES = Object.freeze(['normal', 'read-only', 'disabled']);

function fail(code, message) { const error = new Error(message); error.name = 'GitHubSecurityControlPlaneError'; error.code = code; throw error; }
function required(value, field) { if (typeof value !== 'string' || value.trim() === '') fail('gh3-security-input-invalid', `${field} is required`); return value.trim(); }
function freeze(value) { if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value; for (const child of Object.values(value)) freeze(child); return Object.freeze(value); }
function mode(value) { const normalized = required(value ?? 'normal', 'emergency mode').toLowerCase(); if (!GH3_EMERGENCY_MODES.includes(normalized)) fail('gh3-security-emergency-mode-invalid', 'unsupported GitHub emergency mode'); return normalized; }
function mutation(definition) { return Number(definition?.riskTier) >= 2; }

export function createGitHubSecurityControlPlane({
  capabilityRegistry,
  accessControl,
  resourceAuthority,
  actionGate,
  credentialManager,
  ownerSecurity = null,
  rateLimiter = null,
  emergencyMode = () => 'normal',
  audit,
  clock = () => new Date()
} = {}) {
  if (typeof capabilityRegistry?.get !== 'function') throw new TypeError('capabilityRegistry.get is required');
  if (typeof accessControl?.assertAllowed !== 'function') throw new TypeError('accessControl.assertAllowed is required');
  if (typeof resourceAuthority?.checkAuthority !== 'function') throw new TypeError('resourceAuthority.checkAuthority is required');
  if (typeof actionGate?.evaluate !== 'function') throw new TypeError('actionGate.evaluate is required');
  if (typeof credentialManager?.useCredential !== 'function') throw new TypeError('credentialManager.useCredential is required');
  if (ownerSecurity && typeof ownerSecurity.evaluate !== 'function') throw new TypeError('ownerSecurity.evaluate must be a function');
  if (rateLimiter && typeof rateLimiter.consume !== 'function') throw new TypeError('rateLimiter.consume must be a function');
  if (typeof emergencyMode !== 'function' || typeof audit !== 'function' || typeof clock !== 'function') throw new TypeError('emergencyMode, audit and clock are required functions');

  async function record(event) {
    const safe = redactOperationalData(event);
    try { await audit(freeze(safe)); }
    catch { fail('gh3-security-audit-unavailable', 'GitHub security audit is unavailable'); }
  }

  async function authorize(request = {}) {
    const capability = required(request.capability, 'capability');
    const definition = capabilityRegistry.get(capability);
    if (!definition) fail('gh3-security-capability-unknown', 'GitHub capability is not registered');
    const actorGlobalUserId = required(request.actor?.globalUserId, 'actor.globalUserId');
    const projectScope = required(request.projectScope, 'projectScope');
    const repositoryResourceId = required(request.repositoryResourceId, 'repositoryResourceId');
    const currentMode = mode(await emergencyMode());
    const isMutation = mutation(definition);
    if (currentMode === 'disabled' || (currentMode === 'read-only' && isMutation)) fail('gh3-security-emergency-disabled', 'GitHub operation is blocked by emergency controls');
    if (definition.riskTier >= 3 && (request.confirmation?.confirmed !== true || request.confirmation?.requestId !== request.actionRequest?.traceContext?.requestId)) fail('gh3-security-separate-confirmation-required', 'high-risk GitHub operation requires separate request-bound confirmation');
    if (definition.riskTier >= 4 && request.ownerSecurityRequired !== true) fail('gh3-security-owner-control-required', 'repository administration requires Owner Security');
    if (rateLimiter) { const limit = await rateLimiter.consume({ actorGlobalUserId, projectScope, capability, repositoryResourceId }); if (limit?.allowed !== true) fail('gh3-security-rate-limited', 'GitHub operation rate limit exceeded'); }
    const acs = await accessControl.assertAllowed({ actor: request.actor, projectScope, capability, repositoryResourceId, branch: request.branch ?? null, paths: request.paths ?? [] });
    if (acs === false || acs?.allowed === false) fail('gh3-security-acs-denied', 'ACS denied GitHub operation');
    const relation = isMutation ? 'can_modify' : 'can_read';
    const authority = await resourceAuthority.checkAuthority({ actorGlobalUserId, resourceId: repositoryResourceId, projectScope, relation });
    if (authority?.allowed !== true) fail('gh3-security-resource-authority-denied', authority?.reason ?? 'Resource Authority denied GitHub operation');
    const ownerDecision = ownerSecurity && (definition.riskTier >= 4 || request.ownerSecurityRequired === true) ? await ownerSecurity.evaluate({ actor: request.actor, projectScope, operation: capability }) : null;
    if (ownerDecision?.allowed === false) fail('gh3-security-owner-denied', ownerDecision.reason ?? 'Owner Security denied GitHub operation');
    const actionRequest = { ...request.actionRequest, resourceAuthority: { ...authority, actorGlobalUserId, projectScope } };
    const gate = actionGate.evaluate(actionRequest, { ownerSecurityDecision: ownerDecision });
    if (gate?.outcome !== 'allow' || gate?.authorized !== true) fail('gh3-security-action-gate-denied', `Action Gate outcome: ${gate?.outcome ?? 'unknown'}`);
    const decision = freeze({ contractVersion: GH3_SECURITY_CONTROL_PLANE_CONTRACT_VERSION, allowed: true, capability, riskTier: definition.riskTier, actorGlobalUserId, projectScope, repositoryResourceId, emergencyMode: currentMode, relation, authorityId: authority.evidence?.authorityId ?? null, gateOutcome: gate.outcome, evaluatedAt: clock().toISOString() });
    await record({ eventClass: 'github_security_decision', channel: 'audit', outcome: 'allow', ...decision });
    return decision;
  }

  async function execute(request = {}, operation) {
    if (typeof operation !== 'function') throw new TypeError('operation callback is required');
    const decision = await authorize(request);
    try {
      const result = await credentialManager.useCredential({ credentialId: required(request.credentialId, 'credentialId'), actor: request.actor, scope: { projectScope: decision.projectScope }, permission: decision.capability, purpose: `gh3.${decision.capability}`, connectionId: request.connectionId ?? null, resourceId: decision.repositoryResourceId, operation });
      await record({ eventClass: 'github_security_execution', channel: 'audit', outcome: 'success', capability: decision.capability, actorGlobalUserId: decision.actorGlobalUserId, projectScope: decision.projectScope, repositoryResourceId: decision.repositoryResourceId, riskTier: decision.riskTier, result: { status: result?.status ?? 'completed' } });
      return freeze({ decision, result });
    } catch (error) {
      await record({ eventClass: 'github_security_execution', channel: 'audit', outcome: 'failure', capability: decision.capability, actorGlobalUserId: decision.actorGlobalUserId, projectScope: decision.projectScope, repositoryResourceId: decision.repositoryResourceId, riskTier: decision.riskTier, error: { code: error?.code ?? 'github-operation-failed' } });
      throw error;
    }
  }

  return Object.freeze({ authorize, execute });
}
