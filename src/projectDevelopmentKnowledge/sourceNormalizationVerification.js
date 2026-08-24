import { createHash } from 'node:crypto';
import { createDevelopmentSourceIdentity } from './developmentKnowledgeContract.js';

export const PDK4_SOURCE_NORMALIZATION_CONTRACT_VERSION = 1;
export const PDK4_NORMALIZED_SOURCE_KINDS = Object.freeze([
  'github-commit',
  'github-pr',
  'github-workflow',
  'canonical-document'
]);
export const PDK4_EVIDENCE_DIMENSIONS = Object.freeze(['source', 'code', 'ci', 'deployment', 'runtime']);
export const PDK4_SOURCE_LIMITS = Object.freeze({
  maxTitleChars: 500,
  maxTextChars: 8000,
  maxFiles: 100,
  maxPathChars: 500,
  maxPatchCharsPerFile: 4000,
  maxNormalizedBytes: 128 * 1024
});

const UNAVAILABLE_SOURCE_KINDS = new Set(['deployment-evidence', 'runtime-evidence']);
const NORMALIZED_FINGERPRINT_BUDGET_BYTES = 128;

function requiredString(value, name) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${name} is required`);
  return value.trim();
}
function optionalString(value) {
  return value == null || String(value).trim() === '' ? null : String(value).trim();
}
function normalizeProjectKey(value) {
  const projectKey = requiredString(value, 'projectKey').toLowerCase();
  if (!/^[a-z0-9][a-z0-9._-]{0,63}$/.test(projectKey)) throw new TypeError('projectKey contains unsupported characters');
  return projectKey;
}
function normalizeRepository(value) {
  const repository = requiredString(value, 'repository').toLowerCase();
  if (!/^[a-z0-9_.-]+\/[a-z0-9_.-]+$/i.test(repository)) throw new TypeError('repository must be owner/name');
  return repository;
}
function normalizeSha(value, name = 'sha') {
  const sha = requiredString(value, name).toLowerCase();
  if (!/^[a-f0-9]{7,64}$/.test(sha)) throw new TypeError(`${name} must be a hexadecimal git revision`);
  return sha;
}
function isoTimestamp(value, name) {
  const text = requiredString(value, name);
  if (Number.isNaN(Date.parse(text))) throw new TypeError(`${name} must be ISO timestamp`);
  return new Date(text).toISOString();
}
function redactSensitiveText(value) {
  return String(value)
    .replace(/\bgh[pousr]_[A-Za-z0-9_]{20,}\b/g, '[REDACTED]')
    .replace(/\bsk-[A-Za-z0-9_-]{16,}\b/g, '[REDACTED]')
    .replace(/(authorization\s*[:=]\s*)([^\s,;]+)/gi, '$1[REDACTED]')
    .replace(/((?:api[_-]?key|access[_-]?token|refresh[_-]?token|password|secret)\s*[:=]\s*)([^\s,;]+)/gi, '$1[REDACTED]');
}
function boundedText(value, limit) {
  const text = optionalString(value);
  if (text == null) return null;
  return redactSensitiveText(text).slice(0, limit);
}
function stable(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(',')}}`;
}
function sha256(value) { return createHash('sha256').update(String(value)).digest('hex'); }
function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}
function fail(code, message) {
  const error = new Error(message);
  error.code = code;
  throw error;
}
function assertApprovedRepository(repository, approvedRepositories) {
  const approved = new Set((approvedRepositories ?? []).map((item) => normalizeRepository(item)));
  if (!approved.has(repository)) fail('pdk4-source-repository-denied', `repository is not approved for PDK4: ${repository}`);
}
function boundedFiles(files = []) {
  if (!Array.isArray(files)) throw new TypeError('files must be an array');
  if (files.length > PDK4_SOURCE_LIMITS.maxFiles) fail('pdk4-source-too-large', 'source contains too many changed files');
  return files.map((file) => {
    const path = requiredString(file.path ?? file.filename, 'file.path');
    if (path.length > PDK4_SOURCE_LIMITS.maxPathChars) fail('pdk4-source-too-large', 'source file path exceeds limit');
    return {
      path,
      status: boundedText(file.status, 64),
      additions: Number.isFinite(Number(file.additions)) ? Number(file.additions) : null,
      deletions: Number.isFinite(Number(file.deletions)) ? Number(file.deletions) : null,
      changes: Number.isFinite(Number(file.changes)) ? Number(file.changes) : null,
      patch: boundedText(file.patch, PDK4_SOURCE_LIMITS.maxPatchCharsPerFile)
    };
  });
}
function normalizedBytes(value) {
  return Buffer.byteLength(JSON.stringify(value), 'utf8');
}
function compactPatchEvidenceToBudget(core) {
  const budget = PDK4_SOURCE_LIMITS.maxNormalizedBytes - NORMALIZED_FINGERPRINT_BUDGET_BYTES;
  let current = core;
  while (normalizedBytes(current) > budget) {
    const files = current.payload?.files;
    if (!Array.isArray(files) || files.length === 0) break;
    let changed = false;
    const nextFiles = files.map((file) => {
      if (typeof file.patch !== 'string' || file.patch.length === 0) return file;
      changed = true;
      const nextLength = Math.floor(file.patch.length / 2);
      return { ...file, patch: nextLength > 0 ? file.patch.slice(0, nextLength) : null };
    });
    if (!changed) break;
    current = { ...current, payload: { ...current.payload, files: nextFiles } };
  }
  return current;
}
function assertNormalizedSize(value) {
  if (normalizedBytes(value) > PDK4_SOURCE_LIMITS.maxNormalizedBytes) {
    fail('pdk4-source-too-large', 'normalized source exceeds bounded payload limit');
  }
}
function createEnvelope({ projectKey, identity, kind, repository, occurredAt, evidenceDimension, verificationKinds, payload }) {
  let core = {
    contractVersion: PDK4_SOURCE_NORMALIZATION_CONTRACT_VERSION,
    projectKey,
    kind,
    repository,
    sourceId: identity.sourceId,
    sourceFingerprint: identity.fingerprint,
    immutableIdentity: identity,
    occurredAt,
    evidenceDimension,
    verificationKinds: [...new Set(verificationKinds)].sort(),
    trust: 'verified-source',
    contentMode: 'untrusted-data-only',
    payload
  };
  core = compactPatchEvidenceToBudget(core);
  const normalizedFingerprint = sha256(stable(core));
  const envelope = { ...core, normalizedFingerprint };
  assertNormalizedSize(envelope);
  return deepFreeze(envelope);
}

