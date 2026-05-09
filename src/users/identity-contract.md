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

V1 is a skeleton contract only.

It does not create a database table yet.

It does not implement full user registry persistence yet.

It does not add roles/plans expansion.

It does not connect observation events to memory.

## Known IDs

The Monarch has a stable internal identity:

```text
globalUserId = monarch:garya
role = monarch
```

Other users currently receive temporary pending identities until the persistent registry is implemented:

```text
pending:<provider>:<providerUserId>
```

This pending identity is not the final durable identity model.

## Future durable users

Future automatic user creation must create durable internal user IDs:

```text
usr_<stable_generated_id>
```

Then provider links must map provider accounts to this durable identity:

```text
telegram:<telegram_user_id> -> usr_<stable_generated_id>
web:<web_user_id> -> usr_<stable_generated_id>
api:<api_subject> -> usr_<stable_generated_id>
```

## Future tables

Planned skeleton:

```text
users
- global_user_id
- role
- status
- created_at
- updated_at
- metadata
```

```text
user_identities
- provider
- provider_user_id
- global_user_id
- created_at
- updated_at
- metadata
```

## Boundaries

Allowed in this stage:

- define global identity helpers;
- keep Telegram IDs outside the permanent identity root;
- keep Monarch identity stable;
- expose pending IDs as explicit temporary placeholders.

Forbidden in this stage:

- treating Telegram ID as permanent SG user ID;
- writing user memory;
- writing project memory;
- expanding roles/plans without the permissions skeleton;
- changing transport behavior;
- changing database schema without an approved DB/migration step.

## Observation relationship

Observation events must reference users by internal identity.

Preferred event actor:

```text
actor.user_ref = globalUserId
```

Provider IDs must not be stored raw in observation reports.

Until durable user registry exists, observation for non-Monarch users must be skipped or marked pending according to a future policy.

V1 observation starts with Monarch only.

## Project memory relationship

Observation journal is not project memory.

Correct future flow:

```text
sanitized observation -> journal/report -> memory candidate -> policy approval -> project memory
```

No automatic memory write is allowed from identity or observation skeletons.
