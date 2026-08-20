# SG Capability Catalog

## Purpose

The Capability Catalog is SG's canonical self-capability inventory layer. It aggregates capability metadata from runtime capability registration and subsystem manifests; it is not an authority source and it never grants permissions.

## Data flow

`runtime/subsystem registration -> Capability Catalog snapshot -> Self Knowledge -> semantic answer`

The catalog is deliberately not a hand-maintained user-facing list. New runtime capabilities are included through the runtime capability registry snapshot. Subsystems whose behavior is broader than executable runtime capabilities expose a subsystem capability manifest; registering a new manifest or manifest entry does not require changes to catalog aggregation or answer-generation logic.

## Runtime cost model

Catalog assembly is a runtime/deploy snapshot operation. Ordinary questions such as "what can you do?" consume cached Self Knowledge and do not trigger GitHub, Telegram, database, or other external scans. Live probes are reserved for questions about the current state or authorization of a specific external resource.

## Metadata and status

Catalog entries carry a stable id, domain, status, connection/authorization dependency, supported transports, risk tier where available, source of truth and source revision. Supported status values are `implemented`, `partial`, `planned`, and `disabled`.

Self Knowledge receives a compact catalog representation suitable for semantic response generation. User-facing wording is generated semantically; the catalog contains no fixed answer phrase.

## Security boundary

Capability knowledge is not authority. Catalog presence must never bypass Action Gate, resource authority, owner security, confirmation policy, provider permissions, connection scope, or transport policy. Every entry has `grantsAuthority=false` by contract.

## Extension contract

Future executable capabilities should be registered in the runtime capability registry and its exported capability-name snapshot. Future subsystem-level behaviors should export a `createCapabilityManifest`-compatible manifest. Either path makes the capability visible to the catalog without changing catalog aggregation logic.
