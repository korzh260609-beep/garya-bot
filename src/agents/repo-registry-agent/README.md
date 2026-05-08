# RepoRegistryAgent

Simple SG agent for repository registry.

Purpose:
- collect a deterministic registry of repository folders and files;
- add simple descriptions by path/type rules;
- write one latest JSON report into `runtime/repo/latest/latest-repo-registry.json`.

Rules:
- no AI calls;
- no code edits;
- no file deletes;
- no repo structure changes;
- no GitHub writes except the single workspace report file;
- no deploys;
- no Telegram flow here.

Current mode:
- simple collector;
- GitHub tree -> deterministic descriptions -> one JSON report.
