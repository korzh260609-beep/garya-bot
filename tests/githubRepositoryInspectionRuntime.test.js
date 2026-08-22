import test from 'node:test';
import assert from 'node:assert/strict';
import { createGitHubDevelopmentExecutionService } from '../src/githubDevelopment/githubDevelopmentExecutionService.js';

const HEAD = 'a'.repeat(40);
const TREE = [
  { type: 'blob', path: 'pillars/roadmap/LIFECYCLE_ACTIVITY_PROGRAM.md', sha: 'b'.repeat(40) },
  { type: 'blob', path: 'README.md', sha: 'c'.repeat(40) }
];

function aiResult(payload) {
  return { text: typeof payload === 'string' ? payload : JSON.stringify(payload), provider: 'fixture', model: 'fixture', usage: {}, costUsd: 0, latencyMs: 0, attempts: 1, fallbackUsed: false, rawMetadata: {} };
}

test('repository inspect reads exact-head evidence and never invokes mutation service', async () => {
  const calls = [];
  const snapshots = [];
  let atomicCalls = 0;
  const aiRouter = {
    async route(request) {
      calls.push(request);
      if (request.task === 'github-development-file-selection') {
        return aiResult({ files: ['pillars/roadmap/LIFECYCLE_ACTIVITY_PROGRAM.md'], rationale: 'LA evidence lives there' });
      }
      if (request.task === 'github-repository-inspection-answer') {
        return aiResult('Блок LA подтверждён в pillars/roadmap/LIFECYCLE_ACTIVITY_PROGRAM.md.');
      }
      throw new Error(`unexpected AI task ${request.task}`);
    }
  };
  const repositoryReadService = {
    async readSnapshot(input) {
      snapshots.push(input);
      if ((input.files ?? []).length === 0) {
        return { revision: HEAD, tree: { entries: TREE }, files: [] };
      }
      return {
        revision: HEAD,
        tree: { entries: TREE },
        files: [{ path: 'pillars/roadmap/LIFECYCLE_ACTIVITY_PROGRAM.md', sha: 'b'.repeat(40), content: '# LA\n\n## LA1 — Activity Event Core', truncated: false }]
      };
    }
  };
  const atomicCommitService = { async applyAtomicCommit() { atomicCalls += 1; throw new Error('inspect must never mutate'); } };
  const service = createGitHubDevelopmentExecutionService({
    aiRouter,
    repositoryReadService,
    atomicCommitService,
    repository: 'korzh260609-beep/garya-bot',
    branch: 'dev/sg2.1-semantic',
    connectionId: 'github-development',
    clock: () => new Date('2026-08-22T14:00:00.000Z')
  });

  const result = await service.inspect({
    instruction: 'Ты видишь блок LA в репозитории?',
    actor: { globalUserId: 'telegram:owner', roles: ['monarch'] },
    traceContext: { traceId: 't-inspect', requestId: 'r-inspect' }
  });

  assert.equal(result.status, 'success');
  assert.equal(result.mutated, false);
  assert.equal(result.revision, HEAD);
  assert.equal(result.repository, 'korzh260609-beep/garya-bot');
  assert.equal(result.branch, 'dev/sg2.1-semantic');
  assert.deepEqual(result.selectedPaths, ['pillars/roadmap/LIFECYCLE_ACTIVITY_PROGRAM.md']);
  assert.match(result.message, /Блок LA подтверждён/);
  assert.equal(atomicCalls, 0);
  assert.equal(snapshots.length, 2);
  assert.deepEqual(snapshots[1].files, ['pillars/roadmap/LIFECYCLE_ACTIVITY_PROGRAM.md']);
  assert.deepEqual(calls.map((item) => item.task), ['github-development-file-selection', 'github-repository-inspection-answer']);
});

test('repository inspect fails closed when required file evidence is truncated', async () => {
  const aiRouter = { async route(request) { if (request.task === 'github-development-file-selection') return aiResult({ files: ['README.md'], rationale: 'read it' }); throw new Error('answer must not run after truncated evidence'); } };
  let reads = 0;
  const repositoryReadService = {
    async readSnapshot(input) {
      reads += 1;
      if ((input.files ?? []).length === 0) return { revision: HEAD, tree: { entries: TREE }, files: [] };
      return { revision: HEAD, tree: { entries: TREE }, files: [{ path: 'README.md', sha: 'c'.repeat(40), content: 'partial', truncated: true }] };
    }
  };
  const service = createGitHubDevelopmentExecutionService({
    aiRouter,
    repositoryReadService,
    atomicCommitService: { async applyAtomicCommit() { throw new Error('must not mutate'); } },
    repository: 'korzh260609-beep/garya-bot',
    branch: 'dev/sg2.1-semantic'
  });

  await assert.rejects(
    () => service.inspect({ instruction: 'Покажи README', actor: { globalUserId: 'telegram:owner' }, traceContext: { traceId: 't', requestId: 'r' } }),
    (error) => error?.code === 'gh3-execution-evidence-truncated'
  );
  assert.equal(reads, 2);
});

