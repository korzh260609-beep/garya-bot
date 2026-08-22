import { createGitHubDevelopmentTargetResolver } from './githubDevelopmentTargetResolver.js';
import { createGitHubCanonicalExecutionBridge } from './githubCanonicalExecutionBridge.js';
import { createGitHubDevelopmentOrchestrator, createInMemoryGitHubDevelopmentTaskStore } from './githubDevelopmentOrchestrator.js';
import { createGitHubPlatformOperationsService } from './githubPlatformOperationsService.js';
import { createGlobalGitHubDiscoveryService } from './globalGitHubDiscoveryService.js';
import { createGitHubCollaborationService } from './githubCollaborationService.js';
import { createGitHubActionsCIRepairService } from './githubActionsCIRepairService.js';

function value(input) { return typeof input === 'string' && input.trim() ? input.trim() : null; }
function concrete(paths) { return [...new Set((paths ?? []).filter((path) => typeof path === 'string' && path.trim() && !/[?*]/u.test(path)).map((path) => path.trim()))]; }

export function createGitHubDevelopmentProductionComposition({
  env = process.env,
  repository,
  branch,
  connectionId,
  repositoryReadService,
  atomicCommitService,
  developmentExecutionService,
  capabilityBindingService,
  securityControlPlane,
  githubProvider,
  taskStore = null,
  fetchImpl = globalThis.fetch,
  auditSink = null,
  clock = () => new Date()
} = {}) {
  if (!repositoryReadService?.readSnapshot || !atomicCommitService?.applyAtomicCommit || !developmentExecutionService?.execute) throw new TypeError('existing GH3 execution services are required');
  const canonicalDocumentPaths = (value(env.SG_GITHUB_CANONICAL_DOCUMENTS) ?? 'pillars/architecture/LIFECYCLE_ACTIVITY.md,pillars/roadmap/LIFECYCLE_ACTIVITY_PROGRAM.md,pillars/workflow/LIFECYCLE_ACTIVITY_WORKFLOW.md,pillars/roadmap/GITHUB_DEVELOPMENT_EXECUTION_COMPLETION.md,README.md').split(',').map((item) => item.trim()).filter(Boolean);
  const contextProvider = Object.freeze({
    async getAuthoritativeContext({ canonicalModel, canonicalInput }) {
      const targetId = value(canonicalModel?.target?.stage) ?? value(canonicalModel?.target?.block) ?? value(canonicalModel?.target?.scopeId);
      const targetPaths = concrete(canonicalModel?.target?.paths);
      const developmentTarget = targetId ? Object.freeze({ id: targetId, kind: canonicalModel?.target?.stage ? 'stage' : 'block', authoritative: true, paths: targetPaths.length ? targetPaths : canonicalDocumentPaths, completionCondition: canonicalModel?.parameters?.completionCondition ?? { kind: 'exact-head-ci-green', targetWorkflow: 'SG 2.1 CI', maxAttempts: 3, evidenceRequirements: ['tests', 'exact-head-ci'] } }) : null;
      return Object.freeze({
        bindings: [Object.freeze({ projectScope: canonicalInput.scopeContext.projectScope, repository, branch, connectionId, credentialId: developmentExecutionService.credentialId, visibility: 'authorized-private', authoritative: true })],
        canonicalDocumentPaths,
        projectContext: Object.freeze({ developmentTargets: developmentTarget ? [developmentTarget] : [], currentDevelopmentTarget: developmentTarget })
      });
    }
  });
  const targetResolver = createGitHubDevelopmentTargetResolver({ contextProvider, repositoryReadService });
  const store = taskStore ?? createInMemoryGitHubDevelopmentTaskStore();
  const orchestrator = createGitHubDevelopmentOrchestrator({
    taskStore: store,
    taskExecutor: {
      async resume({ task, actorGlobalUserId, projectId, traceContext }) {
        return developmentExecutionService.execute({ instruction: task.intent, actor: { globalUserId: actorGlobalUserId, roles: ['monarch'] }, traceContext, projectScope: projectId, repositoryResourceId: `github:repo:${task.repository.fullName}` });
      }
    },
    clock
  });
  const developmentPlanner = Object.freeze({
    async plan({ canonicalModel, resolvedTarget }) {
      const scoped = concrete(resolvedTarget.pathScope);
      const docs = concrete((resolvedTarget.evidence?.canonicalDocuments ?? []).map((item) => item?.path));
      const bounded = scoped.length ? scoped : docs;
      return Object.freeze({
        filesToRead: bounded,
        filesToCreate: [],
        filesToModify: bounded.length ? bounded : [canonicalDocumentPaths[0]],
        filesToDelete: [],
        tests: [],
        docs,
        migrations: [],
        expectedPostConditions: canonicalModel.parameters?.expectedPostConditions ?? ['requested stage implemented', 'tests pass', 'exact HEAD CI verified']
      });
    }
  });
  const canonicalExecutionBridge = createGitHubCanonicalExecutionBridge({ orchestrator, repositoryReadService, developmentPlanner });
  const discoveryService = createGlobalGitHubDiscoveryService({ fetchImpl, githubAppProvider: githubProvider, clock });
  const collaborationService = createGitHubCollaborationService({ fetchImpl, githubAppProvider: githubProvider, clock });
  const ciService = createGitHubActionsCIRepairService({ fetchImpl, githubAppProvider: githubProvider, clock });
  const sink = auditSink ?? Object.freeze({ async record() {} });
  const platformOperationsService = capabilityBindingService && securityControlPlane ? createGitHubPlatformOperationsService({ repositoryReadService, discoveryService, atomicCommitService, collaborationService, ciService, developmentBridge: canonicalExecutionBridge, taskStore: store, securityControlPlane, auditSink: sink, clock }) : null;
  return Object.freeze({ targetResolver, canonicalExecutionBridge, platformOperationsService, orchestrator, taskStore: store, discoveryService, collaborationService, ciService });
}