async function normalizeCommit(input, context) {
  if (typeof context.githubVerifier?.getCommit !== 'function') fail('pdk4-source-connector-unavailable', 'GitHub commit verifier is unavailable');
  const repository = normalizeRepository(input.repository);
  assertApprovedRepository(repository, context.approvedRepositories);
  const sha = normalizeSha(input.sha, 'source.sha');
  const record = await context.githubVerifier.getCommit({ repository, sha });
  if (!record || typeof record !== 'object') fail('pdk4-source-verification-failed', 'GitHub commit verifier returned no immutable record');
  const verifiedSha = normalizeSha(record.sha, 'verified commit.sha');
  if (verifiedSha !== sha) fail('pdk4-source-identity-mismatch', 'GitHub commit SHA does not match requested immutable source');
  const projectKey = normalizeProjectKey(input.projectKey);
  const identity = createDevelopmentSourceIdentity({ kind: 'github-commit', projectKey, repository, sha });
  return createEnvelope({
    projectKey, identity, kind: 'github-commit', repository,
    occurredAt: isoTimestamp(record.committedAt ?? record.timestamp, 'commit.committedAt'),
    evidenceDimension: 'code', verificationKinds: ['source', 'code'],
    payload: {
      sha,
      message: boundedText(record.message, PDK4_SOURCE_LIMITS.maxTextChars),
      parents: Object.freeze([...(record.parentShas ?? record.parents ?? [])].map((value) => normalizeSha(typeof value === 'object' ? value.sha : value, 'parent sha'))),
      files: boundedFiles(record.files ?? []),
      stats: record.stats ? {
        additions: Number(record.stats.additions ?? 0),
        deletions: Number(record.stats.deletions ?? 0),
        total: Number(record.stats.total ?? 0)
      } : null
    }
  });
}

