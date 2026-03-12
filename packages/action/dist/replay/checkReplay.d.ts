interface ReplayResult {
    isReplay: boolean;
    detail?: string;
}
export declare function checkReplay(octokit: any, owner: string, repo: string, prNumber: number, sessionId: string): Promise<ReplayResult>;
export {};
//# sourceMappingURL=checkReplay.d.ts.map