# Repo State Collector

Read-only project state collector for SG / Советник GARYA.

## Purpose

This module is responsible only for collecting the current state of the repository.

It must help agents understand:

- what has already been implemented;
- which modules exist;
- which files belong to each module;
- which dependencies exist between files;
- which project areas changed since the previous scan;
- where architectural risks may exist.

## Hard rules

This module must not change repository files.

Allowed:

- read repository metadata;
- read file paths and file contents when required;
- calculate hashes, line counts, sizes;
- detect imports/exports/requires;
- build an in-memory project map;
- later save collected state to PostgreSQL through an explicit repository layer.

Forbidden:

- create repository files as part of collector runtime;
- update repository files as part of collector runtime;
- delete repository files;
- modify code;
- modify pillars;
- modify AgentWorkspace command files;
- change runtime prompts;
- call AI automatically without an explicit approved AI layer.

## V1 skeleton

Files:

- `RepoStateCollectorService.js` — orchestration entry point.
- `RepoTreeReader.js` — reads repository tree metadata.
- `RepoModuleScanner.js` — groups files into modules.
- `RepoDependencyScanner.js` — detects static dependencies.
- `RepoStateRepository.js` — future PostgreSQL persistence boundary.
- `RepoStateConfig.js` — configuration and limits.

## Current status

Skeleton only. Not connected to runtime, commands, cron, database, or AI.
