import { createHash } from 'node:crypto';
import { createProjectFact } from './projectFactContract.js';

const MAX_CONFLICT_REASON_LENGTH = 512;

function required(value, name) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${name} is required`);
  return value.trim();
}
function optional(value) { return value == null || String(value).trim() === '' ? null : String(value).trim(); }
function stable(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(',')}}`;
}
function hash(value) { return createHash('sha256').update(stable(value)).digest('hex'); }
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function resolverError(message, code) { const error = new Error(message); error.code = code; return error; }
function sortedStrings(values = []) { return [...new Set(values.map((value) => required(value, 'string value')))].sort(); }
function contentTokens(value) {
  return [...new Set(stable(value).normalize('NFKC').toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [])];
}
function jaccard(left, right) {
  const a = new Set(contentTokens(left));
  const b = new Set(contentTokens(right));
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const token of a) if (b.has(token)) intersection += 1;
  return intersection / (a.size + b.size - intersection);
}

export function createProjectMemoryContentFingerprint(record) {
  if (!record || typeof record !== 'object') throw new TypeError('project memory record is required');
  return hash({
    projectKey: required(record.projectKey, 'projectKey').toLowerCase(),
    namespace: required(record.namespace, 'namespace').toLowerCase(),
    factType: required(record.factType, 'factType').toLowerCase(),
    entityKey: required(record.entityKey, 'entityKey'),
    fact: clone(record.fact),
    relationKeys: sortedStrings(record.relationKeys ?? [])
  });
}

export function createProjectMemoryDedupKeys(record) {
  const projectKey = required(record?.projectKey, 'projectKey').toLowerCase();
  const namespace = required(record?.namespace, 'namespace').toLowerCase();
  const factType = required(record?.factType, 'factType').toLowerCase();
  const entityKey = required(record?.entityKey, 'entityKey');
  const sourceKind = required(record?.source?.kind, 'source.kind').toLowerCase();
  const sourceRef = required(record?.source?.ref, 'source.ref');
  const sourceEventId = optional(record?.sourceEventId);
  const traceId = optional(record?.traceId);
  const contentFingerprint = createProjectMemoryContentFingerprint(record);
  return Object.freeze({
    contentFingerprint,
    sourceEventKey: sourceEventId ? `pm3-event:${hash({ projectKey, sourceKind, sourceRef, sourceEventId })}` : null,
    traceEntityKey: traceId ? `pm3-trace:${hash({ projectKey, traceId, namespace, factType, entityKey })}` : null,
    sourceEntityFingerprintKey: `pm3-source-entity:${hash({ projectKey, sourceKind, sourceRef, namespace, factType, entityKey, contentFingerprint })}`,
    entityFingerprintKey: `pm3-entity:${hash({ projectKey, namespace, factType, entityKey, contentFingerprint })}`
  });
}

export function createProjectMemorySimilarityEvidence(left, right) {
  const score = Number(jaccard(left?.fact, right?.fact).toFixed(6));
  return Object.freeze({ method: 'token-jaccard-v1', score, secondaryOnly: true });
}

export function evaluateProjectMemoryConflictResolution({ left, right, monarchDecision = null } = {}) {
  if (!left || !right) throw new TypeError('left and right project memory records are required');
  if (left.projectKey !== right.projectKey) throw resolverError('cross-project conflict resolution is denied', 'project-memory-project-scope-denied');
  if (createProjectMemoryContentFingerprint(left) === createProjectMemoryContentFingerprint(right)) {
    return Object.freeze({ status: 'duplicate', winnerMemoryId: left.memoryId, reason: 'same-canonical-content' });
  }
  if (left.confirmationState === 'rejected' && right.confirmationState !== 'rejected') {
    return Object.freeze({ status: 'resolved', winnerMemoryId: right.memoryId, reason: 'other-record-rejected' });
  }
  if (right.confirmationState === 'rejected' && left.confirmationState !== 'rejected') {
    return Object.freeze({ status: 'resolved', winnerMemoryId: left.memoryId, reason: 'other-record-rejected' });
  }
  if (monarchDecision?.authorized === true) {
    const winnerMemoryId = required(monarchDecision.winnerMemoryId, 'monarchDecision.winnerMemoryId');
    if (![left.memoryId, right.memoryId].includes(winnerMemoryId)) throw resolverError('Monarch winner must be one of the conflicting records', 'project-memory-conflict-winner-invalid');
    return Object.freeze({ status: 'resolved', winnerMemoryId, reason: 'authorized-monarch-decision' });
  }
  return Object.freeze({
    status: 'unresolved',
    winnerMemoryId: null,
    reason: 'contradictory-evidence-requires-authority',
    evidence: Object.freeze({
      left: { trust: left.trust, confirmed: left.confirmed, sourceRef: left.source?.ref ?? null, validFrom: left.validFrom },
      right: { trust: right.trust, confirmed: right.confirmed, sourceRef: right.source?.ref ?? null, validFrom: right.validFrom },
      similarity: createProjectMemorySimilarityEvidence(left, right)
    })
  });
}

