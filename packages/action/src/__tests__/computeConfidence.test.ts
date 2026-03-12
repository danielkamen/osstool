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

  it("returns medium for server-only single-commit PR with meaningful diff", () => {
    // Squashed single-commit PR: 0 dwell, but entropy derived from
    // file spread + diff churn should still qualify for medium
    const result = computeConfidence({
      metrics: {
        dwell_minutes: 0,
        entropy_score: 4.0,
        test_runs_total: 0,
        signal_source: "server",
      },
      config: defaultConfig,
      verificationPassed: true,
    });
    expect(result).toBe("medium");
  });

  it("returns low for server-only trivial single-file PR", () => {
    // Tiny single-file PR with minimal churn — low entropy
    const result = computeConfidence({
      metrics: {
        dwell_minutes: 0,
        entropy_score: 1.0,
        test_runs_total: 0,
        signal_source: "server",
      },
      config: defaultConfig,
      verificationPassed: true,
    });
    expect(result).toBe("low");
  });
});
