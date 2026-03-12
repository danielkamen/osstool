import type { AttestationV1 } from "@contrib-provenance/core";
import type { GitDerivedMetrics } from "@contrib-provenance/core";
export interface CrossValidationCheck {
    field: string;
    passed: boolean;
    detail: string;
}
export interface CrossValidationResult {
    checks: CrossValidationCheck[];
    allPassed: boolean;
    score: number;
}
export declare function crossValidate(attestation: AttestationV1, serverMetrics: GitDerivedMetrics): CrossValidationResult;
//# sourceMappingURL=crossValidate.d.ts.map