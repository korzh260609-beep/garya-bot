// AGENT NOTE:
// SG 2.0 Behavior Layer prompt adapter.
// Purpose: convert canonical behavior rules into prompt text used by the AI layer.
// Do not add tool execution, permission checks, or transport logic here.

import { SG_BEHAVIOR_RULES } from "./behaviorRules.js";

function bulletList(items = []) {
  return items.map((item) => `- ${item}`).join("\n");
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

Forbidden external behavior:
${bulletList(rules.identity.forbidden)}
${bulletList(rules.meaningFirst.forbidden)}

State-changing examples requiring approval:
${bulletList(rules.stateChange.examples)}
`.trim();
}