async function normalizePullRequest(input, context) {
  if (typeof context.githubVerifier?.getPullRequest !== 'function') fail('pdk4-source-connector-unavailable', 'GitHub PR verifier is unavailable');
  const repository = normalizeRepository(input.repository);
  assertApprovedRepository(repository, context.approvedRepositories);
  const number = Number(input.number);
  if (!Number.isInteger(number) || number < 1) throw new TypeError('source.number must be a positive integer');
  const expectedHeadSha = normalizeSha(input.headSha, 'source.headSha');
  const record = await context.githubVerifier.getPullRequest({ repository, number });
  if (!record || typeof record !== 'object') fail('pdk4-source-verification-failed', 'GitHub PR verifier returned no immutable record');
  if (Number(record.number) !== number) fail('pdk4-source-identity-mismatch', 'GitHub PR number does not match requested source');
  const headSha = normalizeSha(record.headSha ?? record.head?.sha, 'verified PR headSha');
  if (headSha !== expectedHeadSha) fail('pdk4-source-identity-mismatch', 'GitHub PR head SHA does not match requested immutable source');
  const baseShaInput = record.baseSha ?? record.base?.sha ?? null;
  const projectKey = normalizeProjectKey(input.projectKey);
  const identity = createDevelopmentSourceIdentity({ kind: 'github-pr', projectKey, repository, number, headSha });
  return createEnvelope({
    projectKey, identity, kind: 'github-pr', repository,
    occurredAt: isoTimestamp(record.mergedAt ?? record.updatedAt ?? record.createdAt, 'PR timestamp'),
    evidenceDimension: 'code', verificationKinds: ['source', 'code'],
    payload: {
      number,
      headSha,
      baseSha: baseShaInput ? normalizeSha(baseShaInput, 'PR baseSha') : null,
      state: boundedText(record.state, 32),
      merged: record.merged === true || record.mergedAt != null,
      title: boundedText(record.title, PDK4_SOURCE_LIMITS.maxTitleChars),
      body: boundedText(record.body, PDK4_SOURCE_LIMITS.maxTextChars),
      files: boundedFiles(record.files ?? [])
    }
  });
}

async function normalizeWorkflow(input, context) {
  if (typeof context.githubVerifier?.getWorkflowRun !== 'function') fail('pdk4-source-connector-unavailable', 'GitHub workflow verifier is unavailable');
  const repository = normalizeRepository(input.repository);
  assertApprovedRepository(repository, context.approvedRepositories);
  const runId = String(input.runId ?? '').trim();
  const attempt = Number(input.attempt ?? 1);
  if (!/^\d+$/.test(runId)) throw new TypeError('source.runId must be numeric');
  if (!Number.isInteger(attempt) || attempt < 1) throw new TypeError('source.attempt must be a positive integer');
  const record = await context.githubVerifier.getWorkflowRun({ repository, runId, attempt });
  if (!record || typeof record !== 'object') fail('pdk4-source-verification-failed', 'GitHub workflow verifier returned no immutable record');
  if (String(record.runId ?? record.id) !== runId || Number(record.attempt ?? record.runAttempt ?? 1) !== attempt) {
    fail('pdk4-source-identity-mismatch', 'GitHub workflow run identity does not match requested source');
  }
  const projectKey = normalizeProjectKey(input.projectKey);
  const identity = createDevelopmentSourceIdentity({ kind: 'github-workflow', projectKey, repository, runId, attempt });
  const conclusion = boundedText(record.conclusion, 64);
  const verificationKinds = conclusion === 'success' ? ['source', 'ci'] : ['source'];
  return createEnvelope({
    projectKey, identity, kind: 'github-workflow', repository,
    occurredAt: isoTimestamp(record.completedAt ?? record.updatedAt ?? record.createdAt, 'workflow timestamp'),
    evidenceDimension: 'ci', verificationKinds,
    payload: {
      runId,
      attempt,
      workflowName: boundedText(record.workflowName ?? record.name, PDK4_SOURCE_LIMITS.maxTitleChars),
      headSha: record.headSha ? normalizeSha(record.headSha, 'workflow headSha') : null,
      status: boundedText(record.status, 64),
      conclusion,
      event: boundedText(record.event, 64),
      jobs: Array.isArray(record.jobs) ? record.jobs.slice(0, 100).map((job) => ({
        name: boundedText(job.name, PDK4_SOURCE_LIMITS.maxTitleChars),
        status: boundedText(job.status, 64),
        conclusion: boundedText(job.conclusion, 64)
      })) : []
    }
  });
}

