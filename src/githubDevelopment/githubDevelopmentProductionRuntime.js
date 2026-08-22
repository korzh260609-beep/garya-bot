import { createCapability } from '../contracts/capability.js';
import { createGitHubTokenConnectionProvider } from './githubTokenConnectionProvider.js';
import { createGitHubRepositoryReadAnalysisService } from './githubRepositoryReadAnalysisService.js';
import { createGitHubAtomicCommitService } from './githubAtomicCommitService.js';
import { createGitHubDevelopmentExecutionService } from './githubDevelopmentExecutionService.js';
import { createGitHubChangeSetValidationService } from './githubChangeSetValidationService.js';
import { createGitHubValidatedCommitLifecycle } from './githubValidatedCommitLifecycle.js';
import { createGitHubDevelopmentProductionComposition } from './githubDevelopmentProductionComposition.js';
import { CANONICAL_GITHUB_ACTION_CAPABILITY_BINDINGS } from './githubCapabilityBindingService.js';

export const GITHUB_DEVELOPMENT_RUNTIME_CAPABILITY = 'github-development';

function value(input) { return typeof input === 'string' && input.trim() !== '' ? input.trim() : null; }
function tokenKey(env) { if (value(env.SG_GITHUB_DEVELOPMENT_TOKEN)) return 'SG_GITHUB_DEVELOPMENT_TOKEN'; if (value(env.GITHUB_TOKEN)) return 'GITHUB_TOKEN'; return null; }
function githubAppConfigured(env) { return Boolean(value(env.GITHUB_APP_ID) && value(env.GITHUB_APP_INSTALLATION_ID) && (value(env.GITHUB_APP_PRIVATE_KEY) || value(env.GITHUB_APP_PRIVATE_KEY_BASE64))); }
function repositoryResourceId(repository) { return `github:repo:${repository}`; }
function repositoryIdentity(repository) { const [owner, name] = repository.split('/'); return Object.freeze({ owner, name, fullName: repository }); }
function responseLanguage(request) { return value(request?.input?.languageContext?.responseLanguage) ?? value(request?.input?.locale) ?? 'ru'; }
function primaryCapability(canonicalAction) { return CANONICAL_GITHUB_ACTION_CAPABILITY_BINDINGS[canonicalAction]?.[0] ?? 'github.repository.read'; }
function messageForUnavailable(locale, reason) { const language = String(locale ?? 'ru').toLowerCase(); if (language.startsWith('uk')) return `GitHub Development Workspace недоступний: ${reason}.`; if (language.startsWith('en')) return `GitHub Development Workspace is unavailable: ${reason}.`; return `GitHub Development Workspace недоступен: ${reason}.`; }
function statusMessage(locale, availability, authority) { const language = String(locale ?? 'ru').toLowerCase(); const ready = availability.configured && authority?.allowed === true; if (language.startsWith('uk')) return ready ? `GitHub Development Workspace готовий. Репозиторій: ${availability.repository}. Гілка: ${availability.branch}. Доступ підтверджено: можу читати репозиторій і виконувати дозволені зміни.` : `GitHub Development Workspace не готовий. Репозиторій: ${availability.repository}. Гілка: ${availability.branch}. Доступ або право на зміни не підтверджено.`; if (language.startsWith('en')) return ready ? `GitHub Development Workspace is ready. Repository: ${availability.repository}. Branch: ${availability.branch}. Access is verified: I can read the repository and perform authorized changes.` : `GitHub Development Workspace is not ready. Repository: ${availability.repository}. Branch: ${availability.branch}. Access or modification authority is not verified.`; return ready ? `GitHub Development Workspace готов. Репозиторий: ${availability.repository}. Ветка: ${availability.branch}. Доступ подтверждён: могу читать репозиторий и выполнять разрешённые изменения.` : `GitHub Development Workspace не готов. Репозиторий: ${availability.repository}. Ветка: ${availability.branch}. Доступ или право на изменения не подтверждены.`; }
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
function capabilityError(error, locale, availability, authority, fallbackCode = 'github-capability-assessment-failed') {
  const code = error?.code ?? fallbackCode;
  const detail = error?.message ?? 'capability assessment failed';
  return { status: 'failed', data: { message: messageForUnavailable(locale, `${code}: ${detail}`), availability, authority }, error: { code, message: detail, retryable: Boolean(error?.retryable) } };
}

