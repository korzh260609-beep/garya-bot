import type { AnyAgentTool, OpenClawPluginToolContext } from "openclaw/plugin-sdk/plugin-entry";
import { jsonResult } from "openclaw/plugin-sdk/tool-results";

export function createSgRenderTool(ctx: OpenClawPluginToolContext): AnyAgentTool {
  return {
    name: "sg_render",
    label: "Render SG",
    description:
      "Protected SG Render integration surface. Full Render API operations are activated in Phase 4.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {},
    },
    async execute() {
      if (ctx.senderIsOwner !== true) {
        return jsonResult({ status: "forbidden", reason: "monarch-required" });
      }
      return jsonResult({ status: "unavailable", reason: "render-api-not-activated" });
    },
  };
}