async function normalizeDocument(input, context) {
  if (typeof context.githubVerifier?.getFileAtRevision !== 'function') fail('pdk4-source-connector-unavailable', 'canonical document verifier is unavailable');
  const repository = normalizeRepository(input.repository);
  assertApprovedRepository(repository, context.approvedRepositories);
  const path = requiredString(input.path, 'source.path');
  if (path.length > PDK4_SOURCE_LIMITS.maxPathChars) fail('pdk4-source-too-large', 'canonical document path exceeds limit');
  const revision = normalizeSha(input.revision, 'source.revision');
  const record = await context.githubVerifier.getFileAtRevision({ repository, path, revision });
  if (!record || typeof record !== 'object') fail('pdk4-source-verification-failed', 'canonical document verifier returned no immutable record');
  if (requiredString(record.path, 'verified document.path') !== path || normalizeSha(record.revision ?? record.sha, 'verified document.revision') !== revision) {
    fail('pdk4-source-identity-mismatch', 'canonical document identity does not match requested immutable source');
  }
  const projectKey = normalizeProjectKey(input.projectKey);
  const identity = createDevelopmentSourceIdentity({ kind: 'canonical-document', projectKey, repository, path, revision });
  return createEnvelope({
    projectKey, identity, kind: 'canonical-document', repository,
    occurredAt: isoTimestamp(record.committedAt ?? record.updatedAt, 'document timestamp'),
    evidenceDimension: 'source', verificationKinds: ['source'],
    payload: {
      path,
      revision,
      content: boundedText(record.content, PDK4_SOURCE_LIMITS.maxTextChars),
      contentHash: sha256(String(record.content ?? ''))
    }
  });
}

export function createDevelopmentSourceNormalizer({ githubVerifier, approvedRepositories = [] } = {}) {
  const approved = Object.freeze([...approvedRepositories]);

  async function normalizeAndVerify(input = {}) {
    const kind = requiredString(input.kind, 'source.kind').toLowerCase();
    if (UNAVAILABLE_SOURCE_KINDS.has(kind)) {
      fail('pdk4-source-connector-unavailable', `${kind} cannot be verified until a real approved connector exists`);
    }
    if (!PDK4_NORMALIZED_SOURCE_KINDS.includes(kind)) throw new TypeError(`unsupported PDK4 normalized source kind: ${kind}`);
    const context = { githubVerifier, approvedRepositories: approved };
    if (kind === 'github-commit') return normalizeCommit(input, context);
    if (kind === 'github-pr') return normalizePullRequest(input, context);
    if (kind === 'github-workflow') return normalizeWorkflow(input, context);
    return normalizeDocument(input, context);
  }

  return Object.freeze({ normalizeAndVerify });
}
