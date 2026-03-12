import { describe, it, expect } from "vitest";
import { ProvenanceYmlSchema } from "../config/configSchema.js";

describe("ProvenanceYmlSchema", () => {
  it("parses minimal valid config", () => {
    const result = ProvenanceYmlSchema.parse({ version: 1 });
    expect(result.version).toBe(1);
    expect(result.mode).toBe("internal");
    expect(result.require_attestation).toBe(false);
  });

  it("applies default label names", () => {
    const result = ProvenanceYmlSchema.parse({ version: 1 });
    expect(result.labels.high).toBe("provenance-high");
    expect(result.labels.medium).toBe("provenance-medium");
    expect(result.labels.low).toBe("provenance-low");
  });

  it("applies default signal thresholds", () => {
    const result = ProvenanceYmlSchema.parse({ version: 1 });
    expect(result.signals.min_dwell_minutes).toBe(10);
    expect(result.signals.min_entropy_score).toBe(5.0);
  });

  it("rejects invalid version", () => {
    expect(() => ProvenanceYmlSchema.parse({ version: 2 })).toThrow();
  });

  it("allows oss mode", () => {
    const result = ProvenanceYmlSchema.parse({ version: 1, mode: "oss" });
    expect(result.mode).toBe("oss");
  });
});
