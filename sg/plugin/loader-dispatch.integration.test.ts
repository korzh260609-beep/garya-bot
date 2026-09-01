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
      timeout: 20_000,
    });
    const marker = stdout.split("\n").find((line) => line.startsWith("SG_LOADER_PROBE="));
    expect(marker).toBeDefined();
    expect(JSON.parse(marker!.slice("SG_LOADER_PROBE=".length))).toMatchObject({
      pluginLoaded: true,
      hookRegistered: true,
      promptHookRegistered: true,
      diagnosticHooksRegistered: true,
      toolsRegistered: true,
      wsp4ToolsRegistered: true,
      promptGuidanceInjected: true,
      pendingToolInModelSurface: true,
      wsp4ToolsInModelSurface: true,
      wsp4ToolsAbsentWithoutGrant: true,
      pluginToolsExcludedWithoutGrant: true,
      pluginToolsIncludedWithGrant: true,
      errorDiagnostics: [],
      dispatchResult: { handled: true },
      repeatDispatchResult: {
        handled: true,
        text: expect.stringContaining("уже ожидает подтверждения"),
      },
      pendingCount: 1,
    });
    expect(await readFile(path.join(stateDir, "sg", "workspace-requests.json"), "utf8")).toContain(
      '"status": "pending"',
    );
  });
});
