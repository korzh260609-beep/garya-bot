# Block 12 — PostgreSQL Persistence

## Scope

Replace temporary production state with PostgreSQL-backed boundaries while preserving the approved Semantic Kernel, Identity, Action Gate, Capability, Memory and Observability contracts.

## Implementation slice

- `src/persistence/database.js` — pool, connectivity, transactions and shutdown;
- `src/persistence/migrator.js` and `src/persistence/migrations/` — ordered checksum-validated migrations;
- `src/persistence/repositories.js` — users, identity links, roles, grants, conversations, messages, memory, tasks, schedules, execution state, idempotency, observability and domain repositories;
- `src/persistence/postgresMemoryProvider.js` — durable adapter for the existing memory contract;
- `src/persistence/migrate.js` — migration CLI;
- `tests/postgresPersistence.test.js` — real PostgreSQL integration evidence;
- `.github/workflows/ci.yml` — PostgreSQL 16 service and mandatory persistence verification;
- `pillars/architecture/POSTGRESQL_PERSISTENCE.md` — architecture, safety and backup/restore procedure.

## Safety properties

- platform identities cannot be silently reassigned to another `globalUserId`;
- reads and writes are bound to user, project, group and thread scope;
- thread scope requires group scope;
- protected multi-record changes roll back atomically;
- idempotency keys cannot be reserved twice;
- observability payloads redact credential-like fields before storage;
- domain records remain namespaced and cannot alter platform contracts;
- startup does not become ready when mandatory PostgreSQL is unavailable.

## Acceptance evidence

Completion is derived from code and runtime evidence:

- migrations apply safely to an empty PostgreSQL database and are repeatable;
- data remains available after closing and recreating the persistence runtime;
- cross-user scope reads return no records;
- identity-link collision fails closed;
- forced transaction failure leaves no partial user or task rows;
- users, access, conversations, messages, memory, automation, idempotency, observability and domain data are exercised against real PostgreSQL;
- `npm ci`, `npm run migrate`, `npm run check` and `npm start` must pass in GitHub Actions with PostgreSQL 16.

## Exclusions

Block 12 does not introduce worker claiming, leases, retry scheduling or DLQ processing. Those remain Block 13. It does not connect the real Telegram Bot API, production AI providers, Render deployment or pilot users.
