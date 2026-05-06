# GitHubActionsAgent

Simple SG agent for GitHub Actions diagnostics.

Responsibility:
- workflow runs;
- jobs;
- steps;
- artifacts;
- PR/check status summaries.

Rules:
- no Render logs/deploys/env logic here;
- no Telegram flow here;
- no DB or AI calls here;
- no GitHub writes or merges here;
- read-only diagnostics first;
- merge decisions must always wait for Monarch approval.

Current status:
- skeleton only;
- no runtime connection;
- no GitHub API calls inside this agent yet.
