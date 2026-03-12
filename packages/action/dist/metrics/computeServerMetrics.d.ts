import type { GitDerivedMetrics } from "@contrib-provenance/core";
export interface ServerMetricsInput {
    commits: Array<{
        sha: string;
        commit: {
            author: {
                date?: string;
            } | null;
            committer: {
                date?: string;
            } | null;
        };
    }>;
    files: Array<{
        filename: string;
        additions: number;
        deletions: number;
    }>;
}
export declare function computeServerMetrics(input: ServerMetricsInput): GitDerivedMetrics;
//# sourceMappingURL=computeServerMetrics.d.ts.map