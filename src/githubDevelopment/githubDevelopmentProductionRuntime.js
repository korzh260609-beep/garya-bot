import { createCapability } from '../contracts/capability.js';
import { createGitHubTokenConnectionProvider } from './githubTokenConnectionProvider.js';
import { createGitHubRepositoryReadAnalysisService } from './githubRepositoryReadAnalysisService.js';
import { createGitHubAtomicCommitService } from './githubAtomicCommitService.js';
import { createGitHubDevelopmentExecutionService } from './githubDevelopmentExecutionService.js';
import { createGitHubChangeSetValidationService } from './githubChangeSetValidationService.js';
import { createGitHubValidatedCommitLifecycle } from './githubValidatedCommitLifecycle.js';

export const GITHUB_DEVELOPMENT_RUNTIME_CAPABILITY = 'github-development';

function value(input) { return typeof input === 'string' && input.trim() !== '' ? input.trim() : null; }
function tokenKey(env) { if (value(env.SG_GITHUB_DEVELOPMENT_TOKEN)) return 'SG_GITHUB_DEVELOPMENT_TOKEN'; if (value(env.GITHUB_TOKEN)) return 'GITHUB_TOKEN'; return null; }
function repositoryResourceId(repository) { return `github:repo:${repository}`; }
function repositoryIdentity(repository) { const [owner, name] = repository.split('/'); return Object.freeze({ owner, name, fullName: repository }); }
function messageForUnavailable(locale, reason) { const language = String(locale ?? 'ru').toLowerCase(); if (language.startsWith('uk')) return `GitHub Development Workspace недоступний: ${reason}.`; if (language.startsWith('en')) return `GitHub Development Workspace is unavailable: ${reason}.`; return `GitHub Development Workspace недоступен: ${reason}.`; }
function statusMessage(locale, availability, authority) { const language = String(locale ?? 'ru').toLowerCase(); const ready = availability.configured && authority?.allowed === true; const state = ready ? 'готов' : 'не готов'; if (language.startsWith('uk')) return `GitHub Development Workspace ${ready ? 'готовий' : 'не готовий'}: ${availability.repository}, гілка ${availability.branch}. Credential: ${availability.credentialPresent ? 'є' : 'немає'}, authority: ${authority?.allowed === true ? 'can_modify' : authority?.reason ?? 'unavailable'}.`; if (language.startsWith('en')) return `GitHub Development Workspace is ${ready ? 'ready' : 'not ready'}: ${availability.repository}, branch ${availability.branch}. Credential: ${availability.credentialPresent ? 'present' : 'missing'}, authority: ${authority?.allowed === true ? 'can_modify' : authority?.reason ?? 'unavailable'}.`; return `GitHub Development Workspace ${state}: ${availability.repository}, ветка ${availability.branch}. Credential: ${availability.credentialPresent ? 'есть' : 'нет'}, authority: ${authority?.allowed === true ? 'can_modify' : authority?.reason ?? 'unavailable'}.`; }
function successMessage(locale, result) { const short = String(result.commitSha ?? '').slice(0, 12); const files = (result.changedPaths ?? []).join(', '); const language = String(locale ?? 'ru').toLowerCase(); if (language.startsWith('uk')) return `Виконано в ${result.repository}, гілка ${result.branch}. Commit ${short}. Змінено: ${files}. ${result.summary}`; if (language.startsWith('en')) return `Executed in ${result.repository} on ${result.branch}. Commit ${short}. Changed: ${files}. ${result.summary}`; return `Выполнено в ${result.repository}, ветка ${result.branch}. Commit ${short}. Изменено: ${files}. ${result.summary}`; }
function targetConflict(input, repository, branch) {
  const target = input?.canonicalTarget;
  if (!target || typeof target !== 'object') return null;
  const requestedRepository = value(target.repository);
  const requestedBranch = value(target.branch);
  if (requestedRepository && requestedRepository.toLowerCase() !== repository.toLowerCase()) return `requested repository ${requestedRepository} is outside the configured development workspace`;
  if (requestedBranch && requestedBranch !== branch) return `requested branch ${requestedBranch} is outside the configured development workspace`;
  return null;
}

