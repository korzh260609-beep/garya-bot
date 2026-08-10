import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createTrustedProjectEvent,
  createGitHubCommitVerifier,
  createProjectMemoryIngestionBoundary
} from '../src/projectMemory/index.js';

const REPOSITORY = 'korzh260609-beep/garya-bot';
const SHA = 'fd2579740edca27c68bd5eb2cd2d7e4a8d923c7d';
const COMMITTED_AT = '2026-08-10T11:39:00.000Z';

function sourceEvent(overrides = {}) {
  return {
    projectKey: 'sg2.1',
    sourceKind: 'github',
    sourceRef: `github:${REPOSITORY}@${SHA}`,
    sourceEventId: `github:commit:${REPOSITORY}:${SHA}`,
    occurredAt: COMMITTED_AT,
    traceId: 'trace-pm33-github-1',
    evidence: {
      repository: REPOSITORY,
      commitSha: SHA
    },
    candidate: {
      domain: 'features',
      factType: 'feature-status',
      entityKey: 'project-memory-3.2',
      fact: { status: 'implemented', evidenceType: 'git-commit' },
      relationKeys: ['memory2', 'postgresql'],
      tags: ['project-memory', 'pm3.3'],
      metadata: { bounded: true }
    },
    ...overrides
  };
}

function verifiedFetch(expectedSha = SHA) {
  return async (url, options) => {
    assert.equal(url, `https://api.github.com/repos/${REPOSITORY}/commits/${SHA}`);
    assert.equal(options.headers.Accept, 'application/vnd.github+json');
    return {
      ok: true,
      status: 200,
      async json() {
        return {
          sha: expectedSha,
          html_url: `https://github.com/${REPOSITORY}/commit/${SHA}`,
          commit: { committer: { date: COMMITTED_AT } }
        };
      }
    };
  };
}

test('PM3.3: trusted project event has deterministic source idempotency identity', () => {
  const first = createTrustedProjectEvent(sourceEvent());
  const second = createTrustedProjectEvent(sourceEvent());
  assert.equal(first.idempotencyKey, second.idempotencyKey);
  assert.match(first.idempotencyKey, /^pm3-source:[a-f0-9]{64}$/);
  assert.equal(first.sourceEventId, `github:commit:${REPOSITORY}:${SHA}`);
});

test('PM3.3: verified GitHub commit produces a bounded verified but unconfirmed candidate', async () => {
  const verifier = createGitHubCommitVerifier({
    fetchImpl: verifiedFetch(),
    allowedRepositories: [REPOSITORY]
  });
  const boundary = createProjectMemoryIngestionBoundary({ githubVerifier: verifier });
  const result = await boundary.ingest(sourceEvent());

  assert.equal(result.status, 'candidate');
  assert.equal(result.verification.verified, true);
  assert.equal(result.verification.repository, REPOSITORY);
  assert.equal(result.verification.commitSha, SHA);
  assert.equal(result.candidate.projectKey, 'sg2.1');
  assert.equal(result.candidate.namespace, 'project.sg2.1.features');
  assert.equal(result.candidate.trust, 'verified');
  assert.equal(result.candidate.confirmed, false);
  assert.equal(result.candidate.confirmationState, 'proposed');
  assert.equal(result.candidate.source.kind, 'github');
  assert.equal(result.candidate.source.ref, `github:${REPOSITORY}@${SHA}`);
  assert.equal(result.candidate.sourceEventId, `github:commit:${REPOSITORY}:${SHA}`);
  assert.equal(result.candidate.metadata.sourceVerification.verified, true);
  assert.equal(result.candidate.metadata.sourceVerification.repository, REPOSITORY);
  assert.equal(result.candidate.metadata.sourceVerification.commitSha, SHA);
  assert.equal(result.candidate.metadata.sourceIdempotencyKey, result.idempotencyKey);
});

test('PM3.3: GitHub verification fails closed on unapproved repository', async () => {
  const verifier = createGitHubCommitVerifier({
    fetchImpl: verifiedFetch(),
    allowedRepositories: ['openai/example']
  });
  const boundary = createProjectMemoryIngestionBoundary({ githubVerifier: verifier });
  await assert.rejects(
    () => boundary.ingest(sourceEvent()),
    (error) => error.code === 'project-memory-source-denied'
  );
});

test('PM3.3: GitHub verification fails closed when immutable SHA does not match provider response', async () => {
  const verifier = createGitHubCommitVerifier({
    fetchImpl: verifiedFetch('0'.repeat(40)),
    allowedRepositories: [REPOSITORY]
  });
  const boundary = createProjectMemoryIngestionBoundary({ githubVerifier: verifier });
  await assert.rejects(
    () => boundary.ingest(sourceEvent()),
    (error) => error.code === 'project-memory-source-verification-failed'
  );
});

test('PM3.3: raw chat and model output cannot enter trusted-source boundary', () => {
  for (const sourceKind of ['chat', 'user-chat', 'model', 'llm']) {
    assert.throws(
      () => createTrustedProjectEvent(sourceEvent({ sourceKind })),
      (error) => error.code === `project-memory-source-${sourceKind}-unavailable`
    );
  }
});

test('PM3.3: Render is explicitly unavailable until a real verified connector exists', () => {
  assert.throws(
    () => createTrustedProjectEvent(sourceEvent({ sourceKind: 'render' })),
    (error) => error.code === 'project-memory-source-render-unavailable'
  );
});

test('PM3.3: trusted source cannot smuggle authority or secrets into candidate fact', async () => {
  const verifier = createGitHubCommitVerifier({ fetchImpl: verifiedFetch(), allowedRepositories: [REPOSITORY] });
  const boundary = createProjectMemoryIngestionBoundary({ githubVerifier: verifier });

  await assert.rejects(
    () => boundary.ingest(sourceEvent({ candidate: { ...sourceEvent().candidate, fact: { status: 'implemented', roles: ['owner'] } } })),
    (error) => error.code === 'project-memory-authority-field-rejected'
  );
  await assert.rejects(
    () => boundary.ingest(sourceEvent({ candidate: { ...sourceEvent().candidate, fact: { status: 'implemented', api_key: 'secret' } } })),
    (error) => error.code === 'project-memory-secret-field-rejected'
  );
});
