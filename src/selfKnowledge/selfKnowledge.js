import { createHash, randomUUID } from 'node:crypto';

export const SELF_KNOWLEDGE_STATUSES = Object.freeze(['implemented', 'partial', 'planned', 'disabled', 'broken', 'unknown']);
export const SELF_KNOWLEDGE_VALIDATION = Object.freeze(['valid', 'conflicted', 'invalid']);
const FACT_KINDS = Object.freeze(['authority', 'declaration', 'evidence']);
const CATEGORY_PRIORITY = Object.freeze(['identity','purpose','owner','architecture','capabilities','modules','integrations','roles','security','memory','task-automation','sources','ai','deployment','development-status','limitations','planned-features']);

function required(value, name) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${name} is required`);
  return value.trim();
}
function optional(value) { return value == null || String(value).trim() === '' ? null : String(value).trim(); }
function clone(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }
function stable(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(',')}}`;
}
function hash(value) { return createHash('sha256').update(stable(value)).digest('hex'); }
function status(value) {
  const normalized = required(value, 'status');
  if (!SELF_KNOWLEDGE_STATUSES.includes(normalized)) throw new TypeError(`unsupported self knowledge status: ${normalized}`);
  return normalized;
}
function kind(value) {
  const normalized = required(value ?? 'evidence', 'kind');
  if (!FACT_KINDS.includes(normalized)) throw new TypeError(`unsupported self knowledge fact kind: ${normalized}`);
  return normalized;
}
function factKey(fact) { return `${fact.category}:${fact.key}`; }
function priority(category) { const index = CATEGORY_PRIORITY.indexOf(category); return index === -1 ? CATEGORY_PRIORITY.length : index; }

export function createSelfKnowledgeFact(input = {}) {
  const category = required(input.category, 'category');
  const key = required(input.key, 'key');
  const sourceRevision = required(input.provenance?.sourceRevision ?? input.sourceRevision, 'provenance.sourceRevision');
  const factKind = kind(input.kind);
  const factStatus = status(input.status ?? 'unknown');
  return Object.freeze({
    factId: required(input.factId ?? `${factKind}:${category}:${key}:${input.provenance?.sourceId ?? 'source'}`, 'factId'),
    category,
    key,
    value: clone(input.value),
    status: factStatus,
    kind: factKind,
    confidence: Math.max(0, Math.min(1, Number.isFinite(Number(input.confidence)) ? Number(input.confidence) : 1)),
    provenance: Object.freeze({
      sourceType: required(input.provenance?.sourceType ?? factKind, 'provenance.sourceType'),
      sourceId: required(input.provenance?.sourceId, 'provenance.sourceId'),
      sourceRevision,
      contentHash: optional(input.provenance?.contentHash),
      evidenceIds: Object.freeze([...(input.provenance?.evidenceIds ?? [])].map((item) => required(item, 'provenance.evidenceId')))
    })
  });
}

export function createSelfKnowledgeSnapshot(input = {}) {
  const validationStatus = required(input.validationStatus, 'validationStatus');
  if (!SELF_KNOWLEDGE_VALIDATION.includes(validationStatus)) throw new TypeError(`unsupported validation status: ${validationStatus}`);
  const version = Number(input.version);
  if (!Number.isInteger(version) || version < 1) throw new TypeError('version must be a positive integer');
  const createdAt = required(input.createdAt, 'createdAt');
  if (Number.isNaN(Date.parse(createdAt))) throw new TypeError('createdAt must be ISO timestamp');
  return Object.freeze({
    snapshotId: required(input.snapshotId, 'snapshotId'),
    version,
    sourceRevision: required(input.sourceRevision, 'sourceRevision'),
    commitSha: optional(input.commitSha),
    environment: required(input.environment, 'environment'),
    validationStatus,
    materialHash: required(input.materialHash, 'materialHash'),
    facts: Object.freeze([...(input.facts ?? [])].map(createSelfKnowledgeFact)),
    conflicts: Object.freeze([...(input.conflicts ?? [])].map((item) => Object.freeze(clone(item)))),
    metadata: Object.freeze(clone(input.metadata ?? {})),
    createdAt
  });
}

