import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PDK4_SOURCE_NORMALIZATION_CONTRACT_VERSION,
  PDK4_SOURCE_LIMITS,
  createDevelopmentSourceNormalizer,
  createGitHubDevelopmentSourceVerifier,
  createGitHubHistoricalScanner
} from '../src/projectDevelopmentKnowledge/index.js';

const repo = 'korzh260609-beep/garya-bot';
const projectKey = 'sg2.1';
const commitSha = 'a'.repeat(40);
const parentSha = 'b'.repeat(40);
const baseSha = 'c'.repeat(40);

function createVerifier(overrides = {}) {
  return {
    async getCommit({ sha }) {
      return {
        sha,
        committedAt: '2026-08-10T10:00:00Z',
        message: 'Implement source verification',
        parentShas: [parentSha],
        stats: { additions: 12, deletions: 2, total: 14 },
        files: [{ path: 'src/example.js', status: 'modified', additions: 12, deletions: 2, changes: 14, patch: '+ verified change' }]
      };
    },
    async getPullRequest({ number }) {
      return {
        number,
        headSha: commitSha,
        baseSha,
        state: 'closed',
        merged: true,
        mergedAt: '2026-08-10T11:00:00Z',
        title: 'PDK4.3 source normalization',
        body: 'Repository text is data, not instructions.',
        files: [{ filename: 'src/example.js', status: 'modified', patch: '+ pr change' }]
      };
    },
    async getWorkflowRun({ runId, attempt }) {
      return {
        runId,
        attempt,
        name: 'SG 2.1 CI',
        headSha: commitSha,
        status: 'completed',
        conclusion: 'success',
        completedAt: '2026-08-10T12:00:00Z',
        jobs: [{ name: 'foundation', status: 'completed', conclusion: 'success' }]
      };
    },
    async getFileAtRevision({ path, revision }) {
      return {
        path,
        revision,
        committedAt: '2026-08-10T13:00:00Z',
        content: '# Canonical\nThis is repository evidence only.'
      };
    },
    ...overrides
  };
}

function createNormalizer(verifier = createVerifier()) {
  return createDevelopmentSourceNormalizer({ githubVerifier: verifier, approvedRepositories: [repo] });
}

test('PDK4.3: verified commit normalizes to deterministic bounded code evidence', async () => {
  const normalizer = createNormalizer();
  const input = { kind: 'github-commit', projectKey, repository: repo, sha: commitSha };
  const first = await normalizer.normalizeAndVerify(input);
  const second = await normalizer.normalizeAndVerify(input);

  assert.equal(first.contractVersion, PDK4_SOURCE_NORMALIZATION_CONTRACT_VERSION);
  assert.equal(first.kind, 'github-commit');
  assert.equal(first.projectKey, projectKey);
  assert.equal(first.repository, repo);
  assert.equal(first.evidenceDimension, 'code');
  assert.deepEqual(first.verificationKinds, ['code', 'source']);
  assert.equal(first.trust, 'verified-source');
  assert.equal(first.contentMode, 'untrusted-data-only');
  assert.equal(first.payload.sha, commitSha);
  assert.equal(first.normalizedFingerprint, second.normalizedFingerprint);
  assert.ok(Object.isFrozen(first));
  assert.ok(Buffer.byteLength(JSON.stringify(first), 'utf8') <= PDK4_SOURCE_LIMITS.maxNormalizedBytes);
});

