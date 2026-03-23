// src/core/buildDefaultChatLongTermSelector.js

import buildLongTermPromptSelector from "./buildLongTermPromptSelector.js";

export function buildDefaultChatLongTermSelector() {
  return buildLongTermPromptSelector({
    rememberTypes: [
      "user_profile",
      "vehicle_profile",
      "maintenance_fact",
      "maintenance_interval",
      "task_intent",
    ],
    rememberKeys: ["communication_style"],
    perTypeLimit: 3,
    perKeyLimit: 3,
    totalLimit: 12,
  });
}

export default buildDefaultChatLongTermSelector;