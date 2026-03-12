import { describe, it, expect } from "vitest";
import { formatInspect, formatSessionList } from "../output/formatInspect.js";
import type { SessionMeta, SessionMetrics, SessionEvent } from "@contrib-provenance/core";

const meta: SessionMeta = {
  session_id: "test-session-id",
  status: "ended",
  started_at: "2024-01-15T09:00:00.000Z",
  ended_at: "2024-01-15T10:00:00.000Z",
  editor: "vscode",
  tool_version: "0.1.0",
  repo_remote: "https://github.com/test/repo",
  head_at_start: "abc123",
};

const metrics: SessionMetrics = {
  session_id: "test-session-id",
  started_at: "2024-01-15T09:00:00.000Z",
  ended_at: "2024-01-15T10:00:00.000Z",
  dwell_minutes: 45,
  active_files: 3,
  entropy_score: 12.5,
  edit_displacement_sum: 100,
  temporal_jitter_ms: 5000,
  test_runs_total: 4,
  test_failures_observed: 1,
  test_failure_ratio: 0.25,
  editors_used: ["vscode"],
  partial_session: false,
};

describe("formatInspect", () => {
  it("includes session id", () => {
    const output = formatInspect(meta, metrics, []);
    expect(output).toContain("test-session-id");
  });

  it("includes entropy score", () => {
    const output = formatInspect(meta, metrics, []);
    expect(output).toContain("12.5");
  });

  it("includes dwell minutes", () => {
    const output = formatInspect(meta, metrics, []);
    expect(output).toContain("45 minutes");
  });

  it("shows events in timeline", () => {
    const events: SessionEvent[] = [
      { type: "session_start", timestamp: 1000, session_id: "s1", tool_version: "0.1.0", editor: "vscode" },
    ];
    const output = formatInspect(meta, metrics, events);
    expect(output).toContain("Session started");
  });
});

describe("formatSessionList", () => {
  it("returns message for empty list", () => {
    expect(formatSessionList([])).toBe("No sessions found.");
  });

  it("includes session info for non-empty list", () => {
    const output = formatSessionList([meta]);
    expect(output).toContain("test-session-id");
    expect(output).toContain("ended");
  });
});
