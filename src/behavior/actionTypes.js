// AGENT NOTE:
// SG 2.0 Behavior Layer action type registry.
// Purpose: describe what SG can do as semantic action types, not as user-facing commands.
// Do not turn this into a keyword router, command map, or canned-response list.
// Do not add tool execution, transport handling, or AI prompts here.

export const SG_ACTION_TYPES = Object.freeze({
  THINK: "think",
  ANSWER: "answer",
  READ_SOURCE: "read_source",
  ANALYZE_REPO: "analyze_repo",
  PREPARE_PLAN: "prepare_plan",
  PREPARE_CODE: "prepare_code",
  MODIFY_REPO: "modify_repo",
  DELETE_DATA: "delete_data",
  CHANGE_CONFIG: "change_config",
  DEPLOY: "deploy",
  EXTERNAL_MESSAGE: "external_message",
});

export const SG_ACTION_POLICIES = Object.freeze({
  [SG_ACTION_TYPES.THINK]: Object.freeze({
    actionType: SG_ACTION_TYPES.THINK,
    category: "reasoning",
    description: "Internal reasoning, risk search, comparison, and synthesis.",
    stateChanging: false,
    defaultAllowed: true,
    requiresSource: false,
    requiresMonarch: false,
    requiresApproval: false,
    requiresPlanFirst: false,
  }),

  [SG_ACTION_TYPES.ANSWER]: Object.freeze({
    actionType: SG_ACTION_TYPES.ANSWER,
    category: "communication",
    description: "Answer the user as Living SG / Советник GARYA.",
    stateChanging: false,
    defaultAllowed: true,
    requiresSource: false,
    requiresMonarch: false,
    requiresApproval: false,
    requiresPlanFirst: false,
  }),

  [SG_ACTION_TYPES.READ_SOURCE]: Object.freeze({
    actionType: SG_ACTION_TYPES.READ_SOURCE,
    category: "source",
    description: "Read a real source such as repository, API, document, memory, or database.",
    stateChanging: false,
    defaultAllowed: true,
    requiresSource: false,
    requiresMonarch: false,
    requiresApproval: false,
    requiresPlanFirst: false,
  }),

  [SG_ACTION_TYPES.ANALYZE_REPO]: Object.freeze({
    actionType: SG_ACTION_TYPES.ANALYZE_REPO,
    category: "repository",
    description: "Analyze repository facts after verifying source data.",
    stateChanging: false,
    defaultAllowed: true,
    requiresSource: true,
    requiresMonarch: false,
    requiresApproval: false,
    requiresPlanFirst: false,
  }),

  [SG_ACTION_TYPES.PREPARE_PLAN]: Object.freeze({
    actionType: SG_ACTION_TYPES.PREPARE_PLAN,
    category: "planning",
    description: "Prepare an implementation, architecture, migration, or risk plan.",
    stateChanging: false,
    defaultAllowed: true,
    requiresSource: false,
    requiresMonarch: false,
    requiresApproval: false,
    requiresPlanFirst: false,
  }),

  [SG_ACTION_TYPES.PREPARE_CODE]: Object.freeze({
    actionType: SG_ACTION_TYPES.PREPARE_CODE,
    category: "code_proposal",
    description: "Prepare code, diff, or patch as a proposal without applying it.",
    stateChanging: false,
    defaultAllowed: true,
    requiresSource: true,
    requiresMonarch: false,
    requiresApproval: false,
    requiresPlanFirst: true,
  }),

  [SG_ACTION_TYPES.MODIFY_REPO]: Object.freeze({
    actionType: SG_ACTION_TYPES.MODIFY_REPO,
    category: "repository_write",
    description: "Create, edit, delete, or commit repository files.",
    stateChanging: true,
    defaultAllowed: false,
    requiresSource: true,
    requiresMonarch: true,
    requiresApproval: true,
    requiresPlanFirst: true,
  }),

  [SG_ACTION_TYPES.DELETE_DATA]: Object.freeze({
    actionType: SG_ACTION_TYPES.DELETE_DATA,
    category: "destructive_write",
    description: "Delete project, user, repository, database, memory, or external data.",
    stateChanging: true,
    defaultAllowed: false,
    requiresSource: true,
    requiresMonarch: true,
    requiresApproval: true,
    requiresPlanFirst: true,
  }),

  [SG_ACTION_TYPES.CHANGE_CONFIG]: Object.freeze({
    actionType: SG_ACTION_TYPES.CHANGE_CONFIG,
    category: "runtime_config",
    description: "Change env examples, runtime contract, permissions, model routing, or system configuration.",
    stateChanging: true,
    defaultAllowed: false,
    requiresSource: true,
    requiresMonarch: true,
    requiresApproval: true,
    requiresPlanFirst: true,
  }),

  [SG_ACTION_TYPES.DEPLOY]: Object.freeze({
    actionType: SG_ACTION_TYPES.DEPLOY,
    category: "deployment",
    description: "Deploy, redeploy, restart, or otherwise change runtime state.",
    stateChanging: true,
    defaultAllowed: false,
    requiresSource: true,
    requiresMonarch: true,
    requiresApproval: true,
    requiresPlanFirst: true,
  }),

  [SG_ACTION_TYPES.EXTERNAL_MESSAGE]: Object.freeze({
    actionType: SG_ACTION_TYPES.EXTERNAL_MESSAGE,
    category: "external_side_effect",
    description: "Send a message, comment, email, PR comment, or external communication on behalf of a user.",
    stateChanging: true,
    defaultAllowed: false,
    requiresSource: true,
    requiresMonarch: false,
    requiresApproval: true,
    requiresPlanFirst: false,
  }),
});

export function getKnownActionTypes() {
  return Object.values(SG_ACTION_TYPES);
}

export function getActionPolicy(actionType) {
  return SG_ACTION_POLICIES[actionType] || null;
}