export function createInMemorySelfKnowledgeStore({ clock = () => new Date(), idFactory = randomUUID } = {}) {
  if (typeof clock !== 'function' || typeof idFactory !== 'function') throw new TypeError('invalid self knowledge store dependency');
  const snapshots = [];
  return Object.freeze({
    async getLatest({ environment } = {}) {
      const env = required(environment, 'environment');
      const found = snapshots.filter((item) => item.environment === env).sort((a,b) => b.version - a.version)[0] ?? null;
      return found ? createSelfKnowledgeSnapshot(found) : null;
    },
    async save(draft = {}) {
      const env = required(draft.environment, 'environment');
      const latest = snapshots.filter((item) => item.environment === env).sort((a,b) => b.version - a.version)[0] ?? null;
      if (latest?.materialHash === draft.materialHash) return Object.freeze({ status: 'duplicate', snapshot: createSelfKnowledgeSnapshot(latest) });
      const snapshot = createSelfKnowledgeSnapshot({ ...draft, snapshotId: `self-knowledge:${idFactory()}`, version: (latest?.version ?? 0) + 1, createdAt: clock().toISOString() });
      snapshots.push(snapshot);
      return Object.freeze({ status: 'written', snapshot });
    },
    async list({ environment } = {}) {
      const env = required(environment, 'environment');
      return Object.freeze(snapshots.filter((item) => item.environment === env).sort((a,b) => a.version - b.version).map(createSelfKnowledgeSnapshot));
    }
  });
}

export function createSelfKnowledgeConsistencyChecker() {
  return Object.freeze({
    check({ facts = [], currentRevision } = {}) {
      const revision = required(currentRevision, 'currentRevision');
      const normalized = facts.map(createSelfKnowledgeFact);
      const groups = new Map();
      for (const fact of normalized) {
        const key = factKey(fact);
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(fact);
      }
      const resolved = [];
      const conflicts = [];
      for (const [claimKey, group] of [...groups.entries()].sort(([a],[b]) => a.localeCompare(b))) {
        const stale = group.filter((fact) => fact.provenance.sourceRevision !== revision);
        const authorities = group.filter((fact) => fact.kind === 'authority');
        const declarations = group.filter((fact) => fact.kind === 'declaration');
        const evidence = group.filter((fact) => fact.kind === 'evidence');
        let chosen = authorities[0] ?? evidence[0] ?? declarations[0];
        let conflictCode = null;
        if (stale.length) conflictCode = 'stale-revision';
        else if (authorities.length > 1 && new Set(authorities.map((fact) => `${fact.status}:${stable(fact.value)}`)).size > 1) conflictCode = 'conflicting-authority';
        else if (declarations.length && evidence.length && declarations.some((decl) => evidence.some((ev) => decl.status !== ev.status))) conflictCode = declarations.some((decl) => decl.status === 'planned') ? 'implemented-subsystem-still-planned' : 'documentation-runtime-status-mismatch';
        else if (declarations.some((decl) => decl.status === 'implemented') && evidence.length === 0) conflictCode = 'completed-roadmap-missing-implementation-evidence';
        else if (evidence.length > 1 && new Set(evidence.map((fact) => `${fact.status}:${stable(fact.value)}`)).size > 1) conflictCode = 'conflicting-runtime-evidence';

        if (conflictCode) {
          conflicts.push(Object.freeze({ code: conflictCode, claimKey, factIds: Object.freeze(group.map((fact) => fact.factId).sort()) }));
          chosen = createSelfKnowledgeFact({ ...chosen, factId: `resolved:${claimKey}`, kind: chosen.kind === 'authority' ? 'authority' : 'evidence', status: 'unknown', confidence: 0, provenance: { ...chosen.provenance, evidenceIds: group.map((fact) => fact.factId) } });
        } else {
          const best = authorities[0] ?? evidence[0] ?? declarations[0];
          chosen = createSelfKnowledgeFact({ ...best, factId: `resolved:${claimKey}`, provenance: { ...best.provenance, evidenceIds: group.map((fact) => fact.factId) } });
        }
        resolved.push(chosen);
      }
      resolved.sort((a,b) => priority(a.category) - priority(b.category) || a.category.localeCompare(b.category) || a.key.localeCompare(b.key));
      return Object.freeze({ facts: Object.freeze(resolved), conflicts: Object.freeze(conflicts), validationStatus: conflicts.length ? 'conflicted' : 'valid' });
    }
  });
}

