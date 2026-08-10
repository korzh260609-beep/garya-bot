import { createHash } from 'node:crypto';
import { createProjectFact, createProjectMemoryNamespace } from './projectFactContract.js';

const TRUSTED_SOURCE_KINDS = Object.freeze(['github']);
const DENIED_SOURCE_KINDS = Object.freeze(['render', 'chat', 'model', 'llm', 'user-chat']);
const MAX_EVIDENCE_BYTES = 8 * 1024;
const MAX_FACT_BYTES = 16 * 1024;
const MAX_METADATA_BYTES = 8 * 1024;
const MAX_RELATION_KEYS = 32;
const MAX_TAGS = 32;

function required(value, name) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${name} is required`);
  return value.trim();
}

function optional(value) {
  if (value == null || String(value).trim() === '') return null;
  return String(value).trim();
}

function iso(value, name) {
  const text = required(value, name);
  if (Number.isNaN(Date.parse(text))) throw new TypeError(`${name} must be ISO timestamp`);
  return new Date(text).toISOString();
}

function clone(value, name) {
  try {
    const serialized = JSON.stringify(value);
    if (serialized === undefined) throw new Error();
    return JSON.parse(serialized);
  } catch {
    throw new TypeError(`${name} must be JSON-compatible`);
  }
}

function boundedJson(value, name, maxBytes) {
  const cloned = clone(value, name);
  const bytes = Buffer.byteLength(JSON.stringify(cloned), 'utf8');
  if (bytes > maxBytes) throw sourceError(`${name} exceeds ${maxBytes} byte limit`, 'project-memory-source-payload-too-large');
  return cloned;
}

function boundedStringArray(value, name, maxItems) {
  if (value == null) return [];
  if (!Array.isArray(value)) throw new TypeError(`${name} must be an array`);
  if (value.length > maxItems) throw sourceError(`${name} exceeds ${maxItems} item limit`, 'project-memory-source-payload-too-large');
  return value.map((item) => required(item, name));
}

function stable(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(',')}}`;
}

function hash(value) {
  return createHash('sha256').update(stable(value)).digest('hex');
}

function sourceError(message, code = 'project-memory-source-denied') {
  const error = new Error(message);
  error.code = code;
  return error;
}

export function createTrustedProjectEvent(input = {}) {
  const projectKey = required(input.projectKey, 'projectKey').toLowerCase();
  const sourceKind = required(input.sourceKind ?? input.source?.kind, 'sourceKind').toLowerCase();
  if (DENIED_SOURCE_KINDS.includes(sourceKind)) {
    throw sourceError(`${sourceKind} is not an approved trusted Project Memory source`, `project-memory-source-${sourceKind}-unavailable`);
  }
  if (!TRUSTED_SOURCE_KINDS.includes(sourceKind)) throw sourceError(`unsupported trusted Project Memory source: ${sourceKind}`);

  const sourceRef = required(input.sourceRef ?? input.source?.ref, 'sourceRef');
  const sourceEventId = required(input.sourceEventId, 'sourceEventId');
  const occurredAt = iso(input.occurredAt ?? input.source?.timestamp, 'occurredAt');
  const evidence = boundedJson(input.evidence ?? {}, 'evidence', MAX_EVIDENCE_BYTES);
  const candidate = clone(input.candidate ?? {}, 'candidate');
  const traceId = optional(input.traceId);

  const event = {
    contractVersion: 1,
    projectKey,
    sourceKind,
    sourceRef,
    sourceEventId,
    occurredAt,
    traceId,
    evidence,
    candidate
  };
  const sourceIdentity = { projectKey, sourceKind, sourceRef, sourceEventId, occurredAt, evidence };
  return Object.freeze({ ...event, idempotencyKey: `pm3-source:${hash(sourceIdentity)}` });
}

