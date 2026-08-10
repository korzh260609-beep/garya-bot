const TRUST_WEIGHT = Object.freeze({ unverified: 0, reported: 0.35, confirmed: 0.75, verified: 1 });
const DEFAULT_LIMIT = 12;
const MAX_LIMIT = 50;
const MAX_CANDIDATES = 250;
const MAX_RELATION_EXPANSION = 20;

function required(value, name) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${name} is required`);
  return value.trim();
}
function strings(values, name) {
  if (values == null) return [];
  if (!Array.isArray(values)) throw new TypeError(`${name} must be an array`);
  return [...new Set(values.map((value) => required(String(value), name)))];
}
function bounded(value, fallback, max) {
  const number = Number(value ?? fallback);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(0, Math.min(Math.trunc(number), max));
}
function normalizeText(value) {
  return String(value ?? '').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}
function tokenize(value) {
  return [...new Set(normalizeText(value).split(/\s+/u).filter((token) => token.length > 1))];
}
function clamp01(value) { return Math.max(0, Math.min(1, Number(value) || 0)); }
function vector(input, name = 'embedding') {
  if (!Array.isArray(input) || input.length === 0 || input.length > 4096) throw new TypeError(`${name} must contain 1..4096 dimensions`);
  const output = input.map((value) => Number(value));
  if (output.some((value) => !Number.isFinite(value))) throw new TypeError(`${name} must contain only finite numbers`);
  return output;
}
function vectorLiteral(values) { return `[${values.join(',')}]`; }
function cosineSimilarity(a, b) {
  if (a.length !== b.length) return 0;
  let dot = 0; let aa = 0; let bb = 0;
  for (let index = 0; index < a.length; index += 1) {
    dot += a[index] * b[index]; aa += a[index] * a[index]; bb += b[index] * b[index];
  }
  if (aa === 0 || bb === 0) return 0;
  return clamp01((dot / (Math.sqrt(aa) * Math.sqrt(bb)) + 1) / 2);
}
function lexicalScore(record, query) {
  const tokens = tokenize(query);
  if (tokens.length === 0) return 0;
  const haystack = normalizeText([record.entityKey, record.factType, record.namespace, JSON.stringify(record.fact), ...(record.tags ?? [])].join(' '));
  let hits = 0;
  for (const token of tokens) if (haystack.includes(token)) hits += 1;
  return hits / tokens.length;
}
function exactScore(record, query) {
  const needle = normalizeText(query);
  if (!needle) return 0;
  if (normalizeText(record.entityKey) === needle) return 1;
  if (normalizeText(record.fact?.status) === needle) return 0.9;
  if (normalizeText(record.factType) === needle) return 0.8;
  return 0;
}
function freshnessScore(record, nowMs) {
  const timestamp = Date.parse(record.validFrom ?? record.updatedAt ?? record.createdAt ?? 0);
  if (!Number.isFinite(timestamp) || timestamp <= 0) return 0;
  const ageDays = Math.max(0, (nowMs - timestamp) / 86400000);
  return 1 / (1 + ageDays / 30);
}
function scopeSpecificity(record, filters) {
  let score = 0;
  if (filters.entityKey && record.entityKey === filters.entityKey) score += 0.5;
  if (filters.namespaces.length === 1 && record.namespace === filters.namespaces[0]) score += 0.3;
  if (filters.factTypes.length === 1 && record.factType === filters.factTypes[0]) score += 0.2;
  return clamp01(score);
}
function retrievalError(code, message) { const error = new Error(message); error.code = code; return error; }
function allowedByFilters(record, filters) {
  if (!record || record.projectKey !== filters.projectKey) return false;
  if (filters.namespaces.length && !filters.namespaces.includes(record.namespace)) return false;
  if (filters.entityKey && record.entityKey !== filters.entityKey) return false;
  if (filters.factTypes.length && !filters.factTypes.includes(record.factType)) return false;
  if (filters.lifecycleStates.length && !filters.lifecycleStates.includes(record.lifecycleState)) return false;
  if (filters.statuses.length && !filters.statuses.includes(String(record.fact?.status ?? ''))) return false;
  if (filters.at) {
    const at = Date.parse(filters.at); const from = Date.parse(record.validFrom); const to = record.validTo ? Date.parse(record.validTo) : Infinity;
    if (!(from <= at && at < to)) return false;
  } else if (!filters.includeHistorical && (record.validTo || record.successorMemoryId)) return false;
  return true;
}

export const PROJECT_MEMORY3_RETRIEVAL_CONTRACT_VERSION = 1;

export function createProjectMemoryHybridRetrieval({ database, store, authorize, clock = () => new Date() } = {}) {
  if (!database?.query) throw new TypeError('started PostgreSQL database is required');
  if (!store?.get) throw new TypeError('project memory store is required');
  if (typeof authorize !== 'function') throw new TypeError('authorize callback is required');

  async function assertAuthorized({ actor, projectKey, operation }) {
    const allowed = await authorize({ actor, projectKey, operation });
    if (allowed !== true) throw retrievalError('project-memory-retrieval-unauthorized', `Project Memory ${operation} denied for ${projectKey}`);
  }

  async function pgvectorCapability() {
    const result = await database.query(`SELECT
      EXISTS (SELECT 1 FROM pg_extension WHERE extname='vector') AS extension_enabled,
      EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema=current_schema() AND table_name='project_memory_embeddings' AND column_name='embedding_vector'
      ) AS vector_column`);
    const row = result.rows[0] ?? {};
    return Object.freeze({ enabled: row.extension_enabled === true && row.vector_column === true });
  }

  async function upsertEmbedding({ actor, projectKey, memoryId, modelKey, embedding }) {
    const project = required(projectKey, 'projectKey').toLowerCase();
    const id = required(memoryId, 'memoryId');
    const model = required(modelKey, 'modelKey');
    const values = vector(embedding);
    await assertAuthorized({ actor, projectKey: project, operation: 'embedding-write' });
    const record = await store.get(id, { projectKey: project });
    if (!record) throw retrievalError('project-memory-embedding-scope-denied', 'embedding target is outside project scope or missing');
    await database.query(`INSERT INTO project_memory_embeddings(memory_id,project_key,model_key,dimensions,embedding,updated_at)
      VALUES ($1,$2,$3,$4,$5::double precision[],now())
      ON CONFLICT(memory_id) DO UPDATE SET project_key=EXCLUDED.project_key,model_key=EXCLUDED.model_key,dimensions=EXCLUDED.dimensions,embedding=EXCLUDED.embedding,updated_at=now()`,
    [id, project, model, values.length, values]);
    const capability = await pgvectorCapability();
    if (capability.enabled) {
      await database.query('UPDATE project_memory_embeddings SET embedding_vector=$1::vector WHERE memory_id=$2 AND project_key=$3', [vectorLiteral(values), id, project]);
    }
    return Object.freeze({ memoryId: id, projectKey: project, modelKey: model, dimensions: values.length, pgvector: capability.enabled });
  }

  async function semanticScores({ projectKey, modelKey, queryEmbedding, candidateIds }) {
    if (!queryEmbedding || candidateIds.length === 0) return { scores: new Map(), mode: 'none' };
    const queryVector = vector(queryEmbedding, 'queryEmbedding');
    const model = required(modelKey, 'modelKey');
    const capability = await pgvectorCapability();
    if (capability.enabled) {
      const result = await database.query(`SELECT memory_id,(embedding_vector <=> $1::vector) AS distance
        FROM project_memory_embeddings
        WHERE project_key=$2 AND model_key=$3 AND dimensions=$4 AND memory_id=ANY($5::text[]) AND embedding_vector IS NOT NULL
        ORDER BY embedding_vector <=> $1::vector
        LIMIT $6`, [vectorLiteral(queryVector), projectKey, model, queryVector.length, candidateIds, MAX_CANDIDATES]);
      return { scores: new Map(result.rows.map((row) => [row.memory_id, clamp01(1 - Number(row.distance))])), mode: 'pgvector' };
    }
    const result = await database.query(`SELECT memory_id,embedding FROM project_memory_embeddings
      WHERE project_key=$1 AND model_key=$2 AND dimensions=$3 AND memory_id=ANY($4::text[])`, [projectKey, model, queryVector.length, candidateIds]);
    return { scores: new Map(result.rows.map((row) => [row.memory_id, cosineSimilarity(queryVector, row.embedding.map(Number))])), mode: 'postgres-array-fallback' };
  }

  async function metadataCandidates(filters, maxCandidates) {
    const result = await database.query(`SELECT e.memory_id
      FROM project_memory_entries e JOIN memory_records m USING(memory_id)
      WHERE e.project_key=$1
        AND ($2::text[]='{}'::text[] OR e.namespace=ANY($2::text[]))
        AND ($3::text IS NULL OR e.entity_key=$3)
        AND ($4::text[]='{}'::text[] OR e.fact_type=ANY($4::text[]))
        AND ($5::text[]='{}'::text[] OR m.lifecycle_state=ANY($5::text[]))
        AND ($6::text[]='{}'::text[] OR e.fact->>'status'=ANY($6::text[]))
        AND (($7::timestamptz IS NOT NULL AND e.valid_from <= $7::timestamptz AND (e.valid_to IS NULL OR e.valid_to > $7::timestamptz))
          OR ($7::timestamptz IS NULL AND ($8::boolean OR (e.valid_to IS NULL AND e.successor_memory_id IS NULL))))
      ORDER BY e.updated_at DESC,e.memory_id
      LIMIT $9`, [filters.projectKey, filters.namespaces, filters.entityKey, filters.factTypes, filters.lifecycleStates, filters.statuses, filters.at, filters.includeHistorical, maxCandidates]);
    const records = [];
    for (const row of result.rows) {
      const record = await store.get(row.memory_id, { projectKey: filters.projectKey });
      if (record && allowedByFilters(record, filters)) records.push(record);
    }
    return records;
  }

  async function relationExpansion(primary, filters, relationLimit) {
    if (relationLimit <= 0 || primary.length === 0) return [];
    const sourceIds = primary.map((item) => item.record.memoryId);
    const relations = await database.query(`SELECT source_memory_id,relation_key FROM project_memory_relations
      WHERE project_key=$1 AND source_memory_id=ANY($2::text[]) ORDER BY created_at,relation_id LIMIT $3`, [filters.projectKey, sourceIds, relationLimit]);
    const keys = [...new Set(relations.rows.map((row) => row.relation_key).filter(Boolean))];
    if (keys.length === 0) return [];
    const targets = await database.query(`SELECT memory_id FROM project_memory_entries
      WHERE project_key=$1 AND (memory_id=ANY($2::text[]) OR entity_key=ANY($2::text[])) LIMIT $3`, [filters.projectKey, keys, relationLimit]);
    const parentScore = new Map(primary.map((item) => [item.record.memoryId, item.score]));
    const sourceByKey = new Map(relations.rows.map((row) => [row.relation_key, row.source_memory_id]));
    const expanded = [];
    for (const row of targets.rows) {
      if (sourceIds.includes(row.memory_id)) continue;
      const record = await store.get(row.memory_id, { projectKey: filters.projectKey });
      if (!allowedByFilters(record, filters)) continue;
      const sourceId = sourceByKey.get(record.memoryId) ?? sourceByKey.get(record.entityKey);
      expanded.push({ record, score: clamp01((parentScore.get(sourceId) ?? 0.25) * 0.55), relationExpanded: true });
    }
    return expanded;
  }

  async function search(input = {}) {
    const projectKey = required(input.projectKey, 'projectKey').toLowerCase();
    await assertAuthorized({ actor: input.actor, projectKey, operation: 'read' });
    const filters = {
      projectKey,
      namespaces: strings(input.namespaces, 'namespaces'),
      entityKey: input.entityKey == null ? null : required(String(input.entityKey), 'entityKey'),
      factTypes: strings(input.factTypes, 'factTypes'),
      lifecycleStates: strings(input.lifecycleStates ?? ['active'], 'lifecycleStates'),
      statuses: strings(input.statuses, 'statuses'),
      at: input.at == null ? null : new Date(input.at).toISOString(),
      includeHistorical: input.includeHistorical === true
    };
    const limit = Math.max(1, bounded(input.limit, DEFAULT_LIMIT, MAX_LIMIT));
    const maxCandidates = Math.max(limit, bounded(input.maxCandidates, Math.max(limit * 8, 40), MAX_CANDIDATES));
    const relationLimit = input.expandRelations === false ? 0 : bounded(input.relationLimit, Math.min(limit, 8), MAX_RELATION_EXPANSION);
    const query = String(input.query ?? '').trim();
    const candidates = await metadataCandidates(filters, maxCandidates);
    const semantic = await semanticScores({ projectKey, modelKey: input.modelKey, queryEmbedding: input.queryEmbedding, candidateIds: candidates.map((record) => record.memoryId) });
    const nowMs = clock().getTime();
    const ranked = candidates.map((record) => {
      const semanticScore = semantic.scores.get(record.memoryId) ?? 0;
      const lexical = lexicalScore(record, query);
      const exact = exactScore(record, query);
      const trust = TRUST_WEIGHT[record.trust] ?? 0;
      const confirmation = record.confirmed ? 1 : 0;
      const freshness = freshnessScore(record, nowMs);
      const specificity = scopeSpecificity(record, filters);
      const score = clamp01(semanticScore * 0.4 + lexical * 0.22 + exact * 0.16 + trust * 0.08 + confirmation * 0.06 + freshness * 0.04 + specificity * 0.04);
      return { record, score, semanticScore, lexicalScore: lexical, exactScore: exact, relationExpanded: false };
    }).sort((a, b) => b.score - a.score || a.record.memoryId.localeCompare(b.record.memoryId));
    const primary = ranked.slice(0, limit);
    const expanded = await relationExpansion(primary, filters, relationLimit);
    const merged = [...primary, ...expanded].sort((a, b) => b.score - a.score || a.record.memoryId.localeCompare(b.record.memoryId)).slice(0, limit);
    return Object.freeze({
      projectKey,
      semanticMode: semantic.mode,
      count: merged.length,
      results: Object.freeze(merged.map((item) => Object.freeze({ ...item })))
    });
  }

  return Object.freeze({ pgvectorCapability, upsertEmbedding, search });
}
