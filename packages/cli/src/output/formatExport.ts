import type { AttestationV1 } from "@contrib-provenance/core";

export function formatExport(attestation: AttestationV1): string {
  const lines: string[] = [];

  lines.push("═══ READY TO UPLOAD ═══");
  lines.push("");
  lines.push(`Schema:        ${attestation.schema}`);
  lines.push(`Repo:          ${attestation.repo}`);
  lines.push(`Commit:        ${attestation.commit}`);
  lines.push(`Identity:      ${attestation.identity.slice(0, 16)}...`);
  lines.push(`Signature:     ${attestation.signature_format ? attestation.signature_format.toUpperCase() + " \u2713" : "unsigned"}`);
  lines.push("");
  lines.push("Session Metrics:");
  lines.push(`  Active editing time:    ${attestation.session.dwell_minutes} min`);
  lines.push(`  Files edited:           ${attestation.session.active_files}`);
  lines.push(`  Entropy score:          ${attestation.session.entropy_score}`);
  lines.push(`  Edit displacement:      ${attestation.session.edit_displacement_sum}`);
  lines.push(`  Temporal jitter:        ${attestation.session.temporal_jitter_ms} ms`);
  lines.push(`  Test runs:              ${attestation.session.test_runs_total} (${attestation.session.test_failures_observed} failed)`);
  lines.push(`  Editors used:           ${attestation.session.editors_used.join(", ") || "unknown"}`);
  lines.push("");

  if (attestation.disclosure) {
    lines.push(`AI Disclosure: ${attestation.disclosure}`);
    lines.push("");
  }

  lines.push(`Attestation saved. Run \`provenance attach <PR>\` to upload.`);

  return lines.join("\n");
}

export function formatUnsignedExport(attestation: object): string {
  const lines: string[] = [];
  lines.push("═══ UNSIGNED ATTESTATION ═══");
  lines.push("");
  lines.push(JSON.stringify(attestation, null, 2));
  lines.push("");
  lines.push("Warning: This attestation is unsigned and cannot be verified.");
  lines.push("Run `provenance export` without --no-sign to create a signed attestation.");
  return lines.join("\n");
}
