// AGENT NOTE:
// CLI runner for RepoCommitWatcherAgent.
// Intended for GitHub Actions and manual diagnostics.

import { runRepoCommitWatcherAgent } from "./repoCommitWatcherAgent.js";

try {
  const result = await runRepoCommitWatcherAgent();
  console.log(JSON.stringify(result, null, 2));
  process.exit(result?.ok ? 0 : 1);
} catch (error) {
  console.error(error?.stack || error?.message || String(error));
  process.exit(1);
}
