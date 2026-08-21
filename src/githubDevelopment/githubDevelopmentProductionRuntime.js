import { createCapability } from '../contracts/capability.js';
import { createGitHubTokenConnectionProvider } from './githubTokenConnectionProvider.js';
import { createGitHubRepositoryReadAnalysisService } from './githubRepositoryReadAnalysisService.js';
import { createGitHubAtomicCommitService } from './githubAtomicCommitService.js';
import { createGitHubDevelopmentExecutionService } from './githubDevelopmentExecutionService.js';

export const GITHUB_DEVELOPMENT_RUNTIME_CAPABILITY = 'github-development';

function value(input) { return typeof input === 'string' && input.trim() !== '' ? input.trim() : null; }

function tokenKey(env) {
  if (value(env.SG_GITHUB_DEVELOPMENT_TOKEN)) return 'SG_GITHUB_DEVELOPMENT_TOKEN';
  if (value(env.GITHUB_TOKEN)) return 'GITHUB_TOKEN';
  return null;
}

function repositoryResourceId(repository) { return `github:repo:${repository}`; }

function messageForUnavailable(locale, reason) {
  const language = String(locale ?? 'ru').toLowerCase();
  if (language.startsWith('uk')) return `GitHub Development Workspace недоступний: ${reason}.`;
  if (language.startsWith('en')) return `GitHub Development Workspace is unavailable: ${reason}.`;
  return `GitHub Development Workspace недоступен: ${reason}.`;
}

function successMessage(locale, result) {
  const short = String(result.commitSha ?? '').slice(0, 12);
  const files = (result.changedPaths ?? []).join(', ');
  const language = String(locale ?? 'ru').toLowerCase();
  if (language.startsWith('uk')) return `Виконано в ${result.repository}, гілка ${result.branch}. Commit ${short}. Змінено: ${files}. ${result.summary}`;
  if (language.startsWith('en')) return `Executed in ${result.repository} on ${result.branch}. Commit ${short}. Changed: ${files}. ${result.summary}`;
  return `Выполнено в ${result.repository}, ветка ${result.branch}. Commit ${short}. Изменено: ${files}. ${result.summary}`;
}