test('repository inspect ignores truncated discovery and unrelated file metadata after reading the selected path', async () => {
  const aiRouter = {
    async route(request) {
      if (request.task === 'github-development-file-selection') return aiResult({ files: ['pillars/roadmap/LIFECYCLE_ACTIVITY_PROGRAM.md'], rationale: 'selected concrete LA path' });
      if (request.task === 'github-repository-inspection-answer') return aiResult('Блок LA подтверждён.');
      throw new Error(`unexpected AI task ${request.task}`);
    }
  };
  const repositoryReadService = {
    async readSnapshot(input) {
      if ((input.files ?? []).length === 0) return { revision: HEAD, tree: { entries: TREE, truncated: true }, files: [] };
      return {
        revision: HEAD,
        tree: { entries: TREE, truncated: true },
        files: [
          { path: 'pillars/roadmap/LIFECYCLE_ACTIVITY_PROGRAM.md', sha: 'b'.repeat(40), content: '# LA', truncated: false },
          { path: 'README.md', sha: 'c'.repeat(40), content: 'partial', truncated: true }
        ]
      };
    }
  };
  const service = createGitHubDevelopmentExecutionService({
    aiRouter,
    repositoryReadService,
    atomicCommitService: { async applyAtomicCommit() { throw new Error('must not mutate'); } },
    repository: 'korzh260609-beep/garya-bot',
    branch: 'dev/sg2.1-semantic'
  });
  const result = await service.inspect({ instruction: 'Ты видишь блок LA?', actor: { globalUserId: 'telegram:owner' }, traceContext: { traceId: 't', requestId: 'r' } });
  assert.equal(result.status, 'success');
  assert.deepEqual(result.selectedPaths, ['pillars/roadmap/LIFECYCLE_ACTIVITY_PROGRAM.md']);
});

test('repository inspect keeps large discovery and GH3 file evidence below the AI input policy limit', async () => {
  const largeTree = Array.from({ length: 758 }, (_, index) => ({ type: 'blob', path: `src/generated/file-${index}.js`, sha: 'd'.repeat(40) }));
  largeTree.push({ type: 'blob', path: 'pillars/roadmap/GITHUB_DEVELOPMENT_WORKSPACE_3_0_PROGRAM.md', sha: 'e'.repeat(40) });
  const routedInputs = [];
  const aiRouter = {
    async route(request) {
      const size = request.messages.reduce((sum, message) => sum + message.content.length, 0);
      routedInputs.push({ task: request.task, size, body: request.messages.at(-1).content });
      assert.ok(size < 24000, `${request.task} input must stay below production policy, got ${size}`);
      if (request.task === 'github-development-file-selection') return aiResult({ files: ['pillars/roadmap/GITHUB_DEVELOPMENT_WORKSPACE_3_0_PROGRAM.md'], rationale: 'GH3 program' });
      return aiResult('Блок GH3 подтверждён.');
    }
  };
  const repositoryReadService = {
    async readSnapshot(input) {
      if ((input.files ?? []).length === 0) return { revision: HEAD, tree: { entries: largeTree }, files: [] };
      const content = `${'x'.repeat(20000)}\n# GH3\n${'y'.repeat(14000)}`;
      return { revision: HEAD, tree: { entries: largeTree }, files: [{ path: input.files[0], sha: 'e'.repeat(40), content, truncated: false }] };
    }
  };
  const service = createGitHubDevelopmentExecutionService({ aiRouter, repositoryReadService, atomicCommitService: { async applyAtomicCommit() {} }, repository: 'korzh260609-beep/garya-bot', branch: 'dev/sg2.1-semantic' });
  const result = await service.inspect({ instruction: 'Ты видишь блок GH3 в репозитории?', actor: { globalUserId: 'telegram:owner' }, traceContext: { traceId: 't', requestId: 'r' } });
  assert.equal(result.status, 'success');
  assert.match(routedInputs[0].body, /GITHUB_DEVELOPMENT_WORKSPACE_3_0_PROGRAM/);
  assert.equal(JSON.parse(routedInputs[1].body).files[0].excerpt, true);
});
