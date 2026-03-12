export interface FileEditEvent {
  type: "file_edit";
  timestamp: number;
  file_hash: string;
  lines_inserted: number;
  lines_deleted: number;
  is_post_insert_edit: boolean;
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

export interface PasteBurstEvent {
  type: "paste_burst";
  timestamp: number;
  file_hash: string;
  line_count: number;
}

export interface TestRunEvent {
  type: "test_run";
  timestamp: number;
  command_type: "test" | "lint" | "build" | "typecheck";
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
  | PasteBurstEvent
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

export interface SessionMetrics {
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
}
