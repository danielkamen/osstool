import type { Check, AttestationV1 } from "@contrib-provenance/core";
import type { GitDerivedMetrics } from "@contrib-provenance/core";
import type { ConfidenceLevel } from "./computeConfidence.js";
import type { ProvenanceYmlConfig } from "../config/configSchema.js";
interface RenderInput {
    checks: Check[];
    allPassed: boolean;
    attestation: AttestationV1;
}
export declare function renderComment(result: RenderInput, confidence: ConfidenceLevel, _config: ProvenanceYmlConfig, serverMetrics?: GitDerivedMetrics | null): string;
export declare function renderServerOnlyReport(serverMetrics: GitDerivedMetrics, confidence: ConfidenceLevel): string;
export declare function renderReminder(_config: ProvenanceYmlConfig): string;
export declare function upsertSummaryComment(octokit: any, owner: string, repo: string, prNumber: number, body: string): Promise<void>;
export declare function applyLabel(octokit: any, owner: string, repo: string, prNumber: number, label: string): Promise<void>;
export {};
//# sourceMappingURL=renderComment.d.ts.map