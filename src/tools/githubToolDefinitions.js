// AGENT NOTE:
// SG 2.0 universal GitHub gateway tool definition.
// Purpose: expose one free GitHub REST API gateway to the AI wrapper.
// Do not include secrets or hardcoded narrow helper tools here.

export const githubToolDefinitions = [
  {
    type: "function",
    name: "github_request",
    description: "Call any GitHub REST API endpoint through SG runtime GitHub App authentication. Use this as the main GitHub access tool for repositories, files, branches, commits, issues, pull requests, and global GitHub search.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        method: {
          type: "string",
          description: "HTTP method for GitHub REST API. Use GET for reading/searching. Other methods work only if the installed GitHub App has permission.",
        },
        path: {
          type: "string",
          description: "GitHub REST API path, for example /repos/owner/repo/contents or /search/repositories. Full https://api.github.com/... URLs are also accepted.",
        },
        query: {
          type: "object",
          description: "Query parameters object, for example { ref: 'dev/v2-start' } or { q: 'AI memory language:JavaScript', per_page: 10 }.",
        },
        body: {
          type: "object",
          description: "Optional JSON body for non-GET GitHub API calls, if permissions allow it.",
        },
        headers: {
          type: "object",
          description: "Optional extra GitHub API headers. Do not include Authorization here.",
        },
      },
      required: ["path"],
    },
  },
];
