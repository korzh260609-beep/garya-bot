import { execFile } from "node:child_process";
import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const pluginDir = path.dirname(fileURLToPath(import.meta.url));
const execFileAsync = promisify(execFile);

describe("SG Workspace Manager real loader and dispatch runner", () => {
  it("loads the external plugin, registers its contracts, and handles before model dispatch", async () => {
    const stateDir = await mkdtemp(path.join(os.tmpdir(), "sg-loader-dispatch-"));
    const probe = path.join(pluginDir, "loader-dispatch.probe.ts");
    const { stdout } = await execFileAsync(process.execPath, ["--import", "tsx", probe, stateDir], {
      cwd: path.resolve(pluginDir, "../.."),
      timeout: 60_000,
      env: { ...process.env, SG_MODEL_ROUTING_ACTIVATION: "active" },
    });
    const marker = stdout.split("\n").find((line) => line.startsWith("SG_LOADER_PROBE="));
    expect(marker).toBeDefined();
    expect(JSON.parse(marker!.slice("SG_LOADER_PROBE=".length))).toMatchObject({
      pluginLoaded: true,
      hookRegistered: true,
      promptHookRegistered: true,
      modelRouterHookRegistered: true,
      modelRouterOverride: {
        providerOverride: "openai",
        modelOverride: "gpt-5.6-luna",
      },
      lifecycleHooksRegistered: true,
      onboardingToolsAbsent: true,
      wsp5ToolsRegistered: true,
      wsp6ToolsRegistered: true,
      phase11ToolsRegistered: true,
      onboardingGuidanceAbsent: true,
      onboardingToolsAbsentInModelSurface: true,
      wsp5ToolsInModelSurface: true,
      wsp6ToolsInModelSurface: true,
      phase11ToolsInModelSurface: true,
      citizenshipToolsAbsentWithoutGrant: true,
      wsp5ToolsAbsentWithoutGrant: true,
      wsp6ToolsAbsentWithoutGrant: true,
      pluginToolsExcludedWithoutGrant: true,
      pluginToolsIncludedWithGrant: true,
      errorDiagnostics: [],
      dispatchClaimed: false,
      repeatDispatchClaimed: false,
      resourceScopeCount: 1,
    });
    expect(await readFile(path.join(stateDir, "sg", "workspaces.json"), "utf8")).toContain(
      '"resourceScopes"',
    );
  }, 75_000);
});
