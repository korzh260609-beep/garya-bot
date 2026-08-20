import test from 'node:test';
import assert from 'node:assert/strict';
import { createGitHubAtomicCommitService } from '../src/githubDevelopment/githubAtomicCommitService.js';

const BASE = 'a'.repeat(40); const TREE = 'b'.repeat(40); const NEXT_TREE = 'c'.repeat(40); const NEXT = 'd'.repeat(40);
const OLD_A = '1'.repeat(40); const OLD_MOVE = '2'.repeat(40); const OLD_DELETE = '3'.repeat(40); const NEW_BLOB = '4'.repeat(40);
function response(body, status = 200) { return { ok: status >= 200 && status < 300, status, async json() { return body; } }; }
function provider() { return { async withInstallationToken(input) { return input.operation('secret-token'); } }; }
function plan(changes) { return { repository: { owner: 'acme', name: 'project' }, targetRef: { kind: 'branch', name: 'dev/task' }, baseline: { repository: { owner: 'acme', name: 'project' }, sha: BASE }, changes, commitMessage: 'Apply bounded changes', idempotencyKey: 'task-7-attempt-1' }; }

function atomicFixture({ head = BASE, refStatus = 200, patchStatus = 200, currentMessage = '', capture = () => {} } = {}) {
  return createGitHubAtomicCommitService({ githubAppProvider: provider(), clock: () => new Date('2026-08-20T12:00:00Z'), fetchImpl: async (url, init) => {
    const path = new URL(url).pathname; const body = init.body ? JSON.parse(init.body) : null; capture({ path, method: init.method, body, headers: init.headers });
    if (path.endsWith('/git/ref/heads/dev/task')) return response({ object: { sha: head } }, refStatus);
    if (path.endsWith(`/git/commits/${head}`) && head !== BASE) return response({ message: currentMessage, tree: { sha: TREE } });
    if (path.endsWith(`/git/commits/${BASE}`)) return response({ message: 'base', tree: { sha: TREE } });
    if (path.endsWith(`/git/trees/${TREE}`)) return response({ tree: [{ path: 'src/a.js', type: 'blob', mode: '100644', sha: OLD_A }, { path: 'src/move.js', type: 'blob', mode: '100755', sha: OLD_MOVE }, { path: 'src/delete.js', type: 'blob', mode: '100644', sha: OLD_DELETE }, { path: 'unrelated.txt', type: 'blob', mode: '100644', sha: '9'.repeat(40) }] });
    if (path.endsWith('/git/blobs')) return response({ sha: NEW_BLOB }, 201);
    if (path.endsWith('/git/trees')) return response({ sha: NEXT_TREE }, 201);
    if (path.endsWith('/git/commits')) return response({ sha: NEXT }, 201);
    if (path.endsWith('/git/refs/heads/dev/task')) return response({ object: { sha: NEXT } }, patchStatus);
    throw new Error(`unexpected ${init.method} ${path}`);
  } });
}

test('create update move and delete become one atomic commit over the baseline tree', async () => {
  const calls = [];
  const service = atomicFixture({ capture: (value) => calls.push(value) });
  const mutationPlan = plan([{ operation: 'create', path: 'src/new.js' }, { operation: 'update', path: 'src/a.js', expectedBlobSha: OLD_A }, { operation: 'move', path: 'src/move.js', destinationPath: 'src/moved.js', expectedBlobSha: OLD_MOVE }, { operation: 'delete', path: 'src/delete.js', expectedBlobSha: OLD_DELETE }]);
  const result = await service.applyAtomicCommit({ connectionId: 'github:7', mutationPlan, fileContents: { 'src/new.js': 'new', 'src/a.js': 'updated' } });
  const treeCall = calls.find((call) => call.method === 'POST' && call.path.endsWith('/git/trees'));
  const commitCall = calls.find((call) => call.method === 'POST' && call.path.endsWith('/git/commits'));
  const refCall = calls.find((call) => call.method === 'PATCH');
  assert.equal(treeCall.body.base_tree, TREE); assert.equal(treeCall.body.tree.length, 5); assert.equal(treeCall.body.tree.some((entry) => entry.path === 'unrelated.txt'), false);
  assert.deepEqual(commitCall.body.parents, [BASE]); assert.match(commitCall.body.message, /SG-Idempotency-Key: task-7-attempt-1/);
  assert.deepEqual(refCall.body, { sha: NEXT, force: false }); assert.equal(result.commitSha, NEXT); assert.equal(result.rollback.restoreHeadSha, BASE); assert.equal(result.rollback.reverseOperations.length, 4);
  assert.equal(JSON.stringify(result).includes('secret-token'), false);
});

