// AGENT NOTE:
// SG 2.0 universal GitHub gateway tool definition.
// Purpose: expose one free GitHub REST API gateway to the AI wrapper.
// Do not include secrets or hardcoded narrow helper tools here.

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
          description: "Required for POST/PUT/PATCH/DELETE. JSON object written by SG from the meaning of the planned change, not guessed by file path. Include: change_type, change_summary, reason, affected_files, affected_layers, specific_impact, not_touched. Example: {\"change_type\":\"logic\",\"change_summary\":\"Change GitHub approval warning text to be semantic\",\"reason\":\"Remove path-based impact heuristics\",\"affected_files\":[\"src/tools/githubTool.js\"],\"affected_layers\":[\"GitHub approval gate\"],\"specific_impact\":[\"Approval warning text will be based on SG's stated meaning\",\"Write execution gate remains unchanged\"],\"not_touched\":[\"main\",\"Render env\",\"GitHub App auth\"]}"
        },
      },
      required: ["path"],
    },
  },
];
