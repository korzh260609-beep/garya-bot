// AGENT NOTE:
// SG 2.0 GitHub tool definitions for OpenAI function calling.
// Purpose: expose runtime GitHub read tools to the AI wrapper.
// Do not include secrets or write-capable GitHub operations here.

export const githubToolDefinitions = [
  {
    type: "function",
    name: "github_get_branch",
    description: "Get GitHub branch metadata for the configured or provided repository.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        repository: {
          type: "string",
          description: "Repository in owner/name form. Defaults to GITHUB_REPO.",
        },
        branch: {
          type: "string",
          description: "Branch name. Defaults to GITHUB_BRANCH.",
        },
      },
      required: [],
    },
  },
  {
    type: "function",
    name: "github_get_commit",
    description: "Get GitHub commit metadata for a branch, tag, or commit SHA.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        repository: {
          type: "string",
          description: "Repository in owner/name form. Defaults to GITHUB_REPO.",
        },
        ref: {
          type: "string",
          description: "Branch, tag, or commit SHA. Defaults to GITHUB_BRANCH.",
        },
      },
      required: [],
    },
  },
  {
    type: "function",
    name: "github_list_tree",
    description: "List the repository tree recursively for the configured or provided branch.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        repository: {
          type: "string",
          description: "Repository in owner/name form. Defaults to GITHUB_REPO.",
        },
        ref: {
          type: "string",
          description: "Branch name. Defaults to GITHUB_BRANCH.",
        },
      },
      required: [],
    },
  },
  {
    type: "function",
    name: "github_fetch_file",
    description: "Fetch a text file from GitHub using repository, ref, and path.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        repository: {
          type: "string",
          description: "Repository in owner/name form. Defaults to GITHUB_REPO.",
        },
        ref: {
          type: "string",
          description: "Branch, tag, or commit SHA. Defaults to GITHUB_BRANCH.",
        },
        path: {
          type: "string",
          description: "Repository file path to fetch.",
        },
      },
      required: ["path"],
    },
  },
  {
    type: "function",
    name: "github_search_code",
    description: "Search code in the configured or provided GitHub repository.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        repository: {
          type: "string",
          description: "Repository in owner/name form. Defaults to GITHUB_REPO.",
        },
        query: {
          type: "string",
          description: "Search query text.",
        },
      },
      required: ["query"],
    },
  },
];
