import { createSelfKnowledgeSnapshot } from './selfKnowledge.js';

function required(value, name) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${name} is required`);
  return value.trim();
}
function rowFact(row) {
  return {
    factId: row.fact_id,
    category: row.category,
    key: row.fact_key,
    value: row.value,
    status: row.status,
    kind: row.fact_kind,
    confidence: Number(row.confidence),
    provenance: row.provenance
  };
}

export function createPostgresSelfKnowledgeStore({ database } = {}) {
  if (!database?.query || !database?.transaction) throw new TypeError('database is required');

  async function hydrate(snapshotRow) {
    if (!snapshotRow) return null;
    const factsResult = await database.query('SELECT * FROM system_self_knowledge_facts WHERE snapshot_id=$1 ORDER BY category,fact_key,fact_id', [snapshotRow.snapshot_id]);
    return createSelfKnowledgeSnapshot({
      snapshotId: snapshotRow.snapshot_id,
      version: snapshotRow.version,
      sourceRevision: snapshotRow.source_revision,
      commitSha: snapshotRow.commit_sha,
      environment: snapshotRow.environment,
      validationStatus: snapshotRow.validation_status,
      materialHash: snapshotRow.material_hash,
      facts: factsResult.rows.map(rowFact),
      conflicts: snapshotRow.conflicts ?? [],
      metadata: snapshotRow.metadata ?? {},
      createdAt: new Date(snapshotRow.created_at).toISOString()
    });
  }

  return Object.freeze({
    async getLatest({ environment } = {}) {
      const env = required(environment, 'environment');
      const result = await database.query('SELECT * FROM system_self_knowledge_snapshots WHERE environment=$1 ORDER BY version DESC LIMIT 1', [env]);
      return hydrate(result.rows[0]);
    },
    async save(draft = {}) {
      const env = required(draft.environment, 'environment');
      const materialHash = required(draft.materialHash, 'materialHash');
      const existing = await database.query('SELECT * FROM system_self_knowledge_snapshots WHERE environment=$1 AND material_hash=$2 LIMIT 1', [env, materialHash]);
      if (existing.rowCount > 0) return Object.freeze({ status: 'duplicate', snapshot: await hydrate(existing.rows[0]) });

      const created = await database.transaction(async (tx) => {
        await tx.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`sg-self-knowledge:${env}`]);
        const duplicate = await tx.query('SELECT * FROM system_self_knowledge_snapshots WHERE environment=$1 AND material_hash=$2 LIMIT 1', [env, materialHash]);
        if (duplicate.rowCount > 0) return { duplicate: duplicate.rows[0] };
        const latest = await tx.query('SELECT COALESCE(MAX(version),0)::int AS version FROM system_self_knowledge_snapshots WHERE environment=$1', [env]);
        const version = Number(latest.rows[0].version) + 1;
        const snapshotId = `self-knowledge:${env}:${version}`;
        const snapshotResult = await tx.query(`
          INSERT INTO system_self_knowledge_snapshots(
            snapshot_id,version,source_revision,commit_sha,environment,validation_status,material_hash,conflicts,metadata
          ) VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb)
          RETURNING *`, [snapshotId, version, draft.sourceRevision, draft.commitSha, env, draft.validationStatus, materialHash, JSON.stringify(draft.conflicts ?? []), JSON.stringify(draft.metadata ?? {})]);
        for (const fact of draft.facts ?? []) {
          await tx.query(`
            INSERT INTO system_self_knowledge_facts(
              snapshot_id,fact_id,category,fact_key,value,status,fact_kind,confidence,provenance
            ) VALUES($1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9::jsonb)`, [
            snapshotId, fact.factId, fact.category, fact.key, JSON.stringify(fact.value), fact.status, fact.kind, fact.confidence, JSON.stringify(fact.provenance)
          ]);
        }
        return { duplicate: null, row: snapshotResult.rows[0] };
      }, { isolationLevel: 'SERIALIZABLE' });
      if (created.duplicate) return Object.freeze({ status: 'duplicate', snapshot: await hydrate(created.duplicate) });
      return Object.freeze({ status: 'written', snapshot: await hydrate(created.row) });
    },
    async list({ environment } = {}) {
      const env = required(environment, 'environment');
      const result = await database.query('SELECT * FROM system_self_knowledge_snapshots WHERE environment=$1 ORDER BY version', [env]);
      const output = [];
      for (const row of result.rows) output.push(await hydrate(row));
      return Object.freeze(output);
    }
  });
}
