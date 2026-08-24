# SG 2.1 — PostgreSQL Persistence

## Authority

This document is subordinate to `pillars/DECISIONS.md`. Persistence replaces temporary state providers without moving semantics, identity decisions, authorization or Action Gate policy into the database.

## Boundary

`src/persistence/database.js` owns the PostgreSQL pool, connectivity check, transaction boundary and shutdown. `src/persistence/migrator.js` owns ordered migrations and checksum validation. `src/persistence/repositories.js` owns parameterized persistence operations. `src/persistence/postgresMemoryProvider.js` adapts durable memory to the existing Memory Provider contract.

The runtime starts PostgreSQL and applies migrations before readiness. If PostgreSQL is mandatory and unavailable, startup fails before `phase=ready`.

## Data ownership

- `users`, `identity_links`, `roles`, `grants` — identity and access persistence;
- `conversations`, `messages` — scoped dialogue persistence;
- `memory_records` — memory value, provenance, trust, confirmation, tags and expiry;
- `tasks`, `schedules`, `execution_states` — automation state;
- `idempotency_records` — duplicate protected-action prevention;
- `observability_events` — separated audit, telemetry, debug and error evidence;
- `domain_records` — domain-namespaced data that cannot redefine core contracts.

Every user-owned record carries `global_user_id` and `project_scope`; group/thread-owned records additionally carry `group_scope` and `thread_scope`. A thread cannot exist without a group.

## Transactions

Protected multi-record changes use one PostgreSQL transaction. The transaction commits only after all repository operations succeed. Any thrown error triggers rollback, preventing partial users, tasks, idempotency or audit state.

## Identity safety

`(platform, platform_user_id)` is unique. An existing platform identity may update metadata only when it remains linked to the same `global_user_id`; reassignment to another global identity fails closed.

## Migrations

Migration files are ordered by numeric filename. Applied versions and SHA-256 checksums are stored in `schema_migrations`. Re-running an unchanged migration is a no-op. Editing an already applied migration causes a checksum failure; schema changes require a new migration.

## Sensitive data

Queries are parameterized. Observability payloads recursively redact credential-like keys before persistence. Database URLs and credentials are deployment secrets and must not be committed or emitted in ordinary logs.

## Backup and restore procedure

Create a compressed logical backup:

```bash
pg_dump --format=custom --no-owner --no-acl "$DATABASE_URL" --file sg-backup.dump
```

Verify that the archive is readable:

```bash
pg_restore --list sg-backup.dump > sg-backup.contents
```

Restore into a new empty database, never directly over an unverified production database:

```bash
createdb "$RESTORE_DATABASE"
pg_restore --clean --if-exists --no-owner --no-acl --dbname "$RESTORE_DATABASE" sg-backup.dump
DATABASE_URL="$RESTORE_DATABASE_URL" npm run migrate
```

After restore, run the persistence integration test and a runtime readiness check before switching traffic. Backup files contain private data and must use restricted encrypted storage with a defined retention policy.
