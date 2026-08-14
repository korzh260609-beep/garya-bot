function clone(value) { return value == null ? value : structuredClone(value); }

export function createPostgresContractQuarantineStore(database) {
  if (!database?.query) throw new TypeError('database.query is required');

  return Object.freeze({
    async quarantine(record) {
      const result = await database.query(`
        INSERT INTO contract_quarantine(
          quarantine_id, contract_name, version, reason, source, trace_context, record,
          status, quarantined_at
        ) VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8,$9)
        ON CONFLICT(quarantine_id) DO UPDATE SET
          contract_name=EXCLUDED.contract_name,
          version=EXCLUDED.version,
          reason=EXCLUDED.reason,
          source=EXCLUDED.source,
          trace_context=EXCLUDED.trace_context,
          record=EXCLUDED.record,
          status=EXCLUDED.status,
          quarantined_at=EXCLUDED.quarantined_at
        RETURNING *`, [
        record.quarantineId,
        record.contractName,
        record.version,
        record.reason,
        record.source ?? null,
        JSON.stringify(record.traceContext ?? null),
        JSON.stringify(record.record ?? {}),
        record.status ?? 'quarantined',
        record.quarantinedAt
      ]);
      return normalize(result.rows[0]);
    },

    async get(quarantineId) {
      const result = await database.query('SELECT * FROM contract_quarantine WHERE quarantine_id=$1', [quarantineId]);
      return result.rowCount ? normalize(result.rows[0]) : null;
    },

    async list({ status = null, contractName = null, limit = 100 } = {}) {
      const boundedLimit = Math.max(1, Math.min(500, Number(limit) || 100));
      const result = await database.query(`
        SELECT * FROM contract_quarantine
        WHERE ($1::text IS NULL OR status=$1)
          AND ($2::text IS NULL OR contract_name=$2)
        ORDER BY quarantined_at DESC
        LIMIT $3`, [status, contractName, boundedLimit]);
      return result.rows.map(normalize);
    }
  });
}

function normalize(row) {
  return Object.freeze({
    quarantineId: row.quarantine_id,
    contractName: row.contract_name,
    version: row.version,
    reason: row.reason,
    source: row.source,
    traceContext: clone(row.trace_context),
    record: clone(row.record),
    status: row.status,
    quarantinedAt: new Date(row.quarantined_at).toISOString(),
    resolvedAt: row.resolved_at ? new Date(row.resolved_at).toISOString() : null,
    resolutionNote: row.resolution_note ?? null
  });
}
