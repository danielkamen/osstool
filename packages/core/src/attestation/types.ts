export type SigningMethod = "gpg" | "ssh";

export interface AttestationV1 {
  schema: "contribution-provenance/v1";
  repo: string;
  commit: string;
  identity: string;
  session: {
    session_id: string;
    started_at: string;
    ended_at: string;
    dwell_minutes: number;
    active_files: number;
    iteration_cycles: number;
    post_insert_edit_ratio: number;
    test_runs_observed: number;
    largest_paste_lines: number;
    paste_burst_count: number;
    editors_used: string[];
    partial_session: boolean;
  };
  disclosure: string | null;
  tool_version: string;
  timestamp: string;
  signature: string;
  signature_format: SigningMethod;
}

export interface Check {
  name: string;
  passed: boolean;
  detail?: string;
}

export interface VerificationResult {
  checks: Check[];
  allPassed: boolean;
  attestation: AttestationV1;
}
