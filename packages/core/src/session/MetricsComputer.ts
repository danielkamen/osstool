import type { SessionEvent, SessionMetrics } from "./types.js";
import { IDLE_THRESHOLD_MS, POST_INSERT_BUCKET_SIZE } from "../config/defaults.js";
import { detectIterationCycles } from "./IterationDetector.js";

function isActivityEvent(event: SessionEvent): boolean {
  return (
    event.type === "file_edit" ||
    event.type === "paste_burst" ||
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

function computePostInsertEditRatio(events: SessionEvent[]): number {
  const insertedBuckets = new Map<string, Set<number>>();
  const editedBuckets = new Set<string>();
  let totalInsertedBucketCount = 0;

  const sorted = [...events].sort((a, b) => a.timestamp - b.timestamp);

  for (const event of sorted) {
    if (event.type !== "file_edit") continue;

    const fileHash = event.file_hash;

    // Track insertions
    if (event.lines_inserted > 0) {
      if (!insertedBuckets.has(fileHash)) {
        insertedBuckets.set(fileHash, new Set());
      }
      // Use bucket 0 as default since we don't have exact line numbers in events
      const bucket = 0;
      if (!insertedBuckets.get(fileHash)!.has(bucket)) {
        insertedBuckets.get(fileHash)!.add(bucket);
        totalInsertedBucketCount++;
      }
    }

    // Check for post-insert edits
    if (event.is_post_insert_edit) {
      editedBuckets.add(`${fileHash}:0`);
    }
  }

  if (totalInsertedBucketCount === 0) return 0;
  return editedBuckets.size / totalInsertedBucketCount;
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
    if (event.type === "file_edit" && "file_hash" in event) {
      fileHashes.add(event.file_hash);
    }
  }

  // Iteration cycles
  const iterationCycles = detectIterationCycles(sorted);

  // Post-insert edit ratio
  const postInsertEditRatio = computePostInsertEditRatio(sorted);

  // Test runs
  const testRuns = sorted.filter((e) => e.type === "test_run").length;

  // Paste stats
  const pasteEvents = sorted.filter((e) => e.type === "paste_burst");
  const largestPasteLines =
    pasteEvents.length > 0
      ? Math.max(...pasteEvents.map((e) => (e as { line_count: number }).line_count))
      : 0;

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
    iteration_cycles: iterationCycles,
    post_insert_edit_ratio: Math.round(postInsertEditRatio * 100) / 100,
    test_runs_observed: testRuns,
    largest_paste_lines: largestPasteLines,
    paste_burst_count: pasteEvents.length,
    editors_used: [...editors],
    partial_session: false,
  };
}
