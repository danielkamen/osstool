import type { AttestationV1 } from "@contrib-provenance/core";
export declare function readProvenanceNote(octokit: any, owner: string, repo: string, headSha: string): Promise<AttestationV1 | null>;
export declare function findAttestation(octokit: any, owner: string, repo: string, prNumber: number, headSha: string): Promise<AttestationV1 | null>;
//# sourceMappingURL=readProvenanceNote.d.ts.map