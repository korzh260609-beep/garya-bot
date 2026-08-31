import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("SG 2.2 Render entrypoint", () => {
  it("explicitly authorizes the external workspace plugin conversation hooks", async () => {
    const script = await readFile(
      new URL("../../scripts/sg22-render-entrypoint.sh", import.meta.url),
      "utf8",
    );

    expect(script).toContain('"allowPromptInjection": true');
    expect(script).toContain('"allowConversationAccess": true');
    expect(script).toContain(
      '{"path":"plugins.entries.sg-workspace-manager.hooks.allowPromptInjection","value":true}',
    );
    expect(script).toContain(
      '{"path":"plugins.entries.sg-workspace-manager.hooks.allowConversationAccess","value":true}',
    );
    expect(script).toContain(
      'workspace_plugin_tools=' +
        "'[\"sg_workspace_onboard\",\"sg_workspace_pending\",\"sg_workspace_decide\"]'",
    );
    expect(script).toContain(
      '{"path":"agents.defaults.tools.alsoAllow","value":' +
        "'\"${workspace_plugin_tools}\"'" +
        "}",
    );
  });
});
