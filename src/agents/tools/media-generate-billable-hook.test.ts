import { describe, expect, it } from "vitest";
import { readMediaGenerationBilling } from "./media-generate-billable-hook.js";

describe("readMediaGenerationBilling", () => {
  it("forwards normalized provider-billed cost and usage", () => {
    expect(
      readMediaGenerationBilling({
        billing: {
          cost: { totalUsd: 0.25, evidence: "provider-billed" },
          usage: { input: 10, output: 20, total: 30 },
        },
      }),
    ).toEqual({
      cost: { totalUsd: 0.25, evidence: "provider-billed" },
      usage: { input: 10, output: 20, total: 30 },
    });
  });

  it("rejects malformed or unproven billing metadata", () => {
    expect(
      readMediaGenerationBilling({
        billing: { cost: { totalUsd: "0.25", evidence: "provider-billed" } },
      }),
    ).toEqual({});
    expect(
      readMediaGenerationBilling({
        billing: { cost: { totalUsd: 0.25, evidence: "guessed" } },
      }),
    ).toEqual({});
  });
});