function normalizeCandidate(input) {
  return createProjectFact({
    ...input,
    memoryId: input.memoryId,
    source: input.source,
    relationKeys: input.relationKeys ?? [],
    tags: input.tags ?? [],
    metadata: input.metadata ?? {}
  }, { clock: () => new Date(input.createdAt ?? Date.now()) });
}

export function createProjectMemoryDedupConflictResolver({ store, database, ownerSecurityGateway = null, clock = () => new Date() } = {}) {
  if (!store?.get || !store?.put || !store?.recordConflict) throw new TypeError('project memory store with get/put/recordConflict is required');
  if (!database?.query || !database?.transaction) throw new TypeError('started PostgreSQL database is required');
  if (typeof clock !== 'function') throw new TypeError('clock must be a function');

  async function ingest(input) {
    const candidate = normalizeCandidate(input);
    const keys = createProjectMemoryDedupKeys(candidate);
    const lockIdentity = `pm3.5:${hash({
      projectKey: candidate.projectKey,
      namespace: candidate.namespace,
      factType: candidate.factType,
      entityKey: candidate.entityKey
    })}`;

    return database.transaction(async (tx) => {
      await tx.query('SELECT pg_advisory_xact_lock(hashtext($1))', [lockIdentity]);

      if (candidate.sourceEventId) {
        const replay = await tx.query('SELECT memory_id FROM project_memory_entries WHERE project_key=$1 AND source_event_id=$2 LIMIT 1', [candidate.projectKey, candidate.sourceEventId]);
        if (replay.rowCount === 1) {
          const existing = await store.get(replay.rows[0].memory_id, { projectKey: candidate.projectKey }, tx);
          return Object.freeze({ status: 'duplicate', duplicateKind: 'source-event', keys, record: existing, conflicts: Object.freeze([]) });
        }
      }

      const peersResult = await tx.query(`SELECT e.memory_id
        FROM project_memory_entries e
        JOIN memory_records m USING(memory_id)
        WHERE e.project_key=$1 AND e.namespace=$2 AND e.fact_type=$3 AND e.entity_key=$4
          AND m.confirmation_state <> 'rejected'
          AND m.lifecycle_state IN ('active','temporary')
        ORDER BY e.updated_at DESC,e.memory_id`, [candidate.projectKey, candidate.namespace, candidate.factType, candidate.entityKey]);
      const peers = [];
      for (const row of peersResult.rows) {
        const peer = await store.get(row.memory_id, { projectKey: candidate.projectKey }, tx);
        if (peer) peers.push(peer);
      }

      const exact = peers.find((peer) => createProjectMemoryContentFingerprint(peer) === keys.contentFingerprint);
      if (exact) {
        return Object.freeze({ status: 'duplicate', duplicateKind: 'canonical-content', keys, record: exact, conflicts: Object.freeze([]) });
      }

      const decorated = normalizeCandidate({
        ...candidate,
        metadata: {
          ...(candidate.metadata ?? {}),
          deduplication: {
            contractVersion: 1,
            contentFingerprint: keys.contentFingerprint,
            sourceEventKey: keys.sourceEventKey,
            traceEntityKey: keys.traceEntityKey,
            sourceEntityFingerprintKey: keys.sourceEntityFingerprintKey,
            entityFingerprintKey: keys.entityFingerprintKey
          }
        }
      });
      const stored = await store.put(decorated, tx);
      const conflicts = [];

      for (const peer of peers) {
        const resolution = evaluateProjectMemoryConflictResolution({ left: peer, right: stored });
        if (resolution.status !== 'unresolved') continue;
        const existingConflict = await tx.query(`SELECT * FROM project_memory_conflicts
          WHERE project_key=$1 AND status='open'
            AND ((memory_id=$2 AND conflicting_memory_id=$3) OR (memory_id=$3 AND conflicting_memory_id=$2))
          LIMIT 1`, [candidate.projectKey, peer.memoryId, stored.memoryId]);
        if (existingConflict.rowCount === 1) {
          conflicts.push(existingConflict.rows[0]);
          continue;
        }
        conflicts.push(await store.recordConflict({
          projectKey: candidate.projectKey,
          memoryId: peer.memoryId,
          conflictingMemoryId: stored.memoryId,
          reason: 'contradictory project fact for same canonical entity',
          metadata: {
            resolver: 'pm3.5-deterministic-v1',
            leftContentFingerprint: createProjectMemoryContentFingerprint(peer),
            rightContentFingerprint: keys.contentFingerprint,
            similarity: resolution.evidence.similarity
          }
        }, tx));
      }

      return Object.freeze({
        status: conflicts.length > 0 ? 'conflict' : 'stored',
        duplicateKind: null,
        keys,
        record: stored,
        conflicts: Object.freeze(conflicts)
      });
    });
  }

  async function resolveConflict({ conflictId, projectKey, winnerMemoryId, actionContext, reason = null } = {}) {
    if (!ownerSecurityGateway?.evaluate) throw resolverError('Owner Security gateway is required for conflict resolution', 'project-memory-owner-security-required');
    const project = required(projectKey, 'projectKey').toLowerCase();
    const id = required(conflictId, 'conflictId');
    const winner = required(winnerMemoryId, 'winnerMemoryId');
    const resolutionReason = optional(reason);
    if (resolutionReason && resolutionReason.length > MAX_CONFLICT_REASON_LENGTH) throw resolverError('conflict resolution reason is too long', 'project-memory-control-payload-too-large');
    if (actionContext?.scope?.projectScope !== project || !actionContext?.traceContext || !actionContext?.actor?.globalUserId) {
      throw new TypeError('validated actionContext with matching project scope, actor and trace is required');
    }
    const ownerDecision = ownerSecurityGateway.evaluate({
      ...actionContext,
      capability: 'project-memory-control',
      actionType: 'project-memory-resolve-conflict',
      actionClass: 'write',
      payload: { ...(actionContext.payload ?? {}), ownerOnly: true, securityClass: 'owner-only', conflictId: id }
    });
    if (!ownerDecision?.allowed || !ownerDecision?.ownerVerified) throw resolverError(`Project Memory conflict resolution denied: ${ownerDecision?.reason ?? 'unknown'}`, 'project-memory-owner-authorization-denied');

    return database.transaction(async (tx) => {
      const conflictResult = await tx.query('SELECT * FROM project_memory_conflicts WHERE conflict_id=$1 AND project_key=$2 FOR UPDATE', [id, project]);
      if (conflictResult.rowCount !== 1) throw resolverError('Project Memory conflict not found', 'project-memory-conflict-not-found');
      const conflict = conflictResult.rows[0];
      if (conflict.status !== 'open') throw resolverError('Project Memory conflict is not open', 'project-memory-conflict-not-open');
      if (![conflict.memory_id, conflict.conflicting_memory_id].includes(winner)) throw resolverError('winnerMemoryId must identify one side of the conflict', 'project-memory-conflict-winner-invalid');
      const left = await store.get(conflict.memory_id, { projectKey: project }, tx);
      const right = await store.get(conflict.conflicting_memory_id, { projectKey: project }, tx);
      if (!left || !right) throw resolverError('conflicting Project Memory record is unavailable', 'project-memory-conflict-record-missing');
      const policy = evaluateProjectMemoryConflictResolution({ left, right, monarchDecision: { authorized: true, winnerMemoryId: winner } });
      const resolvedAt = new Date(clock()).toISOString();
      const metadata = {
        ...(conflict.metadata ?? {}),
        resolution: {
          winnerMemoryId: winner,
          reason: resolutionReason,
          policyReason: policy.reason,
          actorRef: actionContext.actor.globalUserId,
          ownerSecurityPolicyId: ownerDecision.policyId ?? null,
          resolvedAt
        }
      };
      const updated = await tx.query(`UPDATE project_memory_conflicts
        SET status='resolved',resolved_at=$3,metadata=$4::jsonb
        WHERE conflict_id=$1 AND project_key=$2 AND status='open'
        RETURNING *`, [id, project, resolvedAt, JSON.stringify(metadata)]);
      if (updated.rowCount !== 1) throw resolverError('Project Memory conflict resolution lost concurrency race', 'project-memory-conflict-concurrent-update');
      return Object.freeze({ status: 'resolved', winnerMemoryId: winner, conflict: updated.rows[0], ownerDecision, policy });
    });
  }

  return Object.freeze({ ingest, resolveConflict });
}

export const PROJECT_MEMORY3_DEDUP_CONTRACT_VERSION = 1;
