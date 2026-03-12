import type { AttestationV1, Check } from "@contrib-provenance/core";
interface VerificationContext {
    owner: string;
    repo: string;
    prNumber: number;
    commits: any[];
    octokit: any;
    prAuthor: string;
}
interface VerificationResult {
    checks: Check[];
    allPassed: boolean;
    attestation: AttestationV1;
}
export declare function verifyAttestation(attestation: AttestationV1, ctx: VerificationContext): Promise<VerificationResult>;
export declare function findAttestationInComments(comments: Array<{
    body?: string | null;
}>): AttestationV1 | null;
export {};
//# sourceMappingURL=verifyAttestation.d.ts.map