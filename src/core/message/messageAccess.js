// AGENT NOTE:
// SG 2.0 message access helpers.
// Purpose: isolate early access gate response mapping from handleMessage orchestration.
// Do not add permission storage, AI calls, transport logic, or behavior policy here.

import { checkEarlyAccess } from "../../permissions/monarchGate.js";

export function checkMessageAccess(identity) {
  return checkEarlyAccess({ userId: identity.platformUserId });
}

export function buildAccessDeniedReply({ access, identity }) {
  return {
    ok: false,
    reply: "Сейчас я доступен только монарху на этапе основания SG 2.0.",
    reason: access.reason,
    identity,
  };
}
