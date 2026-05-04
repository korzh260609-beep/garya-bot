// AGENT NOTE:
// SG 2.0 GitHub tool definitions for OpenAI function calling.
// Purpose: expose runtime GitHub read/search tools to the AI wrapper.
// Do not include secrets or write-capable GitHub operations here.

export const githubToolDefinitions = [
  {
    type: "function",
    name: "github_get_repository",
    description: "Get GitHub repository metadata for any repository accessible to the Render GitHub token, including public repositories.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        repository: {
          type: "string",
          description: "Repository in owner/name form. Defaults to GITHUB_REPO.",
        },
      },
      required: [],
    },
  },
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
    description: "Search code inside the configured or provided GitHub repository.",
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
        page: {
          type: "number",
          description: "GitHub search result page. Defaults to 1.",
        },
        perPage: {
          type: "number",
          description: "Results per page. Defaults to 20, max 50.",
        },
      },
      required: ["query"],
    },
  },
  {
    type: "function",
    name: "github_search_repositories",
    description: "Search repositories globally across GitHub by topic, keywords, language, stars, owner, or other GitHub search qualifiers.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        query: {
          type: "string",
          description: "GitHub repository search query, for example: AI memory language:JavaScript stars:>100.",
        },
        page: {
          type: "number",
          description: "GitHub search result page. Defaults to 1.",
        },
        perPage: {
          type: "number",
          description: "Results per page. Defaults to 20, max 50.",
        },
        sort: {
          type: "string",
          description: "Optional sort, such as stars, forks, help-wanted-issues, or updated.",
        },
        order: {
          type: "string",
          description: "Optional order: asc or desc.",
        },
      },
      required: ["query"],
    },
  },
  {
    type: "function",
    name: "github_global_code_search",
    description: "Search code globally across GitHub by keywords, file names, language, path, repository, or other GitHub code search qualifiers.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        query: {
          type: "string",
          description: "GitHub global code search query.",
        },
        page: {
          type: "number",
          description: "GitHub search result page. Defaults to 1.",
        },
        perPage: {
          type: "number",
          description: "Results per page. Defaults to 20, max 50.",
        },
        sort: {
          type: "string",
          description: "Optional sort supported by GitHub code search.",
        },
        order: {
          type: "string",
          description: "Optional order: asc or desc.",
        },
      },
      required: ["query"],
    },
  },
  {
    type: "function",
    name: "github_search_issues",
    description: "Search GitHub issues and pull requests globally using GitHub issue search qualifiers.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        query: {
          type: "string",
          description: "GitHub issue/PR search query, for example: repo:owner/name is:issue memory bug.",
        },
        page: {
          type: "number",
          description: "GitHub search result page. Defaults to 1.",
        },
        perPage: {
          type: "number",
          description: "Results per page. Defaults to 20, max 50.",
        },
        sort: {
          type: "string",
          description: "Optional sort, such as comments, reactions, reactions-+1, updated, or created.",
        },
        order: {
          type: "string",
          description: "Optional order: asc or desc.",
        },
      },
      required: ["query"],
    },
  },
];
