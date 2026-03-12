import type { SessionEvent, SessionMetrics } from "./types.js";
import { IDLE_THRESHOLD_MS } from "../config/defaults.js";
import { computeEntropy } from "./EntropyCalculator.js";

function isActivityEvent(event: SessionEvent): boolean {
  return (
    event.type === "file_edit" ||
    event.type === "test_run" ||
    event.type === "file_open"
  );
}

function computeDwellMs(events: SessionEvent[]): number {
  const sorted = [...events].sort((a, b) => a.timestamp - b.timestamp);
  let totalMs = 0;
  let lastActivityTs: number | null = null;
  let editorActive = true;

  for (const event of sorted) {
    if (event.type === "focus_change") {
      if (!event.editor_active) {
        editorActive = false;
        lastActivityTs = null;
      } else {
        editorActive = true;
        lastActivityTs = event.timestamp;
      }
      continue;
    }

    if (!editorActive) continue;
    if (!isActivityEvent(event)) continue;

    if (lastActivityTs !== null) {
      const gap = event.timestamp - lastActivityTs;
      if (gap < IDLE_THRESHOLD_MS) {
        totalMs += gap;
      }
    }

    lastActivityTs = event.timestamp;
  }

  return totalMs;
}

export function computeMetrics(
  events: SessionEvent[],
  sessionId: string,
): SessionMetrics {
  const sorted = [...events].sort((a, b) => a.timestamp - b.timestamp);

  // Find session boundaries
  const startEvent = sorted.find((e) => e.type === "session_start");
  const endEvent = sorted.find((e) => e.type === "session_end");

  const startedAt = startEvent
    ? new Date(startEvent.timestamp).toISOString()
    : new Date().toISOString();
  const endedAt = endEvent
    ? new Date(endEvent.timestamp).toISOString()
    : new Date().toISOString();

  // Dwell time
  const dwellMs = computeDwellMs(sorted);
  const dwellMinutes = Math.round(dwellMs / 60_000);

  // Active files
  const fileHashes = new Set<string>();
  for (const event of sorted) {
    if (event.type === "file_edit") {
      fileHashes.add(event.file_hash);
    }
  }

  // Entropy components
  const entropy = computeEntropy(sorted);

  // Editors used
  const editors = new Set<string>();
  for (const event of sorted) {
    if (
      (event.type === "session_start" || event.type === "session_end") &&
      event.editor
    ) {
      editors.add(event.editor);
    }
  }

  return {
    session_id: sessionId,
    started_at: startedAt,
    ended_at: endedAt,
    dwell_minutes: dwellMinutes,
    active_files: fileHashes.size,
    entropy_score: entropy.entropy_score,
    edit_displacement_sum: entropy.edit_displacement_sum,
    temporal_jitter_ms: entropy.temporal_jitter_ms,
    test_runs_total: entropy.test_runs_total,
    test_failures_observed: entropy.test_failures_observed,
    test_failure_ratio: entropy.test_failure_ratio,
    editors_used: [...editors],
    partial_session: false,
  };
}
