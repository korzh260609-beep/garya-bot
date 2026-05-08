# Repo Commit Watcher Agent

RepoCommitWatcherAgent is a bounded SG agent for repository commit observation.

Purpose:
- detect the latest commit on the current SG project branch;
- store only the latest commit state, not full commit history;
- trigger RepoRegistryAgent when a new repository commit is detected;
- search GitHub commit history by user intent using commit messages, changed file paths, and patch text.

Rules:
- this agent is not a separate SG entity;
- this agent lives only under `src/agents/repo-commit-watcher-agent/`;
- this agent must not edit source code directly;
- this agent must not store full commit history in the repository;
- GitHub remains the source of truth for commit history;
- runtime state is limited to `runtime/repo/latest/latest-commit-state.json`;
- registry updates are delegated to `repo-registry-agent`.

Runtime flow:
1. GitHub Actions starts this agent after a push to `dev/v2-start`.
2. The agent reads the current branch HEAD SHA.
3. The agent reads the last seen SHA from runtime state.
4. If the SHA is new, the agent runs RepoRegistryAgent.
5. The agent writes the latest commit state.

Search flow:
- SG can ask the agent to search commits by intent.
- The agent reads recent commits from GitHub.
- For likely matches, the agent reads commit details and patch text.
- The agent returns commits ranked by message, changed files, and patch content.
