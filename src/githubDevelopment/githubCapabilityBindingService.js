import { CANONICAL_GITHUB_ACTIONS } from '../contracts/semantic.js';

const ACTION_CAPABILITIES = Object.freeze({
  'github.repository.inspect': ['github.repository.read'],
  'github.code.search': ['github.code.search'],
  'github.file.read': ['github.repository.read'],
  'github.file.create': ['github.contents.write', 'github.commit.create'],
  'github.file.update': ['github.contents.write', 'github.commit.create'],
  'github.file.delete': ['github.contents.write', 'github.commit.create'],
  'github.development.plan': ['github.repository.read', 'github.code.search'],
  'github.development.execute': ['github.repository.read', 'github.code.search', 'github.contents.write', 'github.commit.create'],
  'github.test.run': ['github.actions.dispatch'],
  'github.commit.create': ['github.commit.create'],
  'github.push.execute': ['github.contents.write'],
  'github.ci.verify': ['github.actions.read'],
  'github.pr.inspect': ['github.pull-request.read'],
  'github.pr.create': ['github.pull-request.write'],
  'github.issue.inspect': ['github.issue.read'],
  'github.issue.create': ['github.issue.write'],
  'github.issue.update': ['github.issue.write'],
  'github.issue.close': ['github.issue.write'],
  'github.pr.update': ['github.pull-request.write'],
  'github.review.inspect': ['github.review.read'],
  'github.review.respond': ['github.review.write'],
  'github.branch.inspect': ['github.repository.read'],
  'github.branch.create': ['github.branch.create'],
  'github.branch.compare': ['github.repository.read'],
  'github.discovery.public': ['github.discovery.public.read'],
  'github.discovery.private': ['github.repository.read'],
  'github.workflow.inspect': ['github.actions.read'],
  'github.workflow.rerun': ['github.actions.rerun'],
  'github.release.create': ['github.release.write'],
  'github.development.continue': ['github.repository.read']
});

const PROVIDER_REQUIREMENTS = Object.freeze({
  'github.repository.read': ['contents', 'read'],
  'github.code.search': ['contents', 'read'],
  'github.branch.create': ['contents', 'write'],
  'github.contents.write': ['contents', 'write'],
  'github.commit.create': ['contents', 'write'],
  'github.pull-request.read': ['pull_requests', 'read'],
  'github.pull-request.write': ['pull_requests', 'write'],
  'github.review.read': ['pull_requests', 'read'],
  'github.review.write': ['pull_requests', 'write'],
  'github.issue.read': ['issues', 'read'],
  'github.issue.write': ['issues', 'write'],
  'github.actions.read': ['actions', 'read'],
  'github.actions.dispatch': ['actions', 'write'],
  'github.actions.rerun': ['actions', 'write'],
  'github.release.write': ['contents', 'write'],
  'github.repository.admin': ['administration', 'admin']
});

const BLOCKERS = Object.freeze({
  'gh3-security-capability-unknown': 'registered-capability-missing',
  'gh3-security-acs-denied': 'actor-capability-denied',
  'gh3-security-resource-authority-denied': 'resource-authority-denied',
  'gh3-security-action-gate-denied': 'action-gate-denied',
  'gh3-security-separate-confirmation-required': 'action-gate-confirmation-required',
  'gh3-security-owner-control-required': 'owner-security-required',
  'gh3-security-owner-denied': 'owner-security-denied',
  'gh3-security-emergency-disabled': 'emergency-mode-blocked',
  'connection-not-found': 'missing-github-connection',
  'connection-unavailable': 'github-connection-unavailable',
  'connection-revoked': 'github-connection-revoked',
  'connection-capability-unavailable': 'connection-capability-unavailable',
  'connection-permission-denied': 'connection-access-denied',
  'gh3-repository-not-selected': 'repository-outside-authorized-installation',
  'gh3-provider-permission-unavailable': 'missing-provider-permission',
  'gh3-connection-mismatch': 'github-connection-mismatch'
});

function fail(code, message) { const error = new Error(message); error.code = code; throw error; }
function value(input, field) { if (typeof input !== 'string' || !input.trim()) fail('gde2-input-invalid', `${field} is required`); return input.trim(); }
function freeze(input) { if (!input || typeof input !== 'object' || Object.isFrozen(input)) return input; for (const nested of Object.values(input)) freeze(nested); return Object.freeze(input); }
function blocker(error, capability) { return freeze({ code: BLOCKERS[error?.code] ?? 'capability-check-failed', sourceCode: error?.code ?? 'unknown', capability, detail: error?.message ?? 'capability check failed', retryable: Boolean(error?.retryable) }); }

function message(locale, action, available, blockers) {
  const language = String(locale ?? 'ru').toLowerCase();
  if (available) {
    if (language.startsWith('uk')) return `GitHub-дія ${action} доступна за поточними підключенням і повноваженнями.`;
    if (language.startsWith('en')) return `GitHub action ${action} is available under the current connection and authority.`;
    return `GitHub-действие ${action} доступно при текущем подключении и полномочиях.`;
  }
  const reason = blockers.map((item) => item.code).join(', ');
  if (language.startsWith('uk')) return `GitHub-дія ${action} недоступна. Причина: ${reason}.`;
  if (language.startsWith('en')) return `GitHub action ${action} is unavailable. Reason: ${reason}.`;
  return `GitHub-действие ${action} недоступно. Причина: ${reason}.`;
}

