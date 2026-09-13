import { afterEach, describe, expect, it, vi } from "vitest";
import {
  initializeGlobalHookRunner,
  resetGlobalHookRunner,
} from "../plugins/hook-runner-global.js";
import { createMockPluginRegistry } from "../plugins/hooks.test-helpers.js";
import {
  authorizeMediaGenerationProviderCall,
  MediaGenerationBillingBlockedError,
} from "./billable-operation.js";

afterEach(() => {
  resetGlobalHookRunner();
});

describe("media provider billing boundary", () => {
  it("preserves native behavior when no billing hook is installed", async () => {
    await expect(
      authorizeMediaGenerationProviderCall({
        category: "image_generation",
        provider: "openai",
        model: "gpt-image-1.5",
      }),
    ).resolves.toBe(false);
  });

  it("forwards a catalog upper bound immediately before provider work", async () => {
    const handler = vi.fn(() => ({ block: false }));
    initializeGlobalHookRunner(
      createMockPluginRegistry([{ hookName: "before_billable_operation", handler }]),
    );

    await expect(
      authorizeMediaGenerationProviderCall({
        billingContext: {
          runId: "run-video",
          toolCallId: "tool-video",
          sessionKey: "agent:main:telegram:direct:200",
        },
        category: "video_generation",
        provider: "openrouter",
        model: "google/veo-3.1",
        costUpperBoundUsd: 0.5,
      }),
    ).resolves.toBe(true);
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        runId: "run-video",
        toolCallId: "tool-video",
        costUpperBound: { totalUsd: 0.5, evidence: "catalog-upper-bound" },
      }),
      expect.objectContaining({ sessionKey: "agent:main:telegram:direct:200" }),
    );
  });

  it("throws before provider work when the billing hook blocks", async () => {
    initializeGlobalHookRunner(
      createMockPluginRegistry([
        {
          hookName: "before_billable_operation",
          handler: () => ({ block: true, blockReason: "maximum cost unavailable" }),
        },
      ]),
    );

    await expect(
      authorizeMediaGenerationProviderCall({
        category: "music_generation",
        provider: "google",
        model: "lyria",
      }),
    ).rejects.toEqual(
      expect.objectContaining<Partial<MediaGenerationBillingBlockedError>>({
        name: "MediaGenerationBillingBlockedError",
        message: "maximum cost unavailable",
      }),
    );
  });
});
