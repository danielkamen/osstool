interface CommitData {
    sha: string;
    commit: {
        author: {
            email: string | null;
        } | null;
        committer: {
            date: string;
        } | null;
    };
}
export declare function verifyIdentity(attestationIdentity: string, commits: CommitData[]): boolean;
export declare function verifyCommitBinding(attestationCommit: string, commits: CommitData[]): boolean;
export declare function checkFreshness(attestationTimestamp: string, attestationCommit: string, commits: CommitData[]): boolean;
export {};
//# sourceMappingURL=verifyIdentity.d.ts.map