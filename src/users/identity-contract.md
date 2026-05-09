# SG Users Identity Contract V1

## Purpose

This document defines the SG 2.0 internal identity contract.

The goal is to keep SG user identity independent from any single transport.

Telegram is a provider. Web client, API, and future transports will also be providers.

The internal SG user identity must be based on `globalUserId`, not on Telegram IDs.

## Core rule

```text
provider identity -> identity link -> globalUserId -> role / plan / permissions
```

Provider IDs are external facts.

`globalUserId` is the internal SG identity root.

## Current V1 state

V1 now has a minimal durable registry skeleton.

It can use PostgreSQL through `DATABASE_URL` to create and resolve durable internal user IDs.

It does not add roles/plans expansion.

It does not connect observation events to memory.

It does not write user memory or project memory.

## Known IDs

The Monarch has a stable internal identity:

```text
globalUserId = monarch:garya
role = monarch
```

Other users should receive durable internal identities when the database is configured:

```text
usr_<stable_generated_id>
```

If the database is unavailable or not configured, users temporarily fall back to explicit pending identities:

```text
pending:<provider>:<providerUserId>
```

This pending identity is not the final durable identity model.

## Durable users

Automatic user creation creates durable internal user IDs:

```text
usr_<stable_generated_id>
```

Then provider links map provider accounts to this durable identity:

```text
telegram:<telegram_user_id> -> usr_<stable_generated_id>
web:<web_user_id> -> usr_<stable_generated_id>
api:<api_subject> -> usr_<stable_generated_id>
```

## Tables

Current skeleton:

```text
sg_users
- global_user_id
- role
- status
- created_at
- updated_at
- metadata
```

```text
sg_user_identities
- provider
- provider_user_id
- global_user_id
- created_at
- updated_at
- metadata
```

## Runtime flow

```text
normalized context
-> provider identity
-> users registry lookup
-> existing globalUserId OR create new usr_<uuid>
-> identity object
-> access / behavior / AI
```

If `DATABASE_URL` is missing, the resolver must keep SG running and return a pending identity instead of crashing.

## Boundaries

Allowed in this stage:

- define global identity helpers;
- keep provider IDs outside the permanent identity root;
- keep Monarch identity stable;
- create durable user IDs when database is configured;
- link provider identities to global user IDs;
- fallback safely when database is unavailable.

Forbidden in this stage:

- treating Telegram ID as permanent SG user ID;
- writing user memory;
- writing project memory;
- expanding roles/plans without the permissions skeleton;
- changing transport behavior;
- connecting observation events to memory;
- leaking raw provider IDs into observation reports.

## Observation relationship

Observation events must reference users by internal identity.

Preferred event actor:

```text
actor.user_ref = globalUserId
```

Provider IDs must not be stored raw in observation reports.

V1 observation starts with Monarch only.

Guest/citizen observation still requires a separate policy.

## Project memory relationship

Observation journal is not project memory.

Correct future flow:

```text
sanitized observation -> journal/report -> memory candidate -> policy approval -> project memory
```

No automatic memory write is allowed from identity or observation skeletons.
