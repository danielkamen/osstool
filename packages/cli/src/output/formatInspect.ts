import type { SessionMetrics, SessionMeta, SessionEvent } from "@contrib-provenance/core";
import { formatTimestamp } from "@contrib-provenance/core";

function line(content: string, width: number): string {
  return `│  ${content.padEnd(width - 4)}│`;
}

function separator(width: number): string {
  return `├${"─".repeat(width - 2)}┤`;
}

export function formatInspect(
  meta: SessionMeta,
  metrics: SessionMetrics,
  events: SessionEvent[],
): string {
  const w = 52;
  const lines: string[] = [];

  lines.push(`┌${"─".repeat(w - 2)}┐`);
  lines.push(line("Contribution Provenance — Session Inspect", w));
  lines.push(separator(w));
  lines.push(line(`Session:    ${meta.session_id}`, w));
  lines.push(line(`Status:     ${meta.status}`, w));
  lines.push(line(`Started:    ${meta.started_at}`, w));
  lines.push(line(`Ended:      ${meta.ended_at ?? "—"}`, w));
  lines.push(separator(w));
  lines.push(line("METRICS (these will appear in the attestation)", w));
  lines.push(line("", w));
  lines.push(line(`Active editing time:      ${metrics.dwell_minutes} minutes`, w));
  lines.push(line(`Files edited:             ${metrics.active_files}`, w));
  lines.push(line(`Iteration cycles:         ${metrics.iteration_cycles}`, w));
  lines.push(line(`Post-insert edit ratio:   ${Math.round(metrics.post_insert_edit_ratio * 100)}%`, w));
  lines.push(line(`Test runs observed:       ${metrics.test_runs_observed}`, w));
  lines.push(line(`Largest paste burst:      ${metrics.largest_paste_lines} lines`, w));
  lines.push(line(`Total paste events:       ${metrics.paste_burst_count}`, w));
  lines.push(separator(w));
  lines.push(line("EVENT TIMELINE (never uploaded)", w));
  lines.push(line("", w));

  const sorted = [...events].sort((a, b) => a.timestamp - b.timestamp);
  for (const event of sorted.slice(0, 20)) {
    const time = formatTimestamp(new Date(event.timestamp).toISOString());
    const desc = formatEvent(event);
    if (desc) {
      lines.push(line(`${time}  ${desc}`, w));
    }
  }

  if (sorted.length > 20) {
    lines.push(line(`... and ${sorted.length - 20} more events`, w));
  }

  lines.push(separator(w));
  lines.push(line("This is YOUR data. Review before exporting.", w));
  lines.push(line("Run `provenance export` to sign and package.", w));
  lines.push(`└${"─".repeat(w - 2)}┘`);

  return lines.join("\n");
}

function formatEvent(event: SessionEvent): string | null {
  switch (event.type) {
    case "session_start":
      return `Session started${event.editor ? ` (${event.editor})` : ""}`;
    case "session_end":
      return "Session ended";
    case "file_open":
      return `Opened file [hash:${event.file_hash.slice(0, 8)}...]`;
    case "file_edit": {
      const marker = event.is_post_insert_edit ? " (*)" : "";
      return `Edited file [hash:${event.file_hash.slice(0, 8)}...] +${event.lines_inserted} -${event.lines_deleted}${marker}`;
    }
    case "paste_burst":
      return `Pasted ${event.line_count} lines in [hash:${event.file_hash.slice(0, 8)}...]`;
    case "test_run":
      return `Test run detected (${event.command_type})`;
    case "focus_change":
      return event.editor_active ? "Editor gained focus" : "Editor lost focus";
    default:
      return null;
  }
}

export function formatSessionList(sessions: SessionMeta[]): string {
  if (sessions.length === 0) return "No sessions found.";

  const header = "SESSION ID                                STATUS    EDITOR     STARTED";
  const lines = [header, "─".repeat(header.length)];

  for (const s of sessions) {
    const id = s.session_id.padEnd(38);
    const status = s.status.padEnd(10);
    const editor = (s.editor ?? "—").padEnd(11);
    const started = s.started_at;
    lines.push(`${id}${status}${editor}${started}`);
  }

  return lines.join("\n");
}