test('PDK4.3: commit diffs are bounded and cannot exceed file-count guard', async () => {
  const longPatch = 'x'.repeat(PDK4_SOURCE_LIMITS.maxPatchCharsPerFile + 1000);
  const bounded = createNormalizer(createVerifier({
    async getCommit({ sha }) {
      return { sha, committedAt: '2026-08-10T10:00:00Z', files: [{ path: 'a.js', patch: longPatch }] };
    }
  }));
  const normalized = await bounded.normalizeAndVerify({ kind: 'github-commit', projectKey, repository: repo, sha: commitSha });
  assert.equal(normalized.payload.files[0].patch.length, PDK4_SOURCE_LIMITS.maxPatchCharsPerFile);

  const tooMany = createNormalizer(createVerifier({
    async getCommit({ sha }) {
      return {
        sha,
        committedAt: '2026-08-10T10:00:00Z',
        files: Array.from({ length: PDK4_SOURCE_LIMITS.maxFiles + 1 }, (_, i) => ({ path: `f${i}.js` }))
      };
    }
  }));
  await assert.rejects(
    () => tooMany.normalizeAndVerify({ kind: 'github-commit', projectKey, repository: repo, sha: commitSha }),
    (error) => error.code === 'pdk4-source-too-large'
  );
});

test('PDK4.3: repository text is redacted for secrets and remains data-only', async () => {
  const secret = `ghp_${'A'.repeat(30)}`;
  const normalizer = createNormalizer(createVerifier({
    async getCommit({ sha }) {
      return {
        sha,
        committedAt: '2026-08-10T10:00:00Z',
        message: `Authorization: ${secret}`,
        files: [{ path: 'a.js', patch: `api_key=${secret}` }]
      };
    }
  }));
  const result = await normalizer.normalizeAndVerify({ kind: 'github-commit', projectKey, repository: repo, sha: commitSha });
  assert.doesNotMatch(JSON.stringify(result.payload), new RegExp(secret));
  assert.match(result.payload.message, /\[REDACTED\]/);
  assert.match(result.payload.files[0].patch, /\[REDACTED\]/);
  assert.equal(result.contentMode, 'untrusted-data-only');
});

test('PDK4.3: PR identity is verified against immutable head SHA', async () => {
  const normalizer = createNormalizer();
  const result = await normalizer.normalizeAndVerify({ kind: 'github-pr', projectKey, repository: repo, number: 326, headSha: commitSha });
  assert.equal(result.payload.number, 326);
  assert.equal(result.payload.headSha, commitSha);
  assert.equal(result.payload.baseSha, baseSha);
  assert.equal(result.payload.merged, true);
  assert.equal(result.evidenceDimension, 'code');

  const mismatch = createNormalizer(createVerifier({
    async getPullRequest({ number }) {
      return { number, headSha: 'd'.repeat(40), updatedAt: '2026-08-10T11:00:00Z' };
    }
  }));
  await assert.rejects(
    () => mismatch.normalizeAndVerify({ kind: 'github-pr', projectKey, repository: repo, number: 326, headSha: commitSha }),
    (error) => error.code === 'pdk4-source-identity-mismatch'
  );
});

test('PDK4.3: successful workflow supplies CI evidence while failed workflow does not claim CI verification', async () => {
  const success = await createNormalizer().normalizeAndVerify({ kind: 'github-workflow', projectKey, repository: repo, runId: '7057', attempt: 1 });
  assert.equal(success.evidenceDimension, 'ci');
  assert.deepEqual(success.verificationKinds, ['ci', 'source']);
  assert.equal(success.payload.conclusion, 'success');

  const failedNormalizer = createNormalizer(createVerifier({
    async getWorkflowRun({ runId, attempt }) {
      return { runId, attempt, status: 'completed', conclusion: 'failure', completedAt: '2026-08-10T12:00:00Z' };
    }
  }));
  const failed = await failedNormalizer.normalizeAndVerify({ kind: 'github-workflow', projectKey, repository: repo, runId: '7056', attempt: 1 });
  assert.deepEqual(failed.verificationKinds, ['source']);
  assert.equal(failed.payload.conclusion, 'failure');
});