export function createProductionGitHubDevelopmentRuntime({ env = process.env, credentialManager, credentialAccessContext, resourceAuthorityRegistry, resourceAuthorityAccessContext, ownerGlobalUserId, aiRouter = null, capabilityBindingService = null, githubSecurityControlPlane = null, platformOperationsService = null, validationChecks = [], fetchImpl = globalThis.fetch, clock = () => new Date() } = {}) {
  if (!credentialManager?.registerCredential || !credentialManager?.listCredentials) throw new TypeError('credentialManager is required');
  if (!credentialAccessContext?.actor || !credentialAccessContext?.scope) throw new TypeError('credentialAccessContext is required');
  if (!resourceAuthorityRegistry?.checkAuthority || !resourceAuthorityRegistry?.listResources || !resourceAuthorityRegistry?.registerResource || !resourceAuthorityRegistry?.listAuthorities || !resourceAuthorityRegistry?.grantAuthority) throw new TypeError('resourceAuthorityRegistry is required');
  if (!resourceAuthorityAccessContext?.actor || !resourceAuthorityAccessContext?.projectScope) throw new TypeError('resourceAuthorityAccessContext is required');
  const repository = value(env.SG_GITHUB_DEVELOPMENT_REPOSITORY) ?? 'korzh260609-beep/garya-bot';
  const branch = value(env.SG_GITHUB_DEVELOPMENT_BRANCH) ?? 'dev/sg2.1-semantic';
  if (branch === 'main' || branch === 'master') throw new TypeError('SG GitHub development branch must not be a protected default branch');
  const owner = value(ownerGlobalUserId); const key = tokenKey(env); const credentialId = 'sg.github.development'; const connectionId = 'github-development'; const resourceId = repositoryResourceId(repository);
  const existing = new Set(credentialManager.listCredentials().map((item) => item.credentialId));
  if (key && !existing.has(credentialId)) credentialManager.registerCredential({ credentialId, type: 'service-credential', secretRef: { provider: 'environment', key }, ownerUserId: 'system:runtime', projectScope: credentialAccessContext.scope.projectScope, connectionId, requiredPermission: 'credential:use:system', metadata: { provider: 'github', purpose: 'gh3-production-development', authentication: 'deployment-token' } });
  const configured = Boolean(key && aiRouter?.route && owner); let service = null;
  if (configured) { const provider = createGitHubTokenConnectionProvider({ credentialManager, credentialAccessContext, credentialId, connectionId }); const repositoryReadService = createGitHubRepositoryReadAnalysisService({ fetchImpl, githubAppProvider: provider, clock }); const atomicCommitService = createGitHubAtomicCommitService({ fetchImpl, githubAppProvider: provider, clock }); const commitLifecycle = githubSecurityControlPlane ? createGitHubValidatedCommitLifecycle({ validationService: createGitHubChangeSetValidationService({ checks: validationChecks }), securityControlPlane: githubSecurityControlPlane, atomicCommitService, repositoryReadService }) : null; service = createGitHubDevelopmentExecutionService({ aiRouter, repositoryReadService, atomicCommitService, commitLifecycle, repository, branch, connectionId, clock }); }
  const availability = Object.freeze({ capability: GITHUB_DEVELOPMENT_RUNTIME_CAPABILITY, configured, repository, branch, resourceId, authentication: key ? 'deployment-token' : 'unconfigured', credentialPresent: Boolean(key), aiAvailable: Boolean(aiRouter?.route), ownerBound: Boolean(owner), canonicalRuntimeBinding: true });
  async function start() { if (!configured) return availability; const projectScope = resourceAuthorityAccessContext.projectScope; const actor = resourceAuthorityAccessContext.actor; const resources = await resourceAuthorityRegistry.listResources({ projectScope, provider: 'github', actor }); if (!resources.some((item) => item.resourceId === resourceId)) await resourceAuthorityRegistry.registerResource({ resourceId, resourceType: 'repository', provider: 'github', projectScope, externalResourceId: repository, verificationState: 'verified', metadata: { repository, branch, purpose: 'sg-github-development-workspace' }, provenance: { source: 'deployment-config' }, actor, purpose: 'gh3-production-resource-bootstrap' }); const authorities = await resourceAuthorityRegistry.listAuthorities({ projectScope, actorGlobalUserId: owner, resourceId, includeRevoked: true, actor }); if (authorities.length === 0) await resourceAuthorityRegistry.grantAuthority({ authorityId: `gh3-owner:${owner}:${repository}`, resourceId, actorGlobalUserId: owner, projectScope, relation: 'can_modify', appliesToDescendants: false, verificationState: 'verified', verificationSource: 'canonical-owner-deployment-binding', provenance: { source: 'deployment-config', repository }, actor, purpose: 'gh3-owner-authority-bootstrap' }); return availability; }
  async function authorityFor(request) { if (request.actor?.globalUserId !== owner) return Object.freeze({ allowed: false, reason: 'canonical-owner-required' }); try { return await resourceAuthorityRegistry.checkAuthority({ actorGlobalUserId: request.actor.globalUserId, resourceId, projectScope: request.scope.projectScope, relation: 'can_modify' }); } catch (error) { return Object.freeze({ allowed: false, reason: error?.code ?? 'resource-authority-resolution-failed' }); } }
  async function assess(request, canonicalAction) {
    if (!capabilityBindingService) return null;
    return capabilityBindingService.assess({ canonicalAction, actor: request.actor, projectScope: request.scope.projectScope, repository: repositoryIdentity(repository), repositoryResourceId: resourceId, branch, paths: request.input?.paths ?? request.input?.canonicalTarget?.paths ?? [], connectionId, credentialId, actionRequest: request.actionRequest, confirmation: request.input?.confirmation ?? request.actionRequest?.confirmation ?? null, locale: request.input?.locale });
  }
  const capability = createCapability({
    name: GITHUB_DEVELOPMENT_RUNTIME_CAPABILITY, version: '1.0.0', description: 'Report deterministic GitHub development availability or execute a bounded instructed development change in the authorized SG repository.',
    actionTypes: ['github-development', 'github-development-status'], actionClasses: ['read-only', 'state-changing'], requiredPermissions: [`capability:${GITHUB_DEVELOPMENT_RUNTIME_CAPABILITY}`], requiredSources: [], requiredTools: [], risk: 'medium', estimatedCostUsd: 0.05, confirmationRequired: false, timeoutMs: 300000, maxRetries: 0, fallbackCapabilities: [], priority: 100,
    execute: async (request) => {
      const authority = await authorityFor(request);
      const canonicalAction = request.input?.canonicalAction ?? (request.input?.mode === 'status' ? 'github.repository.inspect' : 'github.development.execute');
      const conflict = targetConflict(request.input, repository, branch);
      if (conflict) return { status: 'failed', data: { message: messageForUnavailable(request.input?.locale, conflict), availability, authority }, error: { code: 'github-development-target-outside-workspace', message: conflict, retryable: false } };
      if (request.actionRequest?.actionType === 'github-development-status' || request.input?.mode === 'status') {
        try {
          const capabilityAssessment = await assess(request, canonicalAction);
          return { status: 'success', data: { message: capabilityAssessment?.message ?? statusMessage(request.input?.locale, availability, authority), availability, authority, capabilityAssessment } };
        } catch (error) {
          return { status: 'failed', data: { message: messageForUnavailable(request.input?.locale, `${error?.code ?? 'github-capability-assessment-failed'}: ${error?.message ?? 'capability assessment failed'}`), availability, authority }, error: { code: error?.code ?? 'github-capability-assessment-failed', message: error?.message ?? 'capability assessment failed', retryable: Boolean(error?.retryable) } };
        }
      }
      if (canonicalAction && !['github.development.execute','github.development.plan'].includes(canonicalAction)) {
        if (!platformOperationsService?.execute) return { status: 'unavailable', data: { message: messageForUnavailable(request.input?.locale, 'GitHub platform operations are not configured'), availability }, error: { code: 'github-platform-operations-unavailable', message: 'GitHub platform operations are not configured', retryable: false } };
        try { const result = await platformOperationsService.execute({ ...(request.input?.platformOperation ?? {}), canonicalAction, actor: request.actor, projectScope: request.scope.projectScope, traceContext: request.traceContext, actionRequest: request.actionRequest }); return { status: 'success', data: { ...result, availability, authority } }; }
        catch (error) { return { status: 'failed', data: { message: messageForUnavailable(request.input?.locale, `${error?.code ?? 'github-platform-operation-failed'}: ${error?.message ?? 'operation failed'}`), availability }, error: { code: error?.code ?? 'github-platform-operation-failed', message: error?.message ?? 'operation failed', retryable: Boolean(error?.retryable) } }; }
      }
      if (!service) { const reason = !owner ? 'canonical owner is not configured' : (!key ? 'development credential is not configured' : 'AI Router is unavailable'); return { status: 'unavailable', data: { message: messageForUnavailable(request.input?.locale, reason), availability }, error: { code: 'github-development-unavailable', message: reason, retryable: false } }; }
      if (authority?.allowed !== true) { const reason = authority?.reason ?? 'repository modification authority is unavailable'; return { status: 'failed', data: { message: messageForUnavailable(request.input?.locale, reason), availability }, error: { code: 'github-development-authority-denied', message: reason, retryable: false } }; }
      let capabilityAssessment = null;
      if (capabilityBindingService) {
        try { capabilityAssessment = await assess(request, canonicalAction); }
        catch (error) { return { status: 'failed', data: { message: messageForUnavailable(request.input?.locale, `${error?.code ?? 'github-capability-assessment-failed'}: ${error?.message ?? 'capability assessment failed'}`), availability, authority }, error: { code: error?.code ?? 'github-capability-assessment-failed', message: error?.message ?? 'capability assessment failed', retryable: Boolean(error?.retryable) } }; }
        if (capabilityAssessment?.available !== true) { const reason = capabilityAssessment?.blockers?.map((item) => item.code).join(', ') || 'current GitHub capability assessment denied execution'; return { status: 'unavailable', data: { message: capabilityAssessment?.message ?? messageForUnavailable(request.input?.locale, reason), availability, authority, capabilityAssessment }, error: { code: 'github-development-capability-unavailable', message: reason, retryable: false } }; }
      }
      const instruction = request.input?.instruction ?? request.input?.text ?? request.input?.semanticMessage;
      try { const result = await service.execute({ instruction, actor: request.actor, traceContext: request.traceContext, projectScope: request.scope.projectScope, repositoryResourceId: resourceId, actionRequest: request.actionRequest }); return { status: 'success', data: { ...result, message: successMessage(request.input?.locale, result), availability, authority: { resourceId, relation: 'can_modify', reason: authority.reason }, capabilityAssessment } }; }
      catch (error) { const reason = error?.code ?? 'github-development-execution-failed'; const detail = error?.message ?? 'GitHub development execution failed'; return { status: 'failed', data: { message: messageForUnavailable(request.input?.locale, `${reason}: ${detail}`), availability, capabilityAssessment }, error: { code: reason, message: detail, retryable: Boolean(error?.retryable) } }; }
    }
  });
  return Object.freeze({ capability, availability, service, start });
}