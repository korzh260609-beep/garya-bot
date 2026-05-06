// AGENT NOTE:
// SG 2.0 GitHub Actions formatter.
// Purpose: normalize GitHub Actions REST API responses into compact SG-readable summaries.
// Do not put GitHub auth, approval logic, or transport behavior here.

function normalizeWorkflowRun(run = {}) {
  return {
    id: run.id || null,
    name: run.name || run.display_title || "unknown",
    workflow_name: run.name || "unknown",
    branch: run.head_branch || "unknown",
    status: run.status || "unknown",
    conclusion: run.conclusion || null,
    event: run.event || null,
    commit_sha: run.head_sha || null,
    html_url: run.html_url || null,
    created_at: run.created_at || null,
    updated_at: run.updated_at || null,
  };
}

function normalizeWorkflow(workflow = {}) {
  return {
    id: workflow.id || null,
    name: workflow.name || "unknown",
    path: workflow.path || null,
    state: workflow.state || null,
    html_url: workflow.html_url || null,
  };
}

function isActionsRunsPath(path = "") {
  return /^\/repos\/[^/]+\/[^/]+\/actions\/(runs|workflows\/[^/]+\/runs)\/?$/.test(path);
}

function isActionsWorkflowsPath(path = "") {
  return /^\/repos\/[^/]+\/[^/]+\/actions\/workflows\/?$/.test(path);
}

export function formatGitHubActionsResult({ method, path, query, data } = {}) {
  if (method !== "GET") return null;

  if (isActionsRunsPath(path)) {
    const runs = Array.isArray(data?.workflow_runs) ? data.workflow_runs : [];

    return {
      type: "github_actions_runs",
      branch: query?.branch || null,
      total_count: typeof data?.total_count === "number" ? data.total_count : runs.length,
      runs: runs.slice(0, 10).map(normalizeWorkflowRun),
    };
  }

  if (isActionsWorkflowsPath(path)) {
    const workflows = Array.isArray(data?.workflows) ? data.workflows : [];

    return {
      type: "github_actions_workflows",
      total_count: typeof data?.total_count === "number" ? data.total_count : workflows.length,
      workflows: workflows.slice(0, 20).map(normalizeWorkflow),
    };
  }

  return null;
}
