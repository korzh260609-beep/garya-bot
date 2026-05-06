// AGENT NOTE:
// GitHubActionsAgent service skeleton.
// Purpose: define a simple bounded GitHub Actions diagnostics agent contract.
// Do not add Render logic, GitHub writes, merge actions, AI calls, DB calls, or Telegram flow here.

import { buildGitHubActionsAgentStubReport } from "./GitHubActionsAgentReportBuilder.js";

export class GitHubActionsAgentService {
  async run(input = {}) {
    return buildGitHubActionsAgentStubReport({
      action: input?.action || "run",
      input,
    });
  }

  async collectRuns(input = {}) {
    return buildGitHubActionsAgentStubReport({
      action: "collect_runs",
      input,
    });
  }

  async collectRun(input = {}) {
    return buildGitHubActionsAgentStubReport({
      action: "collect_run",
      input,
    });
  }

  async collectJobs(input = {}) {
    return buildGitHubActionsAgentStubReport({
      action: "collect_jobs",
      input,
    });
  }

  async collectArtifacts(input = {}) {
    return buildGitHubActionsAgentStubReport({
      action: "collect_artifacts",
      input,
    });
  }

  async collectPrChecks(input = {}) {
    return buildGitHubActionsAgentStubReport({
      action: "collect_pr_checks",
      input,
    });
  }
}

export const githubActionsAgentService = new GitHubActionsAgentService();

export default GitHubActionsAgentService;
