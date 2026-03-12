export interface FileEditEvent {
  type: "file_edit";
  timestamp: number;
  file_hash: string;
  line: number;
  lines_inserted: number;
  lines_deleted: number;
}

export interface FileOpenEvent {
  type: "file_open";
  timestamp: number;
  file_hash: string;
}

export interface FileCloseEvent {
  type: "file_close";
  timestamp: number;
  file_hash: string;
}

export interface TestRunEvent {
  type: "test_run";
  timestamp: number;
  command_type: "test" | "lint" | "build" | "typecheck";
  passed: boolean | null;
}

export interface FocusChangeEvent {
  type: "focus_change";
  timestamp: number;
  editor_active: boolean;
}

export interface SessionBoundaryEvent {
  type: "session_start" | "session_end";
  timestamp: number;
  session_id: string;
  tool_version: string;
  editor?: string;
}

export type SessionEvent =
  | FileEditEvent
  | FileOpenEvent
  | FileCloseEvent
  | TestRunEvent
  | FocusChangeEvent
  | SessionBoundaryEvent;

export type SessionStatus = "active" | "ended" | "exported";

export interface SessionMeta {
  session_id: string;
  status: SessionStatus;
  started_at: string;
  ended_at: string | null;
  editor: string | null;
  tool_version: string;
  repo_remote: string;
  head_at_start: string;
  companion_of?: string | null;
  continues_from?: string | null;
}

export interface CheckpointResult {
  endedSessionId: string;
  metrics: SessionMetrics;
  newSessionId: string;
}

export type SignalSource = "vscode" | "git" | "hybrid" | "server";

export interface SessionMetrics {
  session_id: string;
  started_at: string;
  ended_at: string;
  dwell_minutes: number;
  active_files: number;
  entropy_score: number;
  edit_displacement_sum: number;
  temporal_jitter_ms: number;
  test_runs_total: number;
  test_failures_observed: number;
  test_failure_ratio: number;
  editors_used: string[];
  partial_session: boolean;
  signal_source?: SignalSource;
}

export interface GitDerivedMetrics {
  signal_source: "git";
  dwell_minutes: number;
  active_files: number;
  commit_count: number;
  diff_churn: number;
  entropy_score: number;
  commit_temporal_jitter_ms: number;
  editors_used: string[];
}

export type ProvenanceMetrics = SessionMetrics | GitDerivedMetrics;
