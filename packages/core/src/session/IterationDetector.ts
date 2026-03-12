import type { SessionEvent } from "./types.js";
import { SEGMENT_GAP_MS, ITERATION_GAP_MS, ITERATION_BUCKET_SIZE } from "../config/defaults.js";

interface EditSegment {
  startTime: number;
  endTime: number;
  regions: Set<string>; // "fileHash:bucketIndex"
}

function isActivityEvent(event: SessionEvent): boolean {
  return (
    event.type === "file_edit" ||
    event.type === "file_open" ||
    event.type === "paste_burst"
  );
}

function getFileHash(event: SessionEvent): string | null {
  if ("file_hash" in event) return event.file_hash;
  return null;
}

function getLineBucket(event: SessionEvent): number {
  // For edit events, we approximate using a 50-line window at position 0
  // since we don't track exact line numbers in the event model.
  // The bucket is based on the file_hash grouping.
  return 0;
}

export function detectIterationCycles(events: SessionEvent[]): number {
  const sorted = [...events].sort((a, b) => a.timestamp - b.timestamp);

  // Build editing segments: contiguous periods of edit activity with gaps < SEGMENT_GAP_MS
  const segments: EditSegment[] = [];
  let currentSegment: EditSegment | null = null;

  for (const event of sorted) {
    if (!isActivityEvent(event) && event.type !== "test_run") continue;

    if (event.type === "test_run") {
      // Test runs create a natural segment boundary
      if (currentSegment) {
        currentSegment.endTime = event.timestamp;
        segments.push(currentSegment);
        currentSegment = null;
      }
      continue;
    }

    const fileHash = getFileHash(event);
    if (!fileHash) continue;

    const regionKey = `${fileHash}:${getLineBucket(event)}`;

    if (!currentSegment) {
      currentSegment = {
        startTime: event.timestamp,
        endTime: event.timestamp,
        regions: new Set([regionKey]),
      };
    } else if (event.timestamp - currentSegment.endTime >= SEGMENT_GAP_MS) {
      // Gap too large, start new segment
      segments.push(currentSegment);
      currentSegment = {
        startTime: event.timestamp,
        endTime: event.timestamp,
        regions: new Set([regionKey]),
      };
    } else {
      currentSegment.endTime = event.timestamp;
      currentSegment.regions.add(regionKey);
    }
  }

  if (currentSegment) {
    segments.push(currentSegment);
  }

  if (segments.length <= 1) return 0;

  // Count iteration cycles: when a segment revisits regions from previous segments
  // after a meaningful gap (>= ITERATION_GAP_MS)
  let cycles = 0;
  const previousRegions = new Set<string>();

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];

    if (i === 0) {
      // First segment: just record regions
      for (const region of segment.regions) {
        previousRegions.add(region);
      }
      continue;
    }

    // Check if this segment revisits any previous region
    const gap = segment.startTime - segments[i - 1].endTime;
    if (gap >= ITERATION_GAP_MS) {
      let revisits = false;
      for (const region of segment.regions) {
        if (previousRegions.has(region)) {
          revisits = true;
          break;
        }
      }
      if (revisits) {
        cycles++;
      }
    }

    // Add this segment's regions to the cumulative set
    for (const region of segment.regions) {
      previousRegions.add(region);
    }
  }

  return cycles;
}
