function required(value, name) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${name} is required`);
  return value.trim();
}
function normalizeProject(value) { return required(value, 'projectKey').toLowerCase(); }
function normalizeRepository(value) { return required(value, 'repository').toLowerCase(); }
function leaseMs(value) {
  const number = Number(value ?? 60000);
  if (!Number.isInteger(number) || number < 5000 || number > 3600000) throw new TypeError('leaseMs must be between 5000 and 3600000');
  return number;
}

export function createPostgresDevelopmentKnowledgeSingleFlight(database, { defaultLeaseMs = 60000 } = {}) {
  if (!database?.query) throw new TypeError('started PostgreSQL database is required');
  const fallbackLeaseMs = leaseMs(defaultLeaseMs);

  async function acquire({ projectKey, repository, ownerId, leaseDurationMs = fallbackLeaseMs } = {}) {
    const project = normalizeProject(projectKey);
    const repo = normalizeRepository(repository);
    const owner = required(ownerId, 'ownerId');
    const duration = leaseMs(leaseDurationMs);
    const result = await database.query(`INSERT INTO pdk4_runtime_leases(project_key,repository,owner_id,lease_until)
      VALUES ($1,$2,$3,now()+($4::text || ' milliseconds')::interval)
      ON CONFLICT(project_key,repository) DO UPDATE SET
        owner_id=EXCLUDED.owner_id,
        lease_until=EXCLUDED.lease_until,
        updated_at=now()
      WHERE pdk4_runtime_leases.lease_until <= now() OR pdk4_runtime_leases.owner_id=EXCLUDED.owner_id
      RETURNING project_key,repository,owner_id,lease_until`, [project, repo, owner, String(duration)]);
    if (result.rowCount === 0) return Object.freeze({ acquired: false, projectKey: project, repository: repo, ownerId: owner });
    const row = result.rows[0];
    return Object.freeze({ acquired: true, projectKey: row.project_key, repository: row.repository, ownerId: row.owner_id, leaseUntil: row.lease_until?.toISOString?.() ?? row.lease_until });
  }

  async function renew({ projectKey, repository, ownerId, leaseDurationMs = fallbackLeaseMs } = {}) {
    const project = normalizeProject(projectKey), repo = normalizeRepository(repository), owner = required(ownerId, 'ownerId'), duration = leaseMs(leaseDurationMs);
    const result = await database.query(`UPDATE pdk4_runtime_leases SET lease_until=now()+($4::text || ' milliseconds')::interval,updated_at=now()
      WHERE project_key=$1 AND repository=$2 AND owner_id=$3 AND lease_until>now()
      RETURNING lease_until`, [project, repo, owner, String(duration)]);
    return Object.freeze({ renewed: result.rowCount === 1, leaseUntil: result.rows[0]?.lease_until?.toISOString?.() ?? result.rows[0]?.lease_until ?? null });
  }

  async function release({ projectKey, repository, ownerId } = {}) {
    const result = await database.query('DELETE FROM pdk4_runtime_leases WHERE project_key=$1 AND repository=$2 AND owner_id=$3', [normalizeProject(projectKey), normalizeRepository(repository), required(ownerId, 'ownerId')]);
    return Object.freeze({ released: result.rowCount === 1 });
  }

  async function inspect({ projectKey, repository } = {}) {
    const result = await database.query('SELECT project_key,repository,owner_id,lease_until,created_at,updated_at FROM pdk4_runtime_leases WHERE project_key=$1 AND repository=$2', [normalizeProject(projectKey), normalizeRepository(repository)]);
    if (result.rowCount === 0) return null;
    const row = result.rows[0];
    return Object.freeze({ projectKey: row.project_key, repository: row.repository, ownerId: row.owner_id, leaseUntil: row.lease_until?.toISOString?.() ?? row.lease_until, active: new Date(row.lease_until).getTime() > Date.now() });
  }

  return Object.freeze({ acquire, renew, release, inspect });
}
