// src/core/living-sg/LivingSGBoundary.js
// ============================================================================
// LIVING SG — Boundary Skeleton
//
// Purpose:
// - compose the first read-only Living SG pipeline;
// - keep state-changing runtime disconnected until explicitly approved;
// - expose honest runtime metadata for the already-connected read-only source
//   evidence path;
// - do not add slash-commands;
// - do not create or expand Technical Mode;
// - do not call projectIntent/diagnostic bridges.
// ============================================================================

import { createLivingRequest } from "./LivingRequest.js";
import { createLivingIntentPlan } from "./LivingIntentPlan.js";
import { createLivingCapabilityPlan } from "./LivingCapabilityPlan.js";
import { evaluateLivingActionGate } from "./LivingActionGate.js";
import { createLivingResponsePlan } from "./LivingResponsePlan.js";

export function createLivingSGBoundary(input = {}) {
  const request = createLivingRequest(input);

  const intentPlan = createLivingIntentPlan({
    request,
    meaning: input.meaning || input.coreMeaning || {},
  });

  const capabilityPlan = createLivingCapabilityPlan({ intentPlan });

  const gate = evaluateLivingActionGate({
    capabilityPlan,
    confirmation: input.confirmation || null,
  });

  const responsePlan = createLivingResponsePlan({
    request,
    intentPlan,
    capabilityPlan,
    gate,
  });

  return {
    ok: responsePlan?.ok === true,
    dryRun: true,
    source: "LivingSGBoundary",
    connectedToRuntime: false,
    sourceEvidenceConnectedToRuntime: true,
    executorConnectedToRuntime: false,
    stateChangeConnectedToRuntime: false,
    request,
    intentPlan,
    capabilityPlan,
    gate,
    responsePlan,
    metadata: {
      noSlashCommandsAdded: true,
      noTechnicalModeExpansion: true,
      noDiagnosticBridge: true,
      noProjectIntentExecution: true,
      noStateChange: true,
    },
  };
}

export default {
  createLivingSGBoundary,
};