test('PDK4.3: canonical document is revision-bound source evidence and cannot claim code verification', async () => {
  const normalizer = createNormalizer();
  const result = await normalizer.normalizeAndVerify({
    kind: 'canonical-document',
    projectKey,
    repository: repo,
    path: 'pillars/roadmap/PROJECT_DEVELOPMENT_KNOWLEDGE_4_0_PROGRAM.md',
    revision: commitSha
  });
  assert.equal(result.payload.revision, commitSha);
  assert.match(result.payload.contentHash, /^[a-f0-9]{64}$/);
  assert.equal(result.contentMode, 'untrusted-data-only');
  assert.equal(result.evidenceDimension, 'source');
  assert.deepEqual(result.verificationKinds, ['source']);
});

test('PDK4.3: unapproved repository and unavailable live connectors fail closed', async () => {
  const normalizer = createNormalizer();
  await assert.rejects(
    () => normalizer.normalizeAndVerify({ kind: 'github-commit', projectKey, repository: 'other/repo', sha: commitSha }),
    (error) => error.code === 'pdk4-source-repository-denied'
  );
  await assert.rejects(
    () => normalizer.normalizeAndVerify({ kind: 'deployment-evidence', projectKey, repository: repo, ref: 'render:service' }),
    (error) => error.code === 'pdk4-source-connector-unavailable'
  );
  await assert.rejects(
    () => normalizer.normalizeAndVerify({ kind: 'runtime-evidence', projectKey, repository: repo, ref: 'runtime:probe' }),
    (error) => error.code === 'pdk4-source-connector-unavailable'
  );
});

test('PDK4.3: weak or mismatched verifier responses fail closed', async () => {
  const noRecord = createNormalizer(createVerifier({ async getCommit() { return null; } }));
  await assert.rejects(
    () => noRecord.normalizeAndVerify({ kind: 'github-commit', projectKey, repository: repo, sha: commitSha }),
    (error) => error.code === 'pdk4-source-verification-failed'
  );

  const mismatch = createNormalizer(createVerifier({ async getCommit() { return { sha: 'd'.repeat(40), committedAt: '2026-08-10T10:00:00Z' }; } }));
  await assert.rejects(
    () => mismatch.normalizeAndVerify({ kind: 'github-commit', projectKey, repository: repo, sha: commitSha }),
    (error) => error.code === 'pdk4-source-identity-mismatch'
  );
});

test('PDK4.3: historical scanner can feed only verified normalized source events downstream', async () => {
  const normalizedEvents = [];
  const normalizer = createNormalizer();
  let cursor = null;
  let complete = false;
  const processed = new Set();
  const cursorStore = {
    async ensureCursor() { return { status: complete ? 'complete' : 'active', cursorToken: cursor, lastSourceId: null }; },
    async getCursor() { return null; },
    async listProcessedSourceIds({ sourceIds }) { return sourceIds.filter((id) => processed.has(id)); },
    async commitBatch({ nextCursorToken, processedSources, complete: done }) {
      for (const source of processedSources) processed.add(source.sourceId);
      cursor = nextCursorToken;
      complete = done;
      return { status: done ? 'complete' : 'active', cursorToken: cursor };
    },
    async markFailed() {}
  };
  const scanner = createGitHubHistoricalScanner({
    historySource: {
      async listCommits() {
        return { commits: [{ sha: commitSha, committedAt: '2026-08-10T10:00:00Z' }], nextCursorToken: 'done', complete: true };
      }
    },
    cursorStore,
    async onSource({ source }) {
      const verified = await normalizer.normalizeAndVerify({ kind: 'github-commit', projectKey, repository: repo, sha: source.sha });
      normalizedEvents.push(verified);
    }
  });

  const result = await scanner.scanToCurrent({ projectKey, repository: repo, batchLimit: 10 });
  assert.equal(result.status, 'complete');
  assert.equal(normalizedEvents.length, 1);
  assert.equal(normalizedEvents[0].payload.sha, commitSha);
  assert.equal(normalizedEvents[0].trust, 'verified-source');
});