test('stale HEAD fails before blobs or trees are created', async () => {
  const calls = []; const service = atomicFixture({ head: NEXT, capture: (value) => calls.push(value) });
  await assert.rejects(() => service.applyAtomicCommit({ connectionId: 'github:7', mutationPlan: plan([{ operation: 'create', path: 'new.js' }]), fileContents: { 'new.js': 'x' } }), (error) => error.code === 'gh3-atomic-stale-head');
  assert.equal(calls.some((call) => call.method === 'POST'), false);
});

test('idempotent retry recognizes the existing commit and does not mutate again', async () => {
  const calls = []; const service = atomicFixture({ head: NEXT, currentMessage: 'Apply\n\nSG-Idempotency-Key: task-7-attempt-1', capture: (value) => calls.push(value) });
  const result = await service.applyAtomicCommit({ connectionId: 'github:7', mutationPlan: plan([{ operation: 'create', path: 'new.js' }]), fileContents: { 'new.js': 'x' } });
  assert.equal(result.reused, true); assert.equal(result.commitSha, NEXT); assert.equal(calls.some((call) => call.method === 'POST'), false);
});

test('blob conflicts and occupied move destinations fail closed before mutation', async () => {
  const service = atomicFixture();
  await assert.rejects(() => service.applyAtomicCommit({ connectionId: 'github:7', mutationPlan: plan([{ operation: 'update', path: 'src/a.js', expectedBlobSha: '8'.repeat(40) }]), fileContents: { 'src/a.js': 'x' } }), (error) => error.code === 'gh3-atomic-blob-conflict');
  await assert.rejects(() => service.applyAtomicCommit({ connectionId: 'github:7', mutationPlan: plan([{ operation: 'move', path: 'src/a.js', destinationPath: 'src/move.js' }]) }), (error) => error.code === 'gh3-atomic-path-exists');
});

test('branch creation and exact-baseline reuse are explicit', async () => {
  for (const existing of [null, BASE]) {
    const calls = []; let providerInput;
    const githubAppProvider = { async withInstallationToken(input) { providerInput = input; return input.operation('token'); } };
    const service = createGitHubAtomicCommitService({ githubAppProvider, fetchImpl: async (url, init) => {
      calls.push({ url, init }); if (init.method === 'GET') return existing ? response({ object: { sha: existing } }) : response({}, 404); return response({ object: { sha: BASE } }, 201);
    } });
    const result = await service.ensureBranch({ connectionId: 'github:7', repository: { owner: 'acme', name: 'project' }, branch: 'dev/task', baselineSha: BASE });
    assert.equal(providerInput.capability, 'github.branch.create'); assert.equal(result.created, existing === null); assert.equal(calls.some((call) => call.init.method === 'POST'), existing === null);
  }
});

test('different existing branch baseline and non-fast-forward update are rejected', async () => {
  const service = createGitHubAtomicCommitService({ githubAppProvider: provider(), fetchImpl: async () => response({ object: { sha: NEXT } }) });
  await assert.rejects(() => service.ensureBranch({ connectionId: 'github:7', repository: { owner: 'acme', name: 'project' }, branch: 'dev/task', baselineSha: BASE }), (error) => error.code === 'gh3-atomic-stale-head');
  const rejected = atomicFixture({ patchStatus: 422 });
  await assert.rejects(() => rejected.applyAtomicCommit({ connectionId: 'github:7', mutationPlan: plan([{ operation: 'create', path: 'new.js' }]), fileContents: { 'new.js': 'x' } }), (error) => error.code === 'gh3-atomic-non-fast-forward');
});
