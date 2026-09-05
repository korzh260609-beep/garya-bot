import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("SG 2.2 Render entrypoint", () => {
  it("requires the configured Monarch identity and Global ID when the plugin is enabled", async () => {
    const script = await readFile(
      new URL("../../scripts/sg22-render-entrypoint.sh", import.meta.url),
      "utf8",
    );

    expect(script).toContain('monarch_global_id="${SG_MONARCH_GLOBAL_USER_ID:-}"');
    expect(script).toContain('if [ -z "$telegram_owner_id" ] || [ -z "$monarch_global_id" ]; then');
    expect(script).toContain(
      "SG 2.2 startup error: SG_MONARCH_TELEGRAM_USER_ID and SG_MONARCH_GLOBAL_USER_ID are required",
    );
  });

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
      'workspace_plugin_tools=\'["sg_citizen_apply","sg_citizen_pending","sg_citizen_decide","sg_content_draft","sg_content_review","sg_content_publish","sg_content_schedule","sg_content_dispatch","sg_test_manage","sg_test_attempt","sg_test_stats"]\'',
    );
    expect(script).toContain("node /app/scripts/sg22-migrate-workspace-memberships.mjs");
    expect(script).toContain("node /app/scripts/sg22-migrate-workspace-requests.mjs");
    expect(script).toContain('{"path":"tools.alsoAllow","value":\'"${workspace_plugin_tools}"\'}');
    expect(script).not.toContain('"path":"agents.defaults.tools.alsoAllow"');
  });

  it("isolates public DMs and bounds paid model context on every boot", async () => {
    const script = await readFile(
      new URL("../../scripts/sg22-render-entrypoint.sh", import.meta.url),
      "utf8",
    );

    expect(script).toContain('{"path":"session.dmScope","value":"per-channel-peer"}');
    expect(script).toContain('{"path":"agents.defaults.compaction.enabled","value":true}');
    expect(script).toContain('{"path":"agents.defaults.compaction.mode","value":"safeguard"}');
    expect(script).toContain(
      '{"path":"agents.defaults.compaction.maxActiveTranscriptBytes","value":"128kb"}',
    );
    expect(script).toContain(
      '{"path":"agents.defaults.compaction.keepRecentTokens","value":12000}',
    );
    expect(script).toContain('{"path":"agents.defaults.compaction.recentTurnsPreserve","value":4}');
    expect(script).toContain(
      '{"path":"agents.defaults.compaction.identifierPolicy","value":"off"}',
    );
    expect(script).toContain('"identifierPolicy": "off"');
    expect(script).not.toContain('"identifierPolicy": "strict"');
    expect(script).toContain(
      '{"path":"agents.defaults.compaction.qualityGuard","value":{"enabled":true,"maxRetries":1}}',
    );
    expect(script).toContain(
      '{"path":"agents.defaults.compaction.midTurnPrecheck","value":{"enabled":true}}',
    );
    expect(script).toContain(
      '{"path":"agents.defaults.compaction.memoryFlush.enabled","value":false}',
    );
    expect(script).toContain('{"path":"agents.defaults.contextPruning.mode","value":"cache-ttl"}');
    expect(script).toContain('{"path":"agents.defaults.contextPruning.ttl","value":"5m"}');
    expect(script).toContain(
      '{"path":"agents.defaults.contextPruning.hardClear.enabled","value":true}',
    );
    expect(script).toContain(
      "for plugin_file in index.ts register.ts cost-diagnostics.ts openclaw.plugin.json package.json",
    );
  });
});
