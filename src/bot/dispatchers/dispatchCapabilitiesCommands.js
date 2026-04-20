// src/bot/dispatchers/dispatchCapabilitiesCommands.js
// ============================================================================
// CAPABILITIES COMMANDS DISPATCHER
// - extracted 1:1 from commandDispatcher
// - NO logic changes
// - ONLY routing isolation
// ============================================================================

import {
  handleCapabilitiesRegistry,
  handleCapabilityLookup,
} from "../handlers/capabilitiesRegistry.js";
import { handleCapabilityDiagram } from "../handlers/capabilityDiagram.js";
import { handleCapabilityDocument } from "../handlers/capabilityDocument.js";
import { handleCapabilityAutomation } from "../handlers/capabilityAutomation.js";

export async function dispatchCapabilitiesCommands({ cmd0, ctx }) {
  switch (cmd0) {
    case "/capabilities": {
      await handleCapabilitiesRegistry(ctx);
      return { handled: true };
    }

    case "/capability": {
      await handleCapabilityLookup(ctx);
      return { handled: true };
    }

    case "/cap_diagram": {
      await handleCapabilityDiagram(ctx);
      return { handled: true };
    }

    case "/cap_doc": {
      await handleCapabilityDocument(ctx);
      return { handled: true };
    }

    case "/cap_automation": {
      await handleCapabilityAutomation(ctx);
      return { handled: true };
    }

    default:
      return { handled: false };
  }
}

export default {
  dispatchCapabilitiesCommands,
};