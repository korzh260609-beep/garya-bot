import { CANONICAL_GITHUB_ACTIONS } from '../contracts/semantic.js';
import { createGitHubRef, createGitHubRepositoryIdentity } from './githubDevelopmentContract.js';

const SHA = /^[0-9a-f]{40}$/u;
const ACTIONS = new Set(CANONICAL_GITHUB_ACTIONS);
const DEVELOPMENT_SCOPE_ACTIONS = new Set(['github.development.plan', 'github.development.execute', 'github.test.run']);

function fail(code, message, details = {}) {
  const error = new Error(message);
  error.name = 'GitHubDevelopmentTargetResolutionError';
  error.code = code;
  error.details = Object.freeze({ ...details });
  throw error;
}

function value(input) { return typeof input === 'string' && input.trim() ? input.trim() : null; }
function freeze(input) { if (!input || typeof input !== 'object' || Object.isFrozen(input)) return input; for (const item of Object.values(input)) freeze(item); return Object.freeze(input); }
function fullName(input) {
  if (typeof input === 'string') {
    const parts = input.trim().split('/');
    if (parts.length !== 2) fail('gde1-repository-invalid', 'repository must use owner/name');
    return createGitHubRepositoryIdentity({ owner: parts[0], name: parts[1] });
  }
  return createGitHubRepositoryIdentity(input);
}
function same(left, right) { return value(left)?.toLowerCase() === value(right)?.toLowerCase(); }
function unique(values) { return [...new Set(values.filter(Boolean))]; }

function selectBinding({ canonicalModel, canonicalInput, authoritativeContext }) {
  const projectScope = value(canonicalInput?.scopeContext?.projectScope);
  if (!projectScope) fail('gde1-project-scope-required', 'authoritative project scope is required');
  const bindings = Array.isArray(authoritativeContext?.bindings) ? authoritativeContext.bindings : [];
  const eligible = bindings.filter((item) => item?.authoritative === true && same(item.projectScope, projectScope));
  const requestedRepository = value(canonicalModel.target?.repository);
  const requestedBranch = value(canonicalModel.target?.branch);
  const matched = eligible.filter((item) => (!requestedRepository || same(item.repository, requestedRepository)) && (!requestedBranch || item.branch === requestedBranch));
  if (matched.length === 0) fail('gde1-authoritative-target-missing', 'no authoritative repository/branch binding matches the request', { projectScope, requestedRepository, requestedBranch });
  if (matched.length > 1) fail('gde1-authoritative-target-ambiguous', 'repository or branch is ambiguous', { candidates: matched.map((item) => `${item.repository}@${item.branch}`) });
  return { projectScope, binding: matched[0] };
}

function resolveScope({ requested, projectContext }) {
  const targetId = value(requested?.stage) ?? value(requested?.block) ?? value(requested?.scopeId);
  if (!targetId) {
    const current = projectContext?.currentDevelopmentTarget;
    if (!current?.authoritative) fail('gde1-development-scope-required', 'development scope is missing or not authoritative');
    return current;
  }
  const targets = Array.isArray(projectContext?.developmentTargets) ? projectContext.developmentTargets : [];
  const matches = targets.filter((item) => item?.authoritative === true && same(item.id, targetId));
  if (matches.length === 0) fail('gde1-development-scope-not-found', 'development target is not present in authoritative project evidence', { targetId });
  if (matches.length > 1) fail('gde1-development-scope-ambiguous', 'development target identity is ambiguous', { targetId });
  return matches[0];
}

export function createGitHubDevelopmentTargetResolver({ contextProvider, repositoryReadService } = {}) {
  if (!contextProvider?.getAuthoritativeContext) throw new TypeError('contextProvider.getAuthoritativeContext is required');
  if (!repositoryReadService?.readSnapshot) throw new TypeError('repositoryReadService.readSnapshot is required');
  return freeze({
    name: 'gde1-development-target-resolver',
    async resolve({ canonicalModel, canonicalInput }) {
      if (canonicalModel?.resolutionStatus !== 'resolved') fail('gde1-canonical-model-unresolved', 'canonical semantic model must be resolved');
      const action = value(canonicalModel?.action?.name);
      if (!ACTIONS.has(action)) fail('gde1-canonical-action-unsupported', 'canonical GitHub action is unsupported', { action });
      const authoritativeContext = await contextProvider.getAuthoritativeContext({ canonicalModel, canonicalInput });
      const { projectScope, binding } = selectBinding({ canonicalModel, canonicalInput, authoritativeContext });
      const repository = fullName(binding.repository);
      const branch = value(binding.branch);
      if (!branch || branch === 'main') fail('gde1-branch-denied', 'an authoritative non-main development branch is required');
      const snapshot = await repositoryReadService.readSnapshot({
        repository,
        ref: createGitHubRef({ kind: 'branch', name: branch }),
        visibility: binding.visibility ?? 'authorized-private',
        connectionId: binding.connectionId,
        files: unique(authoritativeContext.canonicalDocumentPaths ?? [])
      });
      const baselineHead = value(snapshot?.revision)?.toLowerCase();
      if (!baselineHead || !SHA.test(baselineHead)) fail('gde1-baseline-head-unverified', 'repository evidence did not return an exact baseline HEAD');
      if (!same(snapshot?.repository?.fullName, repository.fullName)) fail('gde1-repository-evidence-mismatch', 'repository evidence belongs to another repository');
      const hasRequestedDevelopmentScope = ['stage', 'block', 'scopeId'].some((field) => value(canonicalModel.target?.[field]));
      const developmentScope = DEVELOPMENT_SCOPE_ACTIONS.has(action) || hasRequestedDevelopmentScope
        ? resolveScope({ requested: canonicalModel.target, projectContext: authoritativeContext.projectContext })
        : null;
      return freeze({
        contractVersion: 1,
        action,
        projectScope,
        repository,
        branch,
        connectionId: value(binding.connectionId),
        credentialId: value(binding.credentialId),
        baselineHead,
        developmentScope,
        pathScope: unique(canonicalModel.target?.paths ?? developmentScope?.paths ?? []),
        issue: canonicalModel.target?.issue ?? null,
        pullRequest: canonicalModel.target?.pullRequest ?? null,
        workflow: canonicalModel.target?.workflow ?? null,
        job: canonicalModel.target?.job ?? null,
        completionCondition: canonicalModel.parameters?.completionCondition ?? developmentScope?.completionCondition ?? null,
        evidence: { source: snapshot.provenance?.source ?? `github:${repository.fullName}@${baselineHead}`, immutableRevisionVerified: snapshot.provenance?.immutableRevisionVerified === true, canonicalDocuments: snapshot.files ?? [] }
      });
    }
  });
}
