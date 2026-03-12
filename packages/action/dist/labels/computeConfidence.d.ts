import type { ProvenanceYmlConfig } from "../config/configSchema.js";
import type { SignalSource } from "@contrib-provenance/core";
export type ConfidenceLevel = "high" | "medium" | "low";
interface ConfidenceInput {
    metrics: {
        dwell_minutes: number;
        entropy_score: number;
        test_runs_total: number;
        signal_source?: SignalSource;
    };
    config: ProvenanceYmlConfig;
    verificationPassed: boolean;
    crossValidationScore?: number;
}
export declare function computeConfidence(input: ConfidenceInput): ConfidenceLevel;
export {};
//# sourceMappingURL=computeConfidence.d.ts.map