import type { AttestationV1 } from "@contrib-provenance/core";
type Octokit = any;
interface SignatureResult {
    valid: boolean;
    detail?: string;
}
export declare function verifySignature(attestation: AttestationV1, octokit: Octokit, prAuthor: string): Promise<SignatureResult>;
export {};
//# sourceMappingURL=verifySignature.d.ts.map