export function createProductionGitHubDevelopmentRuntime({ env = process.env, credentialManager, credentialAccessContext, resourceAuthorityRegistry, resourceAuthorityAccessContext, ownerGlobalUserId, aiRouter = null, capabilityBindingService = null, githubSecurityControlPlane = null, githubConnectionProvider = null, platformOperationsService = null, developmentTaskStore = null, auditSink = null, validationChecks = [], fetchImpl = globalThis.fetch, clock = () => new Date() } = {}) {
  if (!credentialManager?.registerCredential || !credentialManager?.listCredentials) throw new TypeError('credentialManager is required');
  if (!credentialAccessContext?.actor || !credentialAccessContext?.scope) throw new TypeError('credentialAccessContext is required');
  if (!resourceAuthorityRegistry?.checkAuthority || !resourceAuthorityRegistry?.listResources || !resourceAuthorityRegistry?.registerResource || !resourceAuthorityRegistry?.listAuthorities || !resourceAuthorityRegistry?.grantAuthority) throw new TypeError('resourceAuthorityRegistry is required');
  if (!resourceAuthorityAccessContext?.actor || !resourceAuthorityAccessContext?.projectScope) throw new TypeError('resourceAuthorityAccessContext is required');
  const repository = value(env.SG_GITHUB_DEVELOPMENT_REPOSITORY) ?? value(env.GITHUB_REPO) ?? 'korzh260609-beep/garya-bot';
  const branch = value(env.SG_GITHUB_DEVELOPMENT_BRANCH) ?? value(env.GITHUB_BRANCH) ?? 'dev/sg2.1-semantic';
  if (branch === 'main' || branch === 'master') throw new TypeError('SG GitHub development branch must not be a protected default branch');
  const owner = value(ownerGlobalUserId); const key = tokenKey(env); const appConfigured = githubAppConfigured(env); const credentialId = appConfigured ? 'sg.github.app.private-key' : 'sg.github.development'; const connectionId = 'github-development'; const resourceId = repositoryResourceId(repository);
  const existing = new Set(credentialManager.listCredentials().map((item) => item.credentialId));
  if (key && !existing.has(credentialId)) credentialManager.registerCredential({ credentialId, type: 'service-credential', secretRef: { provider: 'environment', key }, ownerUserId: 'system:runtime', projectScope: credentialAccessContext.scope.projectScope, connectionId, requiredPermission: 'credential:use:system', metadata: { provider: 'github', purpose: 'gh3-production-development', authentication: 'deployment-token' } });
  const credentialConfigured = Boolean(key || appConfigured);
  if (appConfigured && !githubConnectionProvider?.withInstallationToken) throw new TypeError('githubConnectionProvider is required for GitHub App authentication');
  const configured = Boolean(credentialConfigured && aiRouter?.route && owner); let service = null; let composition = null; let provider = null;
  if (configured) {
    provider = githubConnectionProvider ?? createGitHubTokenConnectionProvider({ credentialManager, credentialAccessContext, credentialId, connectionId });
    const repositoryReadService = createGitHubRepositoryReadAnalysisService({ fetchImpl, githubAppProvider: provider, clock });
    const atomicCommitService = createGitHubAtomicCommitService({ fetchImpl, githubAppProvider: provider, clock });
    const commitLifecycle = githubSecurityControlPlane ? createGitHubValidatedCommitLifecycle({ validationService: createGitHubChangeSetValidationService({ checks: validationChecks }), securityControlPlane: githubSecurityControlPlane, atomicCommitService, repositoryReadService }) : null;
    service = createGitHubDevelopmentExecutionService({ aiRouter, repositoryReadService, atomicCommitService, commitLifecycle, repository, branch, connectionId, credentialId, clock });
    composition = createGitHubDevelopmentProductionComposition({ env, repository, branch, connectionId, repositoryReadService, atomicCommitService, developmentExecutionService: service, capabilityBindingService, securityControlPlane: githubSecurityControlPlane, githubProvider: provider, taskStore: developmentTaskStore, fetchImpl, auditSink, clock });
  }
  const effectivePlatformOperationsService = platformOperationsService ?? composition?.platformOperationsService ?? null;
  const availability = Object.freeze({ capability: GITHUB_DEVELOPMENT_RUNTIME_CAPABILITY, configured, repository, branch, resourceId, authentication: appConfigured ? 'github-app' : (key ? 'deployment-token' : 'unconfigured'), credentialPresent: credentialConfigured, aiAvailable: Boolean(aiRouter?.route), ownerBound: Boolean(owner), canonicalRuntimeBinding: true });
  async function start() { if (!configured) return availability; await provider.verifyConnection?.({ connectionId, capability: 'github.repository.read' }); const projectScope = resourceAuthorityAccessContext.projectScope; const actor = resourceAuthorityAccessContext.actor; const resources = await resourceAuthorityRegistry.listResources({ projectScope, provider: 'github', actor }); if (!resources.some((item) => item.resourceId === resourceId)) await resourceAuthorityRegistry.registerResource({ resourceId, resourceType: 'repository', provider: 'github', projectScope, externalResourceId: repository, verificationState: 'verified', metadata: { repository, branch, purpose: 'sg-github-development-workspace' }, provenance: { source: 'deployment-config' }, actor, purpose: 'gh3-production-resource-bootstrap' }); const authorities = await resourceAuthorityRegistry.listAuthorities({ projectScope, actorGlobalUserId: owner, resourceId, includeRevoked: true, actor }); if (authorities.length === 0) await resourceAuthorityRegistry.grantAuthority({ authorityId: `gh3-owner:${owner}:${repository}`, resourceId, actorGlobalUserId: owner, projectScope, relation: 'can_modify', appliesToDescendants: false, verificationState: 'verified', verificationSource: 'canonical-owner-deployment-binding', provenance: { source: 'deployment-config', repository }, actor, purpose: 'gh3-owner-authority-bootstrap' }); return availability; }
  async function authorityFor(request) { if (request.actor?.globalUserId !== owner) return Object.freeze({ allowed: false, reason: 'canonical-owner-required' }); try { return await resourceAuthorityRegistry.checkAuthority({ actorGlobalUserId: request.actor.globalUserId, resourceId, projectScope: request.scope.projectScope, relation: 'can_modify' }); } catch (error) { return Object.freeze({ allowed: false, reason: error?.code ?? 'resource-authority-resolution-failed' }); } }
  async function assess(request, canonicalAction) {
    if (!capabilityBindingService) return null;
    return capabilityBindingService.assess({ canonicalAction, actor: request.actor, projectScope: request.scope.projectScope, repository: repositoryIdentity(repository), repositoryResourceId: resourceId, branch, paths: request.input?.paths ?? request.input?.canonicalTarget?.paths ?? [], connectionId, credentialId, actionRequest: request.actionRequest, confirmation: request.input?.confirmation ?? request.actionRequest?.confirmation ?? null, locale: request.input?.locale });
  }
  async function requireAssessment(request, canonicalAction, authority) {
    if (!capabilityBindingService) return { ok: true, assessment: null };
    try {
      const assessment = await assess(request, canonicalAction);
      if (assessment?.available === true) return { ok: true, assessment };
      const reason = assessment?.blockers?.map((item) => item.code).join(', ') || 'current GitHub capability assessment denied operation';
      return { ok: false, response: { status: 'unavailable', data: { message: assessment?.message ?? messageForUnavailable(request.input?.locale, reason), availability, authority, capabilityAssessment: assessment }, error: { code: 'github-development-capability-unavailable', message: reason, retryable: false } } };
    } catch (error) {
      return { ok: false, response: capabilityError(error, request.input?.locale, availability, authority) };
    }
  }
  const capability = createCapability({
    name: GITHUB_DEVELOPMENT_RUNTIME_CAPABILITY, version: '1.0.0', description: 'Report deterministic GitHub development availability, inspect the authorized repository, or execute a bounded instructed development change.',
    actionTypes: ['github-development', 'github-development-status'], actionClasses: ['read-only', 'state-changing'], requiredPermissions: [`capability:${GITHUB_DEVELOPMENT_RUNTIME_CAPABILITY}`], requiredSources: [], requiredTools: [], risk: 'medium', estimatedCostUsd: 0.05, confirmationRequired: false, timeoutMs: 300000, maxRetries: 0, fallbackCapabilities: [], priority: 100,
    execute: async (request) => {
      const authority = await authorityFor(request);
      const mode = request.input?.mode;
      const canonicalAction = request.input?.canonicalAction ?? (mode === 'status' || mode === 'inspect' ? 'github.repository.inspect' : 'github.development.execute');
      const conflict = targetConflict(request.input, repository, branch);
      if (conflict) return { status: 'failed', data: { message: messageForUnavailable(request.input?.locale, conflict), availability, authority }, error: { code: 'github-development-target-outside-workspace', message: conflict, retryable: false } };
      if (request.actionRequest?.actionType === 'github-development-status' || mode === 'status') {
        try {
          const capabilityAssessment = await assess(request, canonicalAction);
          const message = capabilityAssessment?.available === false
            ? (capabilityAssessment.message ?? statusMessage(responseLanguage(request), availability, authority))
            : statusMessage(responseLanguage(request), availability, authority);
          return { status: 'success', data: { message, availability, authority, capabilityAssessment } };
        } catch (error) {
          return capabilityError(error, request.input?.locale, availability, authority);
        }
      }
      if (canonicalAction === 'github.repository.inspect' && mode === 'inspect') {
        if (!service?.inspect) { const reason = !owner ? 'canonical owner is not configured' : (!credentialConfigured ? 'development credential is not configured' : 'AI Router is unavailable'); return { status: 'unavailable', data: { message: messageForUnavailable(request.input?.locale, reason), availability, authority }, error: { code: 'github-development-unavailable', message: reason, retryable: false } }; }
        const preflight = await requireAssessment(request, canonicalAction, authority);
        if (!preflight.ok) return preflight.response;
        const instruction = request.input?.instruction ?? request.input?.text ?? request.input?.semanticMessage;
        try {
          const canonicalInput = Object.freeze({ text: instruction, locale: request.input?.locale ?? 'ru', identityContext: request.actor, scopeContext: request.scope, traceContext: request.traceContext, metadata: request.input?.metadata ?? {} });
          const resolvedTarget = composition?.targetResolver && request.input?.canonicalModel ? await composition.targetResolver.resolve({ canonicalModel: request.input.canonicalModel, canonicalInput }) : null;
          const result = await service.inspect({ instruction, originalUserText: request.input?.text ?? instruction, responseLanguage: responseLanguage(request), actor: request.actor, traceContext: request.traceContext });
          return { status: 'success', data: { ...result, availability, authority, capabilityAssessment: preflight.assessment, resolvedTarget } };
        } catch (error) {
          const reason = error?.code ?? 'github-repository-inspection-failed'; const detail = error?.message ?? 'GitHub repository inspection failed';
          return { status: 'failed', data: { message: messageForUnavailable(request.input?.locale, `${reason}: ${detail}`), availability, capabilityAssessment: preflight.assessment }, error: { code: reason, message: detail, retryable: Boolean(error?.retryable) } };
        }
      }
      if (canonicalAction && !['github.development.execute','github.development.plan'].includes(canonicalAction)) {
        if (!effectivePlatformOperationsService?.execute) return { status: 'unavailable', data: { message: messageForUnavailable(request.input?.locale, 'GitHub platform operations are not configured'), availability }, error: { code: 'github-platform-operations-unavailable', message: 'GitHub platform operations are not configured', retryable: false } };
        try { const result = await effectivePlatformOperationsService.execute({ ...(request.input?.platformOperation ?? {}), repository: repositoryIdentity(repository), branch, connectionId, credentialId, repositoryResourceId: resourceId, capability: primaryCapability(canonicalAction), canonicalAction, actor: request.actor, projectScope: request.scope.projectScope, traceContext: request.traceContext, actionRequest: request.actionRequest }); return { status: 'success', data: { ...result, availability, authority } }; }
        catch (error) { return { status: 'failed', data: { message: messageForUnavailable(request.input?.locale, `${error?.code ?? 'github-platform-operation-failed'}: ${error?.message ?? 'operation failed'}`), availability }, error: { code: error?.code ?? 'github-platform-operation-failed', message: error?.message ?? 'operation failed', retryable: Boolean(error?.retryable) } }; }
      }
      if (!service) { const reason = !owner ? 'canonical owner is not configured' : (!credentialConfigured ? 'development credential is not configured' : 'AI Router is unavailable'); return { status: 'unavailable', data: { message: messageForUnavailable(request.input?.locale, reason), availability }, error: { code: 'github-development-unavailable', message: reason, retryable: false } }; }
      if (authority?.allowed !== true) { const reason = authority?.reason ?? 'repository modification authority is unavailable'; return { status: 'failed', data: { message: messageForUnavailable(request.input?.locale, reason), availability }, error: { code: 'github-development-authority-denied', message: reason, retryable: false } }; }
      const preflight = await requireAssessment(request, canonicalAction, authority);
      if (!preflight.ok) return preflight.response;
      const instruction = request.input?.instruction ?? request.input?.text ?? request.input?.semanticMessage;
      try {
        let result;
        if (composition?.targetResolver && composition?.canonicalExecutionBridge && request.input?.canonicalModel) {
          const canonicalInput = Object.freeze({ text: instruction, locale: request.input?.locale ?? 'ru', identityContext: request.actor, scopeContext: request.scope, traceContext: request.traceContext, metadata: request.input?.metadata ?? {} });
          const resolvedTarget = await composition.targetResolver.resolve({ canonicalModel: request.input.canonicalModel, canonicalInput });
          result = await composition.canonicalExecutionBridge.execute({ canonicalInput, canonicalModel: request.input.canonicalModel, resolvedTarget, capabilityAssessment: preflight.assessment });
          const executionResult = result.execution ?? result.task ?? result;
          return { status: 'success', data: { ...result, message: executionResult?.commitSha ? successMessage(request.input?.locale, executionResult) : `GitHub development task ${result.task?.taskId ?? ''} accepted by the existing GH3 orchestrator.`, availability, authority: { resourceId, relation: 'can_modify', reason: authority.reason }, capabilityAssessment: preflight.assessment, resolvedTarget } };
        }
        result = await service.execute({ instruction, actor: request.actor, traceContext: request.traceContext, projectScope: request.scope.projectScope, repositoryResourceId: resourceId, actionRequest: request.actionRequest });
        return { status: 'success', data: { ...result, message: successMessage(request.input?.locale, result), availability, authority: { resourceId, relation: 'can_modify', reason: authority.reason }, capabilityAssessment: preflight.assessment } };
      }
      catch (error) { const reason = error?.code ?? 'github-development-execution-failed'; const detail = error?.message ?? 'GitHub development execution failed'; return { status: 'failed', data: { message: messageForUnavailable(request.input?.locale, `${reason}: ${detail}`), availability, capabilityAssessment: preflight.assessment }, error: { code: reason, message: detail, retryable: Boolean(error?.retryable) } }; }
    }
  });
  return Object.freeze({ capability, availability, service, composition, platformOperationsService: effectivePlatformOperationsService, start });
}