export const CANONICAL_GITHUB_ACTION_CAPABILITY_BINDINGS = freeze(ACTION_CAPABILITIES);
export const GITHUB_PROVIDER_CAPABILITY_REQUIREMENTS = freeze(PROVIDER_REQUIREMENTS);

export function createGitHubProviderCapabilityProbe({ connectionProvider } = {}) {
  if (!connectionProvider?.withInstallationToken) throw new TypeError('connectionProvider.withInstallationToken is required');
  return freeze({
    async check({ connectionId, capability, repository }) {
      const requirement = PROVIDER_REQUIREMENTS[capability];
      if (!requirement) fail('gde2-provider-requirement-missing', `provider requirement is missing for ${capability}`);
      const [permission, access] = requirement;
      return connectionProvider.withInstallationToken({
        connectionId,
        capability,
        repository,
        requiredProviderPermission: permission,
        operation: async (_secret, authority) => {
          const actual = authority?.permissions?.[permission];
          if (actual && access === 'write' && !['write', 'admin'].includes(actual)) fail('gh3-provider-permission-unavailable', `${permission}:write is required`);
          if (actual && access === 'admin' && actual !== 'admin') fail('gh3-provider-permission-unavailable', `${permission}:admin is required`);
          return freeze({ allowed: true, permission, access, authority: { connectionId: authority?.connectionId ?? connectionId, repository: authority?.repository ?? repository?.fullName ?? null, repositorySelection: authority?.repositorySelection ?? null } });
        }
      });
    }
  });
}

export function createGitHubCapabilityBindingService({ capabilityRegistry, securityControlPlane, providerCapabilityProbe, clock = () => new Date() } = {}) {
  if (!capabilityRegistry?.get) throw new TypeError('capabilityRegistry.get is required');
  if (!securityControlPlane?.authorize) throw new TypeError('securityControlPlane.authorize is required');
  if (!providerCapabilityProbe?.check) throw new TypeError('providerCapabilityProbe.check is required');
  if (typeof clock !== 'function') throw new TypeError('clock is required');
  return freeze({
    name: 'gde2-github-capability-binding',
    async assess({ canonicalAction, actor, projectScope, repository, repositoryResourceId, branch, paths = [], connectionId, credentialId, actionRequest, confirmation = null, ownerSecurityRequired = false, locale = 'ru' } = {}) {
      const action = value(canonicalAction, 'canonicalAction');
      if (!CANONICAL_GITHUB_ACTIONS.includes(action)) fail('gde2-canonical-action-unsupported', `unsupported canonical GitHub action: ${action}`);
      const capabilities = ACTION_CAPABILITIES[action];
      const checks = [];
      const blockers = [];
      for (const capability of capabilities) {
        const definition = capabilityRegistry.get(capability);
        if (!definition) { blockers.push(blocker({ code: 'gh3-security-capability-unknown', message: 'capability is not registered' }, capability)); break; }
        try {
          const scopedActionRequest = freeze({
            ...actionRequest,
            capability,
            actionType: action,
            actionClass: definition.riskTier >= 2 ? 'state-changing' : 'read-only',
            actor,
            scope: { ...(actionRequest?.scope ?? {}), userScope: actionRequest?.scope?.userScope ?? actor?.globalUserId, projectScope, allowedCapabilities: [...new Set([...(actionRequest?.scope?.allowedCapabilities ?? []), capability])] },
            requiredPermission: `capability:${capability}`,
            resourceAuthority: null,
            risk: definition.riskTier >= 4 ? 'critical' : definition.riskTier >= 2 ? 'medium' : 'low',
            estimatedCostUsd: 0,
            confirmationRequired: definition.riskTier >= 3,
            traceContext: actionRequest?.traceContext
          });
          const security = await securityControlPlane.authorize({ capability, actor, projectScope, repositoryResourceId, branch, paths, credentialId, connectionId, actionRequest: scopedActionRequest, confirmation, ownerSecurityRequired });
          const provider = await providerCapabilityProbe.check({ connectionId, capability, repository, credentialId });
          checks.push(freeze({ capability, registered: true, security, provider }));
        } catch (error) {
          blockers.push(blocker(error, capability));
          break;
        }
      }
      const available = blockers.length === 0 && checks.length === capabilities.length;
      return freeze({
        contractVersion: 1,
        canonicalAction: action,
        available,
        capabilities,
        checks,
        blockers,
        message: message(locale, action, available, blockers),
        selfKnowledge: {
          category: 'capability-state',
          key: `github:${action}`,
          value: { available, capabilities, blockers: blockers.map((item) => item.code), repository: repository?.fullName ?? null, branch: branch ?? null, localFilesystemRelevant: false },
          status: available ? 'implemented' : 'disabled',
          provenance: { sourceType: 'runtime-evidence', sourceId: 'gde2-github-capability-binding', observedAt: clock().toISOString() },
          grantsAuthority: false
        }
      });
    }
  });
}
