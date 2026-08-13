import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PDK4_SOURCE_LIMITS,
  createDevelopmentSourceNormalizer
} from '../src/projectDevelopmentKnowledge/index.js';

const repo = 'korzh260609-beep/garya-bot';
const projectKey = 'sg2.1';
const commitSha = 'a'.repeat(40);

function verifierWithFiles(files) {
  return {
    async getCommit({ sha }) {
      return {
        sha,
        committedAt: '2026-08-13T03:30:00Z',
        message: 'Large verified commit evidence',
        parentShas: ['b'.repeat(40)],
        stats: { additions: files.length, deletions: 0, total: files.length },
        files
      };
    }
  };
}

function createNormalizer(files) {
  return createDevelopmentSourceNormalizer({
    githubVerifier: verifierWithFiles(files),
    approvedRepositories: [repo]
  });
}

test('PDK4.3 regression: aggregate patch evidence is compacted deterministically within normalized byte budget', async () => {
  const files = Array.from({ length: PDK4_SOURCE_LIMITS.maxFiles }, (_, index) => ({
    path: `src/large-${index}.js`,
    status: 'modified',
    additions: 1,
    deletions: 0,
    changes: 1,
    patch: 'x'.repeat(PDK4_SOURCE_LIMITS.maxPatchCharsPerFile)
  }));
  const normalizer = createNormalizer(files);
  const input = { kind: 'github-commit', projectKey, repository: repo, sha: commitSha };

  const first = await normalizer.normalizeAndVerify(input);
  const second = await normalizer.normalizeAndVerify(input);

  assert.equal(first.payload.files.length, PDK4_SOURCE_LIMITS.maxFiles);
  assert.ok(Buffer.byteLength(JSON.stringify(first), 'utf8') <= PDK4_SOURCE_LIMITS.maxNormalizedBytes);
  assert.ok(first.payload.files.some((file) => typeof file.patch === 'string' && file.patch.length < PDK4_SOURCE_LIMITS.maxPatchCharsPerFile));
  assert.ok(first.payload.files.some((file) => typeof file.patch === 'string' && file.patch.length > 0));
  assert.equal(first.normalizedFingerprint, second.normalizedFingerprint);
});

test('PDK4.3 regression: file-count guard remains fail-closed above maxFiles', async () => {
  const files = Array.from({ length: PDK4_SOURCE_LIMITS.maxFiles + 1 }, (_, index) => ({
    path: `src/too-many-${index}.js`,
    patch: '+x'
  }));
  const normalizer = createNormalizer(files);

  await assert.rejects(
    () => normalizer.normalizeAndVerify({ kind: 'github-commit', projectKey, repository: repo, sha: commitSha }),
    (error) => error.code === 'pdk4-source-too-large'
  );
});