export function createProductionGitHubDevelopmentRuntime({
  env = process.env,
  credentialManager,
  credentialAccessContext,
  resourceAuthorityRegistry,
  resourceAuthorityAccessContext,
  ownerGlobalUserId,
  aiRouter = null,
  fetchImpl = globalThis.fetch,
  clock = () => new Date()
} = {}) {
  if (!credentialManager?.registerCredential || !credentialManager?.listCredentials) throw new TypeError('credentialManager is required');
  if (!credentialAccessContext?.actor || !credentialAccessContext?.scope) throw new TypeError('credentialAccessContext is required');
  if (!resourceAuthorityRegistry?.checkAuthority || !resourceAuthorityRegistry?.listResources || !resourceAuthorityRegistry?.registerResource || !resourceAuthorityRegistry?.listAuthorities || !resourceAuthorityRegistry?.grantAuthority) throw new TypeError('resourceAuthorityRegistry is required');
  if (!resourceAuthorityAccessContext?.actor || !resourceAuthorityAccessContext?.projectScope) throw new TypeError('resourceAuthorityAccessContext is required');

  const repository = value(env.SG_GITHUB_DEVELOPMENT_REPOSITORY) ?? 'korzh260609-beep/garya-bot';
  const branch = value(env.SG_GITHUB_DEVELOPMENT_BRANCH) ?? 'dev/sg2.1-semantic';
  const owner = value(ownerGlobalUserId);
  const key = tokenKey(env);
  const credentialId = 'sg.github.development';
  const connectionId = 'github-development';
  const resourceId = repositoryResourceId(repository);
  const existing = new Set(credentialManager.listCredentials().map((item) => item.credentialId));

  if (key && !existing.has(credentialId)) {
    credentialManager.registerCredential({
      credentialId,
      type: 'service-credential',
      secretRef: { provider: 'environment', key },
      ownerUserId: 'system:runtime',
      projectScope: credentialAccessContext.scope.projectScope,
      connectionId,
      requiredPermission: 'credential:use:system',
      metadata: { provider: 'github', purpose: 'gh3-production-development', authentication: 'deployment-token' }
    });
  }

  const configured = Boolean(key && aiRouter?.route && owner);
  let service = null;
  if (configured) {
    const provider = createGitHubTokenConnectionProvider({ credentialManager, credentialAccessContext, credentialId, connectionId });
    const repositoryReadService = createGitHubRepositoryReadAnalysisService({ fetchImpl, githubAppProvider: provider, clock });
    const atomicCommitService = createGitHubAtomicCommitService({ fetchImpl, githubAppProvider: provider, clock });
    service = createGitHubDevelopmentExecutionService({ aiRouter, repositoryReadService, atomicCommitService, repository, branch, connectionId, clock });
  }

  const availability = Object.freeze({
    capability: GITHUB_DEVELOPMENT_RUNTIME_CAPABILITY,
    configured,
    repository,
    branch,
    resourceId,
    authentication: key ? 'deployment-token' : 'unconfigured',
    credentialPresent: Boolean(key),
    aiAvailable: Boolean(aiRouter?.route),
    ownerBound: Boolean(owner)
  });

  async function start() {
    if (!configured) return availability;
    const projectScope = resourceAuthorityAccessContext.projectScope;
    const actor = resourceAuthorityAccessContext.actor;
    const resources = await resourceAuthorityRegistry.listResources({ projectScope, provider: 'github', actor });
    if (!resources.some((item) => item.resourceId === resourceId)) {
      await resourceAuthorityRegistry.registerResource({
        resourceId,
        resourceType: 'repository',
        provider: 'github',
        projectScope,
        externalResourceId: repository,
        verificationState: 'verified',
        metadata: { repository, branch, purpose: 'sg-github-development-workspace' },
        provenance: { source: 'deployment-config' },
        actor,
        purpose: 'gh3-production-resource-bootstrap'
      });
    }
    const authorities = await resourceAuthorityRegistry.listAuthorities({ projectScope, actorGlobalUserId: owner, resourceId, actor });
    if (!authorities.some((item) => item.state === 'active' && item.verificationState === 'verified' && ['owns', 'administers', 'manages', 'can_modify'].includes(item.relation))) {
      await resourceAuthorityRegistry.grantAuthority({
        authorityId: `gh3-owner:${owner}:${repository}`,
        resourceId,
        actorGlobalUserId: owner,
        projectScope,
        relation: 'can_modify',
        appliesToDescendants: false,
        verificationState: 'verified',
        verificationSource: 'canonical-owner-deployment-binding',
        provenance: { source: 'deployment-config', repository },
        actor,
        purpose: 'gh3-owner-authority-bootstrap'
      });
    }
    return availability;
  }

  const capability = createCapability({
    name: GITHUB_DEVELOPMENT_RUNTIME_CAPABILITY,
    version: '1.0.0',
    description: 'Execute a bounded instructed development change in the authorized SG GitHub repository.',
    actionTypes: ['github-development'],
    actionClasses: ['state-changing'],
    requiredPermissions: [`capability:${GITHUB_DEVELOPMENT_RUNTIME_CAPABILITY}`],
    requiredSources: [],
    requiredTools: [],
    risk: 'medium',
    estimatedCostUsd: 0.05,
    confirmationRequired: false,
    timeoutMs: 300000,
    maxRetries: 0,
    fallbackCapabilities: [],
    priority: 100,
    execute: async (request) => {
      if (!service) {
        const reason = !owner ? 'canonical owner is not configured' : (!key ? 'development credential is not configured' : 'AI Router is unavailable');
        return { status: 'unavailable', data: { message: messageForUnavailable(request.input?.locale, reason), availability }, error: { code: 'github-development-unavailable', message: reason, retryable: false } };
      }
      if (request.actor?.globalUserId !== owner) {
        const reason = 'actor is not the canonical owner authorized for this development workspace';
        return { status: 'failed', data: { message: messageForUnavailable(request.input?.locale, reason), availability }, error: { code: 'github-development-owner-denied', message: reason, retryable: false } };
      }
      const authority = await resourceAuthorityRegistry.checkAuthority({ actorGlobalUserId: request.actor.globalUserId, resourceId, projectScope: request.scope.projectScope, relation: 'can_modify' });
      if (authority?.allowed !== true) {
        const reason = authority?.reason ?? 'repository modification authority is unavailable';
        return { status: 'failed', data: { message: messageForUnavailable(request.input?.locale, reason), availability }, error: { code: 'github-development-authority-denied', message: reason, retryable: false } };
      }
      const instruction = request.input?.instruction ?? request.input?.text ?? request.input?.semanticMessage;
      try {
        const result = await service.execute({ instruction, actor: request.actor, traceContext: request.traceContext });
        return { status: 'success', data: { ...result, message: successMessage(request.input?.locale, result), availability, authority: { resourceId, relation: 'can_modify', reason: authority.reason } } };
      } catch (error) {
        const reason = error?.code ?? 'github-development-execution-failed';
        const detail = error?.message ?? 'GitHub development execution failed';
        return { status: 'failed', data: { message: messageForUnavailable(request.input?.locale, `${reason}: ${detail}`), availability }, error: { code: reason, message: detail, retryable: Boolean(error?.retryable) } };
      }
    }
  });

  return Object.freeze({ capability, availability, service, start });
}
