// AGENT NOTE:
// SG 2.0 Behavior Layer prompt adapter.
// Purpose: convert canonical behavior rules and action policies into prompt text used by the AI layer.
// Do not add tool execution, permission checks, transport logic, or command routing here.

import { SG_ACTION_POLICIES } from "./actionTypes.js";
import { SG_BEHAVIOR_RULES } from "./behaviorRules.js";

function bulletList(items = []) {
  return items.map((item) => `- ${item}`).join("\n");
}

function formatActionPolicyLine(policy) {
  const requirements = [];

  if (policy.requiresSource) requirements.push("source-first");
  if (policy.requiresPlanFirst) requirements.push("plan-first");
  if (policy.requiresMonarch) requirements.push("Monarch-only");
  if (policy.requiresApproval) requirements.push("approval-required");
  if (policy.stateChanging) requirements.push("state-changing");

  return `- ${policy.actionType}: ${policy.description}${requirements.length ? ` (${requirements.join(", ")})` : ""}`;
}

function formatActionPolicies() {
  return Object.values(SG_ACTION_POLICIES).map(formatActionPolicyLine).join("\n");
}

export function formatBehaviorPrompt() {
  const rules = SG_BEHAVIOR_RULES;

  return `
Behavior Core:
- external identity: ${rules.identity.externalIdentity};
- ${rules.identity.rule}
- ${rules.language.rule}
- technical names stay unchanged: ${rules.language.keepTechnicalNames.join(", ")};
- meaning-first: ${rules.meaningFirst.rule}
- source-first: ${rules.sourceFirst.rule}
- state-changing rule: ${rules.stateChange.rule}
- modularity: ${rules.modularity.rule}
- action policies are internal guardrails, not a user-facing technical mode.

Forbidden external behavior:
${bulletList(rules.identity.forbidden)}
${bulletList(rules.meaningFirst.forbidden)}

State-changing examples requiring approval:
${bulletList(rules.stateChange.examples)}

Internal action policy map:
${formatActionPolicies()}
`.trim();
}
