import { describe, it, expect } from "vitest";
import { computeEntropy } from "../session/EntropyCalculator.js";
import type { SessionEvent, FileEditEvent, TestRunEvent } from "../session/types.js";

function edit(timestamp: number, line: number, inserted = 1, deleted = 0): FileEditEvent {
  return {
    type: "file_edit",
    timestamp,
    file_hash: "abc123",
    line,
    lines_inserted: inserted,
    lines_deleted: deleted,
  };
}

function testRun(timestamp: number, passed: boolean | null): TestRunEvent {
  return { type: "test_run", timestamp, command_type: "test", passed };
}

describe("computeEntropy", () => {
  it("returns zero entropy for empty events", () => {
    const result = computeEntropy([]);
    expect(result.entropy_score).toBe(0);
    expect(result.edit_displacement_sum).toBe(0);
    expect(result.temporal_jitter_ms).toBe(0);
    expect(result.test_failure_ratio).toBe(0);
  });

  it("returns zero entropy for a single edit", () => {
    const result = computeEntropy([edit(1000, 10)]);
    expect(result.entropy_score).toBe(0);
    expect(result.edit_displacement_sum).toBe(0);
  });

  it("computes displacement from consecutive edits", () => {
    const events: SessionEvent[] = [
      edit(1000, 10),
      edit(2000, 20),
      edit(3000, 5),
    ];
    const result = computeEntropy(events);
    // |20-10| + |5-20| = 10 + 15 = 25
    expect(result.edit_displacement_sum).toBe(25);
  });

  it("tracks test failure ratio", () => {
    const events: SessionEvent[] = [
      testRun(1000, true),
      testRun(2000, false),
      testRun(3000, false),
    ];
    const result = computeEntropy(events);
    expect(result.test_runs_total).toBe(3);
    expect(result.test_failures_observed).toBe(2);
    expect(result.test_failure_ratio).toBeCloseTo(0.67, 1);
  });

  it("ignores null test results for failure count", () => {
    const events: SessionEvent[] = [
      testRun(1000, null),
      testRun(2000, true),
    ];
    const result = computeEntropy(events);
    expect(result.test_runs_total).toBe(2);
    expect(result.test_failures_observed).toBe(0);
  });

  it("increases score with test failures", () => {
    const edits: SessionEvent[] = [
      edit(1000, 10, 2, 1),
      edit(3000, 50, 3, 0),
      edit(8000, 10, 1, 1),
    ];
    const withoutFailures = computeEntropy(edits);
    const withFailures = computeEntropy([
      ...edits,
      testRun(10000, false),
    ]);
    // Varying gaps (2000, 5000) give nonzero jitter, so base score > 0
    // Adding a failure boosts score by (1 + failureRatio)
    expect(withoutFailures.entropy_score).toBeGreaterThan(0);
    expect(withFailures.entropy_score).toBeGreaterThan(withoutFailures.entropy_score);
  });
});
