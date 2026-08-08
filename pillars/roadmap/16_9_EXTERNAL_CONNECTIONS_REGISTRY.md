# Block 16.9 — External Connections Registry

## Status
Planned.

## Goal
Create one authoritative registry of external services connected to SG and the capabilities, owners, permissions and health state associated with each connection.

## Required scope
- stable connection_id;
- provider/service type;
- owning global_user_id and project scope where applicable;
- external account identity metadata;
- credential reference from Block 16.8;
- granted scopes/permissions;
- available capabilities;
- connection status, health and last successful verification;
- connect/reconnect/revoke lifecycle;
- provenance and audit events;
- discovery APIs for Decision/Capability layers.

## Boundaries
- a connection is not a user identity;
- a connection does not imply ownership of every external resource;
- raw credentials are not stored in the registry;
- transport adapters may expose platform facts but do not become the registry;
- all state-changing connection operations remain gated and audited.

## Acceptance criteria
- SG can answer which services are connected and under whose authority without exposing secrets;
- connection permissions are explicit and bounded;
- unavailable/revoked connections cannot silently execute capabilities;
- multiple accounts for one provider remain distinguishable;
- connection state survives restart and is scope-isolated.
