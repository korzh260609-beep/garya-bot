// AGENT NOTE:
// SG 2.0 AI tool definitions.
// Purpose: expose approved runtime tools to the AI wrapper.
// Do not include secrets or hardcoded unsafe mutation helpers here.

export const githubToolDefinitions = [
  {
    type: "function",
    name: "github_request",
    description: "Call any GitHub REST API endpoint through SG runtime GitHub App authentication. Read requests execute immediately. Write requests are never executed immediately: the tool requires semantic approvalContextJson, prepares an approval warning from that meaning, and executes only after the Monarch confirms via approval UI/fallback.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        method: {
          type: "string",
          description: "HTTP method for GitHub REST API. Use GET/HEAD for reading/searching. POST/PUT/PATCH/DELETE require semantic approvalContextJson and Monarch approval before execution.",
        },
        path: {
          type: "string",
          description: "GitHub REST API path, for example /repos/owner/repo/contents or /search/repositories. Full https://api.github.com/... URLs are also accepted.",
        },
        queryJson: {
          type: "string",
          description: "Optional JSON string with query parameters, for example {\"ref\":\"dev/v2-start\"} or {\"q\":\"AI memory language:JavaScript\",\"per_page\":10}.",
        },
        bodyJson: {
          type: "string",
          description: "Optional JSON string body for non-GET GitHub API calls. For write requests, this body is included in the pending approval and cannot be executed until the Monarch confirms.",
        },
        headersJson: {
          type: "string",
          description: "Optional JSON string with extra GitHub API headers. Do not include Authorization here.",
        },
        approvalContextJson: {
          type: "string",
          description: "Required for POST/PUT/PATCH/DELETE. JSON object written by SG from the meaning of the planned change, not guessed by file path. Include: change_type, change_summary, reason, affected_files, affected_layers, specific_impact, not_touched."
        },
      },
      required: ["path"],
    },
  },
  {
    type: "function",
    name: "render_collect_logs",
    description: "Collect the latest N Render logs for the SG Render service through the configured Render Bridge and write the sanitized result to runtime/render/latest/latest-render-logs.json in GitHub. Use this when the Monarch asks in natural language to get, show, fetch, or check Render logs. This tool never exposes Render env values and never mutates Render.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        limit: {
          type: "number",
          description: "Number of latest logs to collect. Clamp to 1..1000. Default 100.",
        },
        target: {
          type: "string",
          description: "Render service target. Default garya-bot.",
        },
        level: {
          type: "string",
          description: "Log level filter. Use all by default.",
        },
      },
      required: [],
    },
  },
  {
    type: "function",
    name: "render_collect_env",
    description: "Collect Render environment variable inventory for the SG Render service and write the sanitized result to runtime/render/latest/latest-render-env.json in GitHub. Use this when the Monarch asks to check, list, collect, or show Render env variables. This tool shows env names and non-secret values; secret values are hidden by exact name, suffix, or value pattern.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        target: {
          type: "string",
          description: "Render service target. Default garya-bot.",
        },
      },
      required: [],
    },
  },
  {
    type: "function",
    name: "repo_collect_registry",
    description: "Collect a deterministic repository registry for the SG project and write the result to runtime/repo/latest/latest-repo-registry.json in GitHub. Use this when the Monarch asks to build, refresh, or update a repo registry/map of folders and files. This tool is read-only for repository contents and writes only the latest registry workspace report.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        repo: {
          type: "string",
          description: "Repository in owner/name form. Default current SG project repository.",
        },
        branch: {
          type: "string",
          description: "Branch/ref to inspect. Default current SG project branch.",
        },
      },
      required: [],
    },
  },
  {
    type: "function",
    name: "repo_search_commits",
    description: "Search SG GitHub commit history by user intent. Use this when the Monarch asks what commit contained an action, where a file was changed, when something was added/removed, or which commit performed a specific repository change. Searches commit messages, changed file paths, and patch text. This tool reads GitHub only and does not store full commit history.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        text: {
          type: "string",
          description: "Natural-language description of the action to search for, for example: where did we remove shared workspace skeleton, where was repo registry added, where did Render env change.",
        },
        repo: {
          type: "string",
          description: "Repository in owner/name form. Default current SG project repository.",
        },
        branch: {
          type: "string",
          description: "Branch/ref to inspect. Default current SG project branch.",
        },
        limit: {
          type: "number",
          description: "Number of recent commits to inspect. Default 20, max 50. Detailed patch scoring is limited internally.",
        },
      },
      required: ["text"],
    },
  },
];