export function createSelfKnowledgeBuilder({ store, sources = [], consistencyChecker = createSelfKnowledgeConsistencyChecker(), clock = () => new Date(), audit = () => {} } = {}) {
  if (!store?.getLatest || !store?.save) throw new TypeError('self knowledge store with getLatest/save is required');
  if (!Array.isArray(sources) || sources.some((source) => !source?.collect)) throw new TypeError('self knowledge sources must implement collect()');
  if (!consistencyChecker?.check || typeof clock !== 'function' || typeof audit !== 'function') throw new TypeError('invalid self knowledge builder dependency');
  return Object.freeze({
    async rebuild({ sourceRevision, commitSha = null, environment, reason = 'manual', metadata = {} } = {}) {
      const revision = required(sourceRevision, 'sourceRevision');
      const env = required(environment, 'environment');
      const collected = [];
      const sourceDiagnostics = [];
      for (const source of sources) {
        try {
          const result = await source.collect({ sourceRevision: revision, commitSha, environment: env });
          const sourceFacts = [...(result?.facts ?? [])].map(createSelfKnowledgeFact);
          collected.push(...sourceFacts);
          sourceDiagnostics.push(Object.freeze({ sourceId: source.id ?? 'source', factCount: sourceFacts.length, ok: true }));
        } catch (error) {
          sourceDiagnostics.push(Object.freeze({ sourceId: source.id ?? 'source', factCount: 0, ok: false, error: String(error?.code ?? error?.message ?? 'source-failed').slice(0,160) }));
        }
      }
      const checked = consistencyChecker.check({ facts: collected, currentRevision: revision });
      const sourceFailureConflicts = sourceDiagnostics.filter((item) => !item.ok).map((item) => Object.freeze({ code: 'self-knowledge-source-failed', sourceId: item.sourceId }));
      const conflicts = Object.freeze([...checked.conflicts, ...sourceFailureConflicts]);
      const validationStatus = conflicts.length ? 'conflicted' : checked.validationStatus;
      const materialHash = hash({ sourceRevision: revision, commitSha: optional(commitSha), environment: env, facts: checked.facts, conflicts, metadata });
      const result = await store.save({ sourceRevision: revision, commitSha: optional(commitSha), environment: env, validationStatus, materialHash, facts: checked.facts, conflicts, metadata: { ...clone(metadata), sourceDiagnostics } });
      await Promise.resolve(audit(Object.freeze({ eventClass: 'self_knowledge_rebuild', reason, sourceRevision: revision, previousVersion: result.status === 'duplicate' ? result.snapshot.version : Math.max(0, result.snapshot.version - 1), newVersion: result.snapshot.version, changed: result.status === 'written', validationStatus, conflictCount: conflicts.length, materialHash })));
      return Object.freeze({ ...result, validationStatus, conflicts });
    }
  });
}

export function createSelfKnowledgeService({ store } = {}) {
  if (!store?.getLatest) throw new TypeError('self knowledge store with getLatest is required');
  return Object.freeze({
    async getSnapshot({ environment } = {}) { return store.getLatest({ environment }); },
    async query({ environment, categories = [], keys = [], maxFacts = 20, includeStatuses = SELF_KNOWLEDGE_STATUSES } = {}) {
      const env = required(environment, 'environment');
      if (!Number.isInteger(maxFacts) || maxFacts < 1 || maxFacts > 100) throw new TypeError('maxFacts must be 1..100');
      const snapshot = await store.getLatest({ environment: env });
      if (!snapshot) return Object.freeze({ facts: Object.freeze([]), snapshot: null, diagnostics: Object.freeze({ returnedCount: 0, truncated: false, validationStatus: 'invalid' }) });
      const categorySet = new Set(categories);
      const keySet = new Set(keys);
      const statusSet = new Set(includeStatuses);
      const candidates = snapshot.facts.filter((fact) => statusSet.has(fact.status) && (categorySet.size === 0 || categorySet.has(fact.category)) && (keySet.size === 0 || keySet.has(fact.key)));
      const selected = candidates.slice(0, maxFacts);
      return Object.freeze({ facts: Object.freeze(selected), snapshot, diagnostics: Object.freeze({ returnedCount: selected.length, truncated: candidates.length > selected.length, validationStatus: snapshot.validationStatus, conflictCount: snapshot.conflicts.length }) });
    }
  });
}
