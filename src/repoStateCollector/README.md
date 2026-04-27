# Repo State Collector

Read-only project state collector for SG / Советник GARYA.

## Purpose

This module is responsible only for collecting the current state and structure of the repository.

It helps agents understand:

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
- read all repository file paths;
- read bounded text file contents when required;
- calculate file metadata such as size, extension and sha;
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

## Current V1 files

- `RepoStateCollectorService.js` — orchestration entry point. Implemented: read tree, scan modules, scan dependencies, return snapshot.
- `RepoTreeReader.js` — implemented: reads full repository structure and bounded text content. Files are never hidden from the repo map.
- `RepoModuleScanner.js` — implemented: groups files into logical modules.
- `RepoDependencyScanner.js` — implemented: detects static dependencies from loaded file content.
- `RepoStateRepository.js` — skeleton persistence boundary. PostgreSQL persistence is not implemented yet.
- `RepoStateConfig.js` — implemented base config and safe limits.

## Current status

Repo State Collector V1 core is partially implemented.

Implemented:

- full file tree visibility;
- module grouping;
- static dependency scan from loaded content;
- unified collector snapshot.

Not implemented yet:

- PostgreSQL persistence;
- runtime command;
- cron/background scan;
- AI summarizer;
- Project Memory bridge.
