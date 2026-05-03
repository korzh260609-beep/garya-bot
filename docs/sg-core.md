# SG Core Skeleton

SG Core is the central modular foundation of SG 2.0.

The core must coordinate modules, not absorb them.

## Core interfaces

1. Core Orchestrator
   - receives normalized user requests;
   - routes them through permissions, memory, sources, AI, tasks, and delivery.

2. Config Layer
   - central project configuration;
   - no scattered magic constants.

3. Permission Layer
   - role and feature checks;
   - future `can(user, feature)` interface.

4. Module Registry
   - modules are registered here;
   - core discovers modules through registry, not hardcoded chaos.

5. Memory Interface
   - single entrypoint for all memory types.

6. Task Interface
   - single entrypoint for scheduled and one-time tasks.

7. Sources Interface
   - single entrypoint for RSS, APIs, web, documents, repo state, and other real sources.

8. AI Interface
   - single entrypoint for model calls;
   - later connects to Model Router and AI Execution Layer.

9. Logging Interface
   - unified logs and diagnostics.

10. Error Handler
   - safe error boundaries;
   - no silent failures.

## Modularity rule

Every new feature must be a module unless Monarch explicitly approves a core change.

## Forbidden

- module logic inside core;
- transport logic inside AI;
- memory logic inside Telegram handler;
- source parsing inside prompt builder;
- permissions scattered across files.
