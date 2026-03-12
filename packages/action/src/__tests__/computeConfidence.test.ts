import { describe, it, expect } from "vitest";
import { computeConfidence } from "../labels/computeConfidence.js";
import { ProvenanceYmlSchema } from "../config/configSchema.js";

const defaultConfig = ProvenanceYmlSchema.parse({ version: 1 });

describe("computeConfidence", () => {
  it("returns low when verification fails", () => {
    const result = computeConfidence({
      metrics: { dwell_minutes: 60, entropy_score: 20, test_runs_total: 5 },
      config: defaultConfig,
      verificationPassed: false,
    });
    expect(result).toBe("low");
  });

  it("returns high with strong metrics and verification", () => {
    const result = computeConfidence({
      metrics: { dwell_minutes: 60, entropy_score: 20, test_runs_total: 5 },
      config: defaultConfig,
      verificationPassed: true,
    });
    expect(result).toBe("high");
  });

  it("returns medium with moderate metrics", () => {
    const result = computeConfidence({
      metrics: { dwell_minutes: 10, entropy_score: 3, test_runs_total: 0 },
      config: defaultConfig,
      verificationPassed: true,
    });
    expect(result).toBe("medium");
  });

  it("returns low with weak metrics", () => {
    const result = computeConfidence({
      metrics: { dwell_minutes: 1, entropy_score: 0, test_runs_total: 0 },
      config: defaultConfig,
      verificationPassed: true,
    });
    expect(result).toBe("low");
  });
});
