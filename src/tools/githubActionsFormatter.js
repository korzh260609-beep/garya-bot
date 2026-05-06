// AGENT NOTE:
// SG 2.0 GitHub Actions formatter.
// Purpose: normalize GitHub Actions REST API responses into compact SG-readable summaries.
// Do not put GitHub auth, approval logic, or transport behavior here.

function normalizeWorkflowRun(run = {}) {
  return {
    id: run.id || null,
    name: run.name || run.display_title || "unknown",
    display_title: run.display_title || run.name || "unknown",
    workflow_name: run.name || "unknown",
    workflow_id: run.workflow_id || null,
    run_number: run.run_number || null,
    run_attempt: run.run_attempt || null,
    branch: run.head_branch || "unknown",
    status: run.status || "unknown",
    conclusion: run.conclusion || null,
    event: run.event || null,
    commit_sha: run.head_sha || null,
    head_commit_message: run.head_commit?.message || null,
    actor: run.actor?.login || null,
    html_url: run.html_url || null,
    jobs_url: run.jobs_url || null,
    logs_url: run.logs_url || null,
    check_suite_url: run.check_suite_url || null,
    created_at: run.created_at || null,
    updated_at: run.updated_at || null,
    run_started_at: run.run_started_at || null,
  };
}

function normalizeWorkflow(workflow = {}) {
  return {
    id: workflow.id || null,
    name: workflow.name || "unknown",
    path: workflow.path || null,
    state: workflow.state || null,
    badge_url: workflow.badge_url || null,
    html_url: workflow.html_url || null,
    created_at: workflow.created_at || null,
    updated_at: workflow.updated_at || null,
  };
}

function normalizeStep(step = {}) {
  return {
    name: step.name || "unknown",
    status: step.status || "unknown",
    conclusion: step.conclusion || null,
    number: step.number || null,
    started_at: step.started_at || null,
    completed_at: step.completed_at || null,
  };
}

function normalizeJob(job = {}) {
  const steps = Array.isArray(job.steps) ? job.steps : [];

  return {
    id: job.id || null,
    run_id: job.run_id || null,
    name: job.name || "unknown",
    status: job.status || "unknown",
    conclusion: job.conclusion || null,
    runner_name: job.runner_name || null,
    runner_group_name: job.runner_group_name || null,
    html_url: job.html_url || null,
    started_at: job.started_at || null,
    completed_at: job.completed_at || null,
    steps_total: steps.length,
    steps_failed: steps.filter((step) => step.conclusion === "failure").length,
    steps_cancelled: steps.filter((step) => step.conclusion === "cancelled").length,
    steps: steps.map(normalizeStep),
  };
}

function normalizeArtifact(artifact = {}) {
  return {
    id: artifact.id || null,
    name: artifact.name || "unknown",
    size_in_bytes: artifact.size_in_bytes || null,
    expired: artifact.expired === true,
    created_at: artifact.created_at || null,
    expires_at: artifact.expires_at || null,
    archive_download_url: artifact.archive_download_url || null,
  };
}

function isActionsRunsPath(path = "") {
  return /^\/repos\/[^/]+\/[^/]+\/actions\/(runs|workflows\/[^/]+\/runs)\/?$/.test(path);
}

function isSingleActionsRunPath(path = "") {
  return /^\/repos\/[^/]+\/[^/]+\/actions\/runs\/[^/]+\/?$/.test(path);
}

function isActionsWorkflowsPath(path = "") {
  return /^\/repos\/[^/]+\/[^/]+\/actions\/workflows\/?$/.test(path);
}

function isSingleActionsWorkflowPath(path = "") {
  return /^\/repos\/[^/]+\/[^/]+\/actions\/workflows\/[^/]+\/?$/.test(path);
}

function isActionsRunJobsPath(path = "") {
  return /^\/repos\/[^/]+\/[^/]+\/actions\/runs\/[^/]+\/jobs\/?$/.test(path);
}

function isActionsRunArtifactsPath(path = "") {
  return /^\/repos\/[^/]+\/[^/]+\/actions\/runs\/[^/]+\/artifacts\/?$/.test(path);
}

function isActionsRunLogsPath(path = "") {
  return /^\/repos\/[^/]+\/[^/]+\/actions\/runs\/[^/]+\/logs\/?$/.test(path);
}

function countConclusions(items = []) {
  return items.reduce((acc, item) => {
    const key = item.conclusion || item.status || "unknown";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

export function formatGitHubActionsResult({ method, path, query, data } = {}) {
  if (method !== "GET") return null;

  if (isActionsRunsPath(path)) {
    const runs = Array.isArray(data?.workflow_runs) ? data.workflow_runs : [];
    const normalizedRuns = runs.slice(0, 20).map(normalizeWorkflowRun);

    return {
      type: "github_actions_runs",
      branch: query?.branch || null,
      event: query?.event || null,
      status: query?.status || null,
      total_count: typeof data?.total_count === "number" ? data.total_count : runs.length,
      returned_count: normalizedRuns.length,
      conclusions: countConclusions(normalizedRuns),
      runs: normalizedRuns,
    };
  }

  if (isSingleActionsRunPath(path)) {
    return {
      type: "github_actions_run",
      run: normalizeWorkflowRun(data || {}),
    };
  }

  if (isActionsRunJobsPath(path)) {
    const jobs = Array.isArray(data?.jobs) ? data.jobs : [];
    const normalizedJobs = jobs.map(normalizeJob);

    return {
      type: "github_actions_run_jobs",
      total_count: typeof data?.total_count === "number" ? data.total_count : jobs.length,
      returned_count: normalizedJobs.length,
      conclusions: countConclusions(normalizedJobs),
      jobs: normalizedJobs,
    };
  }

  if (isActionsRunArtifactsPath(path)) {
    const artifacts = Array.isArray(data?.artifacts) ? data.artifacts : [];

    return {
      type: "github_actions_run_artifacts",
      total_count: typeof data?.total_count === "number" ? data.total_count : artifacts.length,
      returned_count: artifacts.length,
      artifacts: artifacts.map(normalizeArtifact),
    };
  }

  if (isActionsRunLogsPath(path)) {
    return {
      type: "github_actions_run_logs",
      note: "GitHub returns workflow run logs as a redirect/zip payload. Use the logs_url from the run or a dedicated log downloader when needed.",
      raw_data_type: data === null ? "null" : Array.isArray(data) ? "array" : typeof data,
    };
  }

  if (isActionsWorkflowsPath(path)) {
    const workflows = Array.isArray(data?.workflows) ? data.workflows : [];
    const normalizedWorkflows = workflows.slice(0, 50).map(normalizeWorkflow);

    return {
      type: "github_actions_workflows",
      total_count: typeof data?.total_count === "number" ? data.total_count : workflows.length,
      returned_count: normalizedWorkflows.length,
      workflows: normalizedWorkflows,
    };
  }

  if (isSingleActionsWorkflowPath(path)) {
    return {
      type: "github_actions_workflow",
      workflow: normalizeWorkflow(data || {}),
    };
  }

  return null;
}