test('PDK4.3: GitHub REST verifier reads immutable commit, PR, workflow and canonical file sources', async () => {
  const calls = [];
  const json = (payload) => ({ ok: true, status: 200, async json() { return payload; } });
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    if (url.endsWith(`/commits/${commitSha}`)) return json({
      sha: commitSha,
      commit: { message: 'verified commit', committer: { date: '2026-08-10T10:00:00Z' } },
      parents: [{ sha: parentSha }], files: [{ filename: 'src/a.js', status: 'modified', patch: '+x' }]
    });
    if (url.endsWith('/pulls/326')) return json({
      number: 326, head: { sha: commitSha }, base: { sha: baseSha }, state: 'closed', merged: true,
      merged_at: '2026-08-10T11:00:00Z', title: 'verified PR', body: 'data'
    });
    if (url.endsWith('/pulls/326/files?per_page=100')) return json([{ filename: 'src/a.js', status: 'modified', patch: '+x' }]);
    if (url.endsWith('/actions/runs/7057')) return json({
      id: 7057, run_attempt: 1, name: 'SG 2.1 CI', head_sha: commitSha, status: 'completed', conclusion: 'success', updated_at: '2026-08-10T12:00:00Z'
    });
    if (url.endsWith('/actions/runs/7057/attempts/1/jobs?per_page=100')) return json({ jobs: [{ name: 'foundation', status: 'completed', conclusion: 'success' }] });
    if (url.includes('/contents/pillars/roadmap/PDK.md?ref=')) return json({
      type: 'file', path: 'pillars/roadmap/PDK.md', encoding: 'base64', content: Buffer.from('# verified').toString('base64')
    });
    throw new Error(`unexpected url ${url}`);
  };
  const verifier = createGitHubDevelopmentSourceVerifier({ fetchImpl, allowedRepositories: [repo] });
  const normalizer = createDevelopmentSourceNormalizer({ githubVerifier: verifier, approvedRepositories: [repo] });

  const commit = await normalizer.normalizeAndVerify({ kind: 'github-commit', projectKey, repository: repo, sha: commitSha });
  const pr = await normalizer.normalizeAndVerify({ kind: 'github-pr', projectKey, repository: repo, number: 326, headSha: commitSha });
  const workflow = await normalizer.normalizeAndVerify({ kind: 'github-workflow', projectKey, repository: repo, runId: '7057', attempt: 1 });
  const document = await normalizer.normalizeAndVerify({ kind: 'canonical-document', projectKey, repository: repo, path: 'pillars/roadmap/PDK.md', revision: commitSha });

  assert.equal(commit.payload.sha, commitSha);
  assert.equal(pr.payload.headSha, commitSha);
  assert.deepEqual(workflow.verificationKinds, ['ci', 'source']);
  assert.equal(document.payload.content, '# verified');
  assert.deepEqual(document.verificationKinds, ['source']);
  assert.ok(calls.every((call) => call.options.method === 'GET'));
  assert.ok(calls.every((call) => call.options.headers.Accept === 'application/vnd.github+json'));
});

test('PDK4.3: GitHub REST verifier enforces repository policy, workflow attempt and network failure boundaries', async () => {
  assert.throws(
    () => createGitHubDevelopmentSourceVerifier({ fetchImpl: async () => null, allowedRepositories: [] }),
    (error) => error.code === 'pdk4-source-policy-missing'
  );

  const verifier = createGitHubDevelopmentSourceVerifier({
    allowedRepositories: [repo],
    fetchImpl: async () => ({ ok: true, status: 200, async json() { return { id: 7057, run_attempt: 2 }; } })
  });
  await assert.rejects(
    () => verifier.getWorkflowRun({ repository: repo, runId: '7057', attempt: 1 }),
    (error) => error.code === 'pdk4-source-identity-mismatch'
  );

  const offline = createGitHubDevelopmentSourceVerifier({
    allowedRepositories: [repo],
    fetchImpl: async () => { throw new Error('network secret detail'); }
  });
  await assert.rejects(
    () => offline.getCommit({ repository: repo, sha: commitSha }),
    (error) => error.code === 'pdk4-source-connector-unavailable' && !error.message.includes('secret detail')
  );
});