export function createGitHubCommitVerifier({ fetchImpl = globalThis.fetch, allowedRepositories = [] } = {}) {
  if (typeof fetchImpl !== 'function') throw new TypeError('fetchImpl is required');
  if (!Array.isArray(allowedRepositories) || allowedRepositories.length === 0) {
    throw sourceError('at least one approved GitHub repository is required', 'project-memory-source-policy-missing');
  }
  const allowed = new Set(allowedRepositories.map((item) => required(item, 'allowedRepositories').toLowerCase()));

  return Object.freeze({
    async verify(event) {
      if (event?.sourceKind !== 'github') throw sourceError('GitHub verifier only accepts github events');
      const repository = required(event.evidence?.repository, 'evidence.repository').toLowerCase();
      const commitSha = required(event.evidence?.commitSha, 'evidence.commitSha').toLowerCase();
      if (!/^[a-f0-9]{40}$/.test(commitSha)) throw sourceError('evidence.commitSha must be a full immutable Git SHA', 'project-memory-source-verification-failed');
      if (!allowed.has(repository)) throw sourceError(`GitHub repository is not approved: ${repository}`);

      const canonicalRef = `github:${repository}@${commitSha}`;
      if (event.sourceRef !== canonicalRef) throw sourceError('GitHub sourceRef does not match repository and immutable commit SHA', 'project-memory-source-verification-failed');

      const response = await fetchImpl(`https://api.github.com/repos/${repository}/commits/${commitSha}`, {
        headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'sg-2.1-project-memory' }
      });
      if (!response?.ok) throw sourceError(`GitHub commit verification failed with status ${response?.status ?? 'unknown'}`, 'project-memory-source-verification-failed');
      const payload = await response.json();
      const verifiedSha = String(payload?.sha ?? '').toLowerCase();
      if (verifiedSha !== commitSha) throw sourceError('GitHub returned a different commit SHA', 'project-memory-source-verification-failed');

      const htmlUrl = optional(payload?.html_url);
      const committedAt = optional(payload?.commit?.committer?.date ?? payload?.commit?.author?.date);
      const actorId = optional(payload?.author?.login ?? payload?.committer?.login);
      return Object.freeze({
        verified: true,
        sourceKind: 'github',
        repository,
        commitSha,
        actorId,
        sourceRef: canonicalRef,
        sourceEventId: event.sourceEventId,
        verifiedAt: new Date().toISOString(),
        evidence: Object.freeze({ repository, commitSha, htmlUrl, committedAt })
      });
    }
  });
}

export function createProjectMemoryIngestionBoundary({ githubVerifier } = {}) {
  if (!githubVerifier?.verify) throw new TypeError('githubVerifier.verify is required');

  return Object.freeze({
    async ingest(rawEvent) {
      const event = createTrustedProjectEvent(rawEvent);
      const verification = await githubVerifier.verify(event);
      if (!verification?.verified) throw sourceError('trusted source verification did not succeed', 'project-memory-source-verification-failed');

      const domain = required(event.candidate?.domain, 'candidate.domain').toLowerCase();
      const factType = required(event.candidate?.factType, 'candidate.factType').toLowerCase();
      const entityKey = required(event.candidate?.entityKey, 'candidate.entityKey');
      const fact = boundedJson(event.candidate?.fact, 'candidate.fact', MAX_FACT_BYTES);
      const relationKeys = boundedStringArray(event.candidate?.relationKeys, 'candidate.relationKeys', MAX_RELATION_KEYS);
      const tags = boundedStringArray(event.candidate?.tags, 'candidate.tags', MAX_TAGS);
      const metadata = boundedJson(event.candidate?.metadata ?? {}, 'candidate.metadata', MAX_METADATA_BYTES);

      const projectFact = createProjectFact({
        projectKey: event.projectKey,
        namespace: createProjectMemoryNamespace(event.projectKey, domain),
        factType,
        entityKey,
        fact,
        source: {
          kind: verification.sourceKind,
          ref: verification.sourceRef,
          actorId: verification.actorId,
          timestamp: verification.evidence?.committedAt ?? event.occurredAt
        },
        traceId: event.traceId,
        sourceEventId: event.sourceEventId,
        trust: 'verified',
        confirmed: false,
        confirmationState: 'proposed',
        lifecycleState: 'active',
        validFrom: event.occurredAt,
        relationKeys,
        tags,
        metadata: {
          ...metadata,
          sourceVerification: {
            repository: verification.repository,
            commitSha: verification.commitSha,
            verified: true
          },
          sourceIdempotencyKey: event.idempotencyKey
        }
      });

      return Object.freeze({
        status: 'candidate',
        event,
        verification,
        candidate: projectFact,
        idempotencyKey: event.idempotencyKey
      });
    }
  });
}

export const PROJECT_MEMORY3_TRUSTED_SOURCE_KINDS = TRUSTED_SOURCE_KINDS;
export const PROJECT_MEMORY3_SOURCE_LIMITS = Object.freeze({
  evidenceBytes: MAX_EVIDENCE_BYTES,
  factBytes: MAX_FACT_BYTES,
  metadataBytes: MAX_METADATA_BYTES,
  relationKeys: MAX_RELATION_KEYS,
  tags: MAX_TAGS
});
