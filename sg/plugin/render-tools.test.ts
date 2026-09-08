import { readFile } from "node:fs/promises";
import type { AnyAgentTool, OpenClawPluginToolContext } from "openclaw/plugin-sdk/plugin-entry";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createSgRenderTool } from "./render-tools.js";

type ToolResult = { details: unknown };

function renderTool(
  context: Partial<OpenClawPluginToolContext> = { senderIsOwner: true },
): AnyAgentTool {
  return createSgRenderTool(context as OpenClawPluginToolContext);
}

async function execute(tool: AnyAgentTool, parameters: Record<string, unknown>): Promise<unknown> {
  const result = (await tool.execute?.("render-call", parameters)) as ToolResult;
  return result.details;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("sg_render Phase 4", () => {
  it("keeps raw Control UI HTML from becoming a false post-deploy failure", () => {
    const description = renderTool().description;

    expect(description).toContain("Never treat fallback text in raw root HTML as a UI failure");
    expect(description).toContain("verify Control UI only in a real browser");
    expect(description).toContain("continue the remaining deploy checks");
  });

  it("declares Phase 4 runtime inputs and startup integrity coverage", async () => {
    const [blueprint, entrypoint] = await Promise.all([
      readFile("render.yaml", "utf8"),
      readFile("scripts/sg22-render-entrypoint.sh", "utf8"),
    ]);

    expect(blueprint).toMatch(/- key: RENDER_API_KEY\s+sync: false/u);
    expect(blueprint).toMatch(/- key: RENDER_WORKSPACE_ID\s+sync: false/u);
    expect(blueprint).not.toMatch(/- key: RENDER_SERVICE_ID/u);
    expect(entrypoint).toMatch(/for plugin_file in [^\n]*render-tools\.ts/u);
  });

  it("delegates authorization to the OpenClaw tool inventory", async () => {
    vi.stubEnv("RENDER_API_KEY", "phase-4-secret");

    const result = await execute(renderTool({ senderIsOwner: false }), { action: "status" });

    expect(result).toStrictEqual({
      status: "ready",
      workspaceConfigured: false,
      serviceConfigured: false,
    });
  });

  it("allows senderless recovery when OpenClaw already retained the Monarch tool policy", async () => {
    vi.stubEnv("RENDER_API_KEY", "phase-4-secret");

    const result = await execute(
      renderTool({ agentId: "main", sessionKey: "agent:main:telegram:direct:100" }),
      { action: "status" },
    );

    expect(result).toStrictEqual({
      status: "ready",
      workspaceConfigured: false,
      serviceConfigured: false,
    });
  });

  it("allows a trusted senderless automation selected by OpenClaw tool policy", async () => {
    vi.stubEnv("RENDER_API_KEY", "phase-4-secret");

    const result = await execute(
      renderTool({ agentId: "main", sessionKey: "agent:main:cron:trusted-render-check" }),
      { action: "status" },
    );

    expect(result).toStrictEqual({
      status: "ready",
      workspaceConfigured: false,
      serviceConfigured: false,
    });
  });

  it("reports readiness without exposing credential values", async () => {
    vi.stubEnv("RENDER_API_KEY", "phase-4-secret");
    vi.stubEnv("RENDER_WORKSPACE_ID", "tea-workspace");
    vi.stubEnv("RENDER_SERVICE_ID", "srv-primary");

    const result = await execute(renderTool(), { action: "status" });

    expect(result).toStrictEqual({
      status: "ready",
      workspaceConfigured: true,
      serviceConfigured: true,
    });
    expect(JSON.stringify(result)).not.toContain("phase-4-secret");
  });

  it("stays unavailable without an API key and never reaches the network", async () => {
    vi.stubEnv("RENDER_API_KEY", "");
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchMock);

    await expect(execute(renderTool(), { action: "list_services" })).resolves.toStrictEqual({
      status: "unavailable",
      reason: "render-api-key-missing",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("lists only the configured workspace services with bounded pagination", async () => {
    vi.stubEnv("RENDER_API_KEY", "phase-4-secret");
    vi.stubEnv("RENDER_WORKSPACE_ID", "tea-workspace");
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse([{ service: { id: "srv-primary" } }]));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      execute(renderTool(), { action: "list_services", limit: 500 }),
    ).resolves.toStrictEqual({
      status: "ok",
      action: "list_services",
      data: [{ service: { id: "srv-primary" } }],
    });
    expect(fetchMock.mock.calls).toHaveLength(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.render.com/v1/services?ownerId=tea-workspace&limit=100");
    expect(init.headers).toMatchObject({
      Accept: "application/json",
      Authorization: "Bearer phase-4-secret",
    });
  });

  it("routes workspace, service, and deploy inventory reads", async () => {
    vi.stubEnv("RENDER_API_KEY", "phase-4-secret");
    vi.stubEnv("RENDER_SERVICE_ID", "srv-primary");
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(async () => jsonResponse([]));
    vi.stubGlobal("fetch", fetchMock);

    await execute(renderTool(), { action: "list_workspaces", limit: 5 });
    await execute(renderTool(), { action: "get_service" });
    await execute(renderTool(), { action: "list_deploys", limit: 10 });
    await execute(renderTool(), { action: "get_deploy", deployId: "dep-current" });

    expect(fetchMock.mock.calls.map(([url]) => url)).toStrictEqual([
      "https://api.render.com/v1/owners?limit=5",
      "https://api.render.com/v1/services/srv-primary",
      "https://api.render.com/v1/services/srv-primary/deploys?limit=10",
      "https://api.render.com/v1/services/srv-primary/deploys/dep-current",
    ]);
  });

  it("reads ENV names only and updates one ENV key without replace-all", async () => {
    vi.stubEnv("RENDER_API_KEY", "phase-4-secret");
    vi.stubEnv("RENDER_SERVICE_ID", "srv-primary");
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        jsonResponse([
          { envVar: { key: "PUBLIC_NAME", value: "visible-but-sensitive" }, cursor: "next" },
          { envVar: { key: "PRIVATE_TOKEN", value: "never-return-this" } },
        ]),
      )
      .mockResolvedValueOnce(jsonResponse({ key: "FEATURE_FLAG", value: "enabled" }));
    vi.stubGlobal("fetch", fetchMock);

    const listed = await execute(renderTool(), { action: "list_env" });
    const updated = await execute(renderTool(), {
      action: "set_env",
      envKey: "FEATURE_FLAG",
      envValue: "enabled",
    });

    expect(listed).toStrictEqual({
      status: "ok",
      action: "list_env",
      data: [{ key: "PUBLIC_NAME" }, { key: "PRIVATE_TOKEN" }],
    });
    expect(JSON.stringify(listed)).not.toMatch(/visible-but-sensitive|never-return-this/u);
    expect(updated).toStrictEqual({
      status: "ok",
      action: "set_env",
      data: { key: "FEATURE_FLAG", updated: true },
    });
    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      "https://api.render.com/v1/services/srv-primary/env-vars/FEATURE_FLAG",
    );
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({
      method: "PUT",
      body: JSON.stringify({ value: "enabled" }),
    });
  });

  it("uses exact deploy, cancel, restart, and rollback operations", async () => {
    vi.stubEnv("RENDER_API_KEY", "phase-4-secret");
    vi.stubEnv("RENDER_SERVICE_ID", "srv-primary");
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockImplementation(async () => jsonResponse({ id: "operation-result" }));
    vi.stubGlobal("fetch", fetchMock);
    const commitId = "0123456789abcdef0123456789abcdef01234567";

    await execute(renderTool(), { action: "deploy_commit", commitId, clearCache: true });
    await execute(renderTool(), { action: "cancel_deploy", deployId: "dep-new" });
    await execute(renderTool(), { action: "restart_service" });
    await execute(renderTool(), { action: "rollback_service", deployId: "dep-stable" });

    expect(fetchMock.mock.calls.map(([url]) => url)).toStrictEqual([
      "https://api.render.com/v1/services/srv-primary/deploys",
      "https://api.render.com/v1/services/srv-primary/deploys/dep-new/cancel",
      "https://api.render.com/v1/services/srv-primary/restart",
      "https://api.render.com/v1/services/srv-primary/rollback",
    ]);
    expect(fetchMock.mock.calls.map(([, init]) => init?.method)).toStrictEqual([
      "POST",
      "POST",
      "POST",
      "POST",
    ]);
    expect(fetchMock.mock.calls[0]?.[1]?.body).toBe(
      JSON.stringify({ commitId, clearCache: "clear" }),
    );
    expect(fetchMock.mock.calls[3]?.[1]?.body).toBe(JSON.stringify({ deployId: "dep-stable" }));
  });

  it("rejects a non-exact commit identifier before deployment", async () => {
    vi.stubEnv("RENDER_API_KEY", "phase-4-secret");
    vi.stubEnv("RENDER_SERVICE_ID", "srv-primary");
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      execute(renderTool(), { action: "deploy_commit", commitId: "main" }),
    ).resolves.toStrictEqual({
      status: "invalid_request",
      reason: "commit-id-must-be-full-sha",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("queries bounded logs and metrics for the selected service", async () => {
    vi.stubEnv("RENDER_API_KEY", "phase-4-secret");
    vi.stubEnv("RENDER_WORKSPACE_ID", "tea-workspace");
    vi.stubEnv("RENDER_SERVICE_ID", "srv-primary");
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(async () => jsonResponse([]));
    vi.stubGlobal("fetch", fetchMock);

    await execute(renderTool(), {
      action: "logs",
      limit: 999,
      logTypes: ["app", "request"],
      logLevels: ["error"],
      text: ["gateway", "health"],
    });
    await execute(renderTool(), {
      action: "metrics",
      metric: "cpu",
      startTime: "2026-09-07T10:00:00Z",
      endTime: "2026-09-07T11:00:00Z",
      resolutionSeconds: 10,
    });

    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "https://api.render.com/v1/logs?ownerId=tea-workspace&resource=srv-primary&limit=100&direction=backward&type=app&type=request&level=error&text=gateway&text=health",
    );
    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      "https://api.render.com/v1/metrics/cpu?resource=srv-primary&startTime=2026-09-07T10%3A00%3A00Z&endTime=2026-09-07T11%3A00%3A00Z&resolutionSeconds=30",
    );
  });

  it("validates render.yaml through the non-mutating blueprint endpoint", async () => {
    vi.stubEnv("RENDER_API_KEY", "phase-4-secret");
    vi.stubEnv("RENDER_WORKSPACE_ID", "tea-workspace");
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ valid: true }));
    vi.stubGlobal("fetch", fetchMock);

    await execute(renderTool(), {
      action: "validate_blueprint",
      blueprint: "services:\n  - type: web\n",
    });

    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://api.render.com/v1/blueprints/validate");
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(init.method).toBe("POST");
    expect(init.body).toBeInstanceOf(FormData);
    const form = init.body as FormData;
    expect(form.get("ownerId")).toBe("tea-workspace");
    await expect((form.get("file") as File).text()).resolves.toBe("services:\n  - type: web\n");
  });

  it("returns a bounded API error without leaking sensitive fields", async () => {
    vi.stubEnv("RENDER_API_KEY", "phase-4-secret");
    vi.stubEnv("RENDER_SERVICE_ID", "srv-primary");
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockResolvedValue(
        jsonResponse(
          {
            message: "request rejected for Bearer phase-4-secret",
            token: "upstream-token",
            details: { password: "upstream-password" },
          },
          403,
        ),
      ),
    );

    const result = await execute(renderTool(), { action: "get_service" });

    expect(result).toStrictEqual({
      status: "error",
      reason: "render-api-error",
      httpStatus: 403,
      error: {
        message: "request rejected for Bearer [REDACTED]",
        token: "[REDACTED]",
        details: { password: "[REDACTED]" },
      },
    });
    expect(JSON.stringify(result)).not.toMatch(/phase-4-secret|upstream-token|upstream-password/u);
  });
});
