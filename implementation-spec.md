## Context

This document is the complete, ground-up implementation specification for Contribution Provenance — a three-layer open-source toolchain (CLI + editor plugins, signed attestation format, GitHub Action) that helps PR reviewers gauge whether a human meaningfully engaged with a codebase. The design doc lives at `/home/dan/osstool/contribution-provenance-v2.md`. This spec covers every phase from `mkdir` to production-ready v1.0 — stopping right before the education wedge (v1.5). The goal: a developer should be able to build this project from this document alone without asking clarifying questions.

---

# Contribution Provenance: Complete Implementation Specification (v0.1 through v1.0)

---

## 1. MONOREPO STRUCTURE AND TECH STACK

### 1.1 Language Choice: TypeScript (Node.js)

**Justification:**
- The CLI ships via `npm install -g`, the VS Code extension is TypeScript-native, and the GitHub Action runs on Node.js. Using one language across all three components maximizes shared code (crypto, schema validation, attestation generation).
- JetBrains plugins require JVM (Kotlin), but the core logic can be invoked via a bundled CLI binary or a thin JSON-RPC bridge.
- TypeScript provides strong typing for the attestation schema and configuration, which is critical for a security-sensitive tool.

### 1.2 Monorepo Layout

```
contribution-provenance/
├── package.json                          # Workspace root (npm workspaces)
├── tsconfig.base.json                    # Shared TS config
├── turbo.json                            # Turborepo build orchestration
├── .github/
│   ├── workflows/
│   │   ├── ci.yml                        # Lint + test + build all packages
│   │   ├── release-cli.yml               # npm publish for CLI
│   │   ├── release-vscode.yml            # vsce package + marketplace publish
│   │   ├── release-jetbrains.yml         # Gradle build + marketplace publish
│   │   └── release-action.yml            # Compile via ncc + push to action repo
│   └── provenance.yml                    # Dogfood: our own provenance config
├── packages/
│   ├── core/                             # @contrib-provenance/core
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── index.ts                  # Public API barrel export
│   │       ├── session/
│   │       │   ├── SessionManager.ts     # Session lifecycle (start/end/resume)
│   │       │   ├── EventAccumulator.ts   # Aggregates raw events into metrics
│   │       │   ├── MetricsComputer.ts    # Computes final attestation metrics
│   │       │   ├── IterationDetector.ts  # Detects distinct revision phases
│   │       │   ├── PasteDetector.ts      # Detects and measures paste bursts
│   │       │   └── types.ts              # All session-related types
│   │       ├── attestation/
│   │       │   ├── AttestationBuilder.ts # Builds attestation JSON from metrics
│   │       │   ├── AttestationSchema.ts  # Zod schema + JSON Schema export
│   │       │   ├── AttestationSigner.ts  # Signs attestation (GPG/SSH)
│   │       │   ├── AttestationVerifier.ts# Verifies signatures
│   │       │   └── types.ts
│   │       ├── storage/
│   │       │   ├── SessionStore.ts       # Reads/writes session files to disk
│   │       │   ├── ConfigStore.ts        # Reads .provenance/config.json
│   │       │   └── paths.ts             # Standard path resolution
│   │       ├── crypto/
│   │       │   ├── identity.ts           # Git identity discovery + SHA256 hash
│   │       │   ├── gpg.ts               # GPG sign/verify via CLI shelling
│   │       │   ├── ssh.ts               # SSH sign/verify via ssh-keygen
│   │       │   └── keyDiscovery.ts      # Detect signing key from git config
│   │       ├── config/
│   │       │   ├── ProjectConfig.ts     # .provenance/config.json schema + loader
│   │       │   ├── GlobalConfig.ts      # ~/.config/provenance/config.json
│   │       │   └── defaults.ts          # All default values
│   │       └── util/
│   │           ├── git.ts               # Git operations (identity, remote, HEAD SHA)
│   │           ├── hash.ts              # SHA256 helper
│   │           └── time.ts              # Timestamp formatting
│   ├── cli/                              # @contrib-provenance/cli
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── index.ts                  # Entry point, yargs setup
│   │       ├── commands/
│   │       │   ├── init.ts
│   │       │   ├── session.ts            # start / end subcommands
│   │       │   ├── inspect.ts
│   │       │   ├── export.ts
│   │       │   └── attach.ts
│   │       ├── hooks/
│   │       │   └── pre-push.ts          # Git hook script template
│   │       └── output/
│   │           ├── formatInspect.ts     # Plain-text session renderer
│   │           └── formatExport.ts      # Attestation preview renderer
│   ├── vscode/                           # contrib-provenance-vscode (extension)
│   │   ├── package.json                  # VS Code extension manifest
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── extension.ts              # activate() / deactivate()
│   │       ├── SessionTracker.ts         # Document change listener, focus tracking
│   │       ├── PasteInterceptor.ts       # Detects paste via change event heuristics
│   │       ├── TestRunWatcher.ts         # Watches terminal + task runner for test cmds
│   │       ├── StatusBarController.ts    # Status bar item rendering
│   │       ├── CommandRegistrar.ts       # VS Code command palette commands
│   │       └── EditorBridge.ts           # Translates VS Code events → core event types
│   ├── jetbrains/                        # contrib-provenance-jetbrains (IntelliJ plugin)
│   │   ├── build.gradle.kts
│   │   ├── settings.gradle.kts
│   │   ├── gradle.properties
│   │   └── src/main/kotlin/
│   │       └── com/contribprovenance/
│   │           ├── ProvenancePlugin.kt           # Plugin entry point
│   │           ├── SessionTrackerService.kt      # Application-level service
│   │           ├── DocumentChangeListener.kt     # Bulk file change listener
│   │           ├── PasteHandler.kt               # EditorActionHandler for paste
│   │           ├── TerminalWatcher.kt            # Terminal output listener
│   │           ├── StatusBarWidget.kt            # Status bar widget factory
│   │           ├── CliBridge.kt                  # Invokes CLI binary as subprocess
│   │           └── SessionMerger.kt              # Multi-editor session merge logic
│   └── action/                            # @contrib-provenance/action (GitHub Action)
│       ├── action.yml                     # GitHub Action metadata
│       ├── package.json
│       ├── tsconfig.json
│       └── src/
│           ├── index.ts                   # Action entry point (using @actions/core, @actions/github)
│           ├── verification/
│           │   ├── verifyAttestation.ts   # Full verification pipeline
│           │   ├── verifySignature.ts     # Crypto signature check
│           │   └── verifyIdentity.ts      # Match attestation identity to commit author
│           ├── labels/
│           │   ├── computeConfidence.ts   # Confidence label computation
│           │   └── renderComment.ts       # Markdown comment renderer
│           ├── config/
│           │   ├── loadRepoConfig.ts      # Reads .github/provenance.yml from checkout
│           │   └── configSchema.ts        # Zod schema for provenance.yml
│           └── replay/
│               └── checkReplay.ts         # Uses GitHub API search for replay detection
└── docs/
    ├── spec/
    │   └── attestation-v1.schema.json   # Canonical JSON Schema
    ├── guides/
    │   ├── contributor-quickstart.md
    │   └── maintainer-setup.md
    └── privacy.md
```

### 1.3 Package Manager and Build

- **npm workspaces** for monorepo linking. `package.json` at root with `"workspaces": ["packages/*"]`.
- **Turborepo** for build orchestration: `turbo run build` builds all packages respecting dependency graph.
- **tsup** (esbuild-based bundler) for CLI and core packages. Fast, zero-config for library bundling.
- **esbuild** via `@vscode/vsce` for VS Code extension bundling.
- **Gradle + IntelliJ Platform Plugin** for JetBrains.
- **@vercel/ncc** for compiling the GitHub Action into a single `dist/index.js` file (standard practice for GitHub Actions).

### 1.4 Key Dependencies

| Package | Purpose | Used In |
|---------|---------|---------|
| `yargs` | CLI argument parsing | cli |
| `zod` | Schema validation for attestation + config | core, action |
| `@actions/core` | GitHub Actions toolkit — logging, inputs, outputs | action |
| `@actions/github` | GitHub Actions toolkit — authenticated Octokit client | action |
| `@vercel/ncc` | Compiles Action + all deps into single JS file | action (build) |
| `@vscode/vscode` (types) | VS Code extension API | vscode |
| `chalk` | Terminal coloring | cli |
| `ora` | Spinners for CLI | cli |
| `semver` | Version comparison for migrations | core |

---

## 2. DATA MODELS AND SCHEMAS

### 2.1 Raw Session Event (Internal, Never Exported)

These are the events the session agent records locally. They are stored in a binary-friendly NDJSON (newline-delimited JSON) file. They are NEVER included in attestations -- only the computed aggregates are.

```typescript
// packages/core/src/session/types.ts

/** Discriminated union of all trackable events */
type SessionEvent =
  | FileEditEvent
  | FileOpenEvent
  | FileCloseEvent
  | PasteBurstEvent
  | TestRunEvent
  | FocusChangeEvent
  | SessionBoundaryEvent;

interface FileEditEvent {
  type: "file_edit";
  timestamp: number;          // Unix ms
  file_hash: string;          // SHA256 of relative file path (not content)
  lines_inserted: number;
  lines_deleted: number;
  is_post_insert_edit: boolean; // true if editing a region inserted earlier this session
}

interface FileOpenEvent {
  type: "file_open";
  timestamp: number;
  file_hash: string;
}

interface FileCloseEvent {
  type: "file_close";
  timestamp: number;
  file_hash: string;
}

interface PasteBurstEvent {
  type: "paste_burst";
  timestamp: number;
  file_hash: string;
  line_count: number;          // Approximate lines pasted
}

interface TestRunEvent {
  type: "test_run";
  timestamp: number;
  command_type: "test" | "lint" | "build" | "typecheck";
  // No command arguments stored, ever
}

interface FocusChangeEvent {
  type: "focus_change";
  timestamp: number;
  editor_active: boolean;      // true = editor gained focus, false = lost
}

interface SessionBoundaryEvent {
  type: "session_start" | "session_end";
  timestamp: number;
  session_id: string;          // UUIDv4
  tool_version: string;
  editor?: string;             // "vscode" | "jetbrains" | "cli" | undefined
}
```

### 2.2 Computed Session Metrics

```typescript
// packages/core/src/session/types.ts

interface SessionMetrics {
  session_id: string;
  started_at: string;          // ISO 8601
  ended_at: string;            // ISO 8601
  dwell_minutes: number;       // Active editing time (not wall clock)
  active_files: number;        // Unique file hashes with edit events
  iteration_cycles: number;    // Distinct revision phases
  post_insert_edit_ratio: number; // 0.0 to 1.0
  test_runs_observed: number;
  largest_paste_lines: number;
  paste_burst_count: number;
  editors_used: string[];      // ["vscode"], ["vscode","jetbrains"], etc.
  partial_session: boolean;    // True if multi-editor detected but not all covered
}
```

### 2.3 Attestation Schema (v1)

```typescript
// packages/core/src/attestation/types.ts

interface AttestationV1 {
  schema: "contribution-provenance/v1";
  repo: string;                // "github.com/owner/repo"
  commit: string;              // HEAD SHA at export time (full 40-char)
  identity: string;            // SHA256(git user.email), hex-encoded
  session: {
    session_id: string;        // UUIDv4, links to local session
    started_at: string;        // ISO 8601
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
  disclosure: string | null;   // Optional free-text AI disclosure
  tool_version: string;        // SemVer of the CLI/plugin that generated this
  timestamp: string;           // ISO 8601, time of export
  signature: string;           // Base64-encoded detached signature
  signature_format: "gpg" | "ssh"; // Which signing method was used
}
```

**Canonical JSON Schema** (for `docs/spec/attestation-v1.schema.json`):

```json
{
  "$schema": "https://json-schema.org/draft-07/schema#",
  "$id": "https://contrib-provenance.dev/schemas/attestation/v1",
  "title": "Contribution Provenance Attestation v1",
  "type": "object",
  "required": ["schema", "repo", "commit", "identity", "session", "tool_version", "timestamp", "signature", "signature_format"],
  "properties": {
    "schema": { "const": "contribution-provenance/v1" },
    "repo": { "type": "string", "pattern": "^[a-zA-Z0-9.-]+/[a-zA-Z0-9._-]+/[a-zA-Z0-9._-]+$" },
    "commit": { "type": "string", "pattern": "^[0-9a-f]{40}$" },
    "identity": { "type": "string", "pattern": "^[0-9a-f]{64}$" },
    "session": {
      "type": "object",
      "required": ["session_id", "started_at", "ended_at", "dwell_minutes", "active_files", "iteration_cycles", "post_insert_edit_ratio", "test_runs_observed", "largest_paste_lines", "paste_burst_count", "editors_used", "partial_session"],
      "properties": {
        "session_id": { "type": "string", "format": "uuid" },
        "started_at": { "type": "string", "format": "date-time" },
        "ended_at": { "type": "string", "format": "date-time" },
        "dwell_minutes": { "type": "number", "minimum": 0 },
        "active_files": { "type": "integer", "minimum": 0 },
        "iteration_cycles": { "type": "integer", "minimum": 0 },
        "post_insert_edit_ratio": { "type": "number", "minimum": 0, "maximum": 1 },
        "test_runs_observed": { "type": "integer", "minimum": 0 },
        "largest_paste_lines": { "type": "integer", "minimum": 0 },
        "paste_burst_count": { "type": "integer", "minimum": 0 },
        "editors_used": { "type": "array", "items": { "type": "string" } },
        "partial_session": { "type": "boolean" }
      }
    },
    "disclosure": { "type": ["string", "null"] },
    "tool_version": { "type": "string" },
    "timestamp": { "type": "string", "format": "date-time" },
    "signature": { "type": "string" },
    "signature_format": { "enum": ["gpg", "ssh"] }
  }
}
```

### 2.4 Local Storage File Format

Session data lives in `.provenance/` inside the repo root (gitignored).

```
.provenance/
├── config.json               # Project-level config (created by `provenance init`)
├── sessions/
│   ├── <session-uuid>.ndjson # Raw events, one JSON object per line
│   ├── <session-uuid>.meta.json # Session metadata (start time, status, editor)
│   └── ...
├── attestations/
│   ├── <session-uuid>.attestation.json  # Generated attestation
│   └── ...
└── .gitignore                # Contains "*" — never committed
```

**Session meta file** (`<uuid>.meta.json`):
```typescript
interface SessionMeta {
  session_id: string;
  status: "active" | "ended" | "exported";
  started_at: string;
  ended_at: string | null;
  editor: string | null;
  tool_version: string;
  repo_remote: string;        // git remote URL
  head_at_start: string;      // HEAD SHA when session started
}
```

### 2.5 Project Config (`.provenance/config.json`)

```typescript
interface ProjectConfig {
  version: 1;
  remote: string;             // e.g. "github.com/owner/repo"
  initialized_at: string;     // ISO 8601
  signing_method: "gpg" | "ssh" | "auto"; // "auto" = detect from git config
  hooks: {
    pre_push: boolean;        // Whether pre-push hook is installed
  };
}
```

### 2.6 Global User Config (`~/.config/provenance/config.json`)

```typescript
interface GlobalConfig {
  version: 1;
  default_signing_method: "gpg" | "ssh" | "auto";
  ai_disclosure_default: string | null; // Pre-filled disclosure text
  telemetry: boolean;         // Anonymous usage stats (opt-in, default false)
}
```

### 2.7 Repo Config (`.github/provenance.yml`)

This file is committed to the repository and read by the GitHub Action at runtime.

```yaml
# Full schema for .github/provenance.yml
version: 1

mode: "internal" | "oss"     # Required

# Internal mode settings
require_attestation: false    # Default: false. Never a hard gate.
attestation_reminder: true    # Post a gentle reminder if PR has no attestation

# Labels applied by the Action
labels:
  high: "provenance-high"     # Default
  medium: "provenance-medium"
  low: "provenance-low"
  none: "provenance-none"     # Applied to unattested PRs (optional, default: don't label)

# Signal thresholds (overrides for confidence computation)
signals:
  min_dwell_minutes: 15       # Default: 10. Below this, can't reach "high"
  require_test_run: false     # Default: false. If true, no test = max "medium"
  min_iteration_cycles: 2     # Default: 2 for high
  min_post_insert_ratio: 0.25 # Default: 0.25 for high
  ai_disclosure_prompt: true  # Default: true. Prompt contributor at export

# OSS mode settings (v1.0)
fast_lane:
  enabled: false              # Default: false
  sla_hours: 72              # Default: 72 (informational only — displayed in comments)
  label: "fast-lane"         # Label applied to fast-lane PRs

# Privacy
privacy:
  upload_paste_content: false  # Hardcoded false, not actually configurable (defense in depth)
  upload_command_args: false   # Hardcoded false

# Notifications
notifications:
  slack_webhook: null          # Optional Slack webhook URL
  comment_on_pr: true         # Default: true

# Bypass
bypass:
  users: []                   # List of GitHub usernames exempt from attestation reminders
  labels: ["dependencies", "automated"] # PRs with these labels skip provenance checks
```

---

## 3. PHASE v0.1 — CLI + VS Code Plugin (Session Tracking Only)

### 3.1 Scope

- `provenance init` and `provenance session start/end` commands
- VS Code extension that auto-starts sessions and tracks events
- Local NDJSON event storage
- No export, no signing, no GitHub integration yet

### 3.2 CLI Implementation Detail

#### 3.2.1 Entry Point (`packages/cli/src/index.ts`)

```typescript
#!/usr/bin/env node
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { initCommand } from "./commands/init";
import { sessionCommand } from "./commands/session";

yargs(hideBin(process.argv))
  .scriptName("provenance")
  .command(initCommand)
  .command(sessionCommand)
  .demandCommand(1, "You must specify a command")
  .strict()
  .help()
  .version()
  .parse();
```

#### 3.2.2 `provenance init`

**Flags:**
- `--signing <gpg|ssh|auto>` (default: `auto`)
- `--no-hooks` (skip git hook installation)
- `--force` (reinitialize even if `.provenance/` exists)

**Behavior:**
1. Verify current directory is a git repo root (check `.git/` exists). Error if not.
2. Check if `.provenance/` already exists. If yes, error unless `--force`.
3. Create `.provenance/` directory.
4. Write `.provenance/.gitignore` containing `*`.
5. Write `.provenance/config.json` with:
   - `remote`: parsed from `git remote get-url origin`
   - `signing_method`: from flag or `auto`
   - `initialized_at`: current ISO timestamp
   - `hooks.pre_push`: false (enabled in v0.2)
6. Create `.provenance/sessions/` and `.provenance/attestations/` directories.
7. Unless `--no-hooks`, install a pre-push hook stub at `.git/hooks/pre-push` that will be populated in v0.2. For v0.1, the hook is a no-op placeholder.
8. Print success message with path to config.

#### 3.2.3 `provenance session start`

**Flags:**
- `--name <string>` (optional human-readable session label, not used in attestation)
- `--editor <string>` (optional, auto-detected when possible)

**Behavior:**
1. Verify `.provenance/` exists (error: "Run `provenance init` first").
2. Check for any active session (status `"active"` in any `.meta.json`). If found, print warning: "Session `<id>` already active. End it first or use `--force`."
3. Generate UUIDv4 for session ID.
4. Get current HEAD SHA via `git rev-parse HEAD`.
5. Write `<session-id>.meta.json` with status `"active"`.
6. Write initial `session_start` event to `<session-id>.ndjson`.
7. Print: "Session started: `<session-id>`. Tracking events. Run `provenance session end` when done."

#### 3.2.4 `provenance session end`

**Flags:**
- `--session <uuid>` (optional, defaults to the currently active session)

**Behavior:**
1. Find active session. If `--session` provided, look up that specific one. Otherwise, find the single active session. Error if none found or if multiple active and no `--session` specified.
2. Write `session_end` event to the NDJSON file.
3. Update `.meta.json`: set `status: "ended"`, `ended_at` timestamp.
4. Run `MetricsComputer` on the NDJSON file and print a summary:
   ```
   Session ended: <session-id>
   Duration: 47 min active editing
   Files: 5 edited
   Iteration cycles: 2
   Post-insert edit ratio: 34%
   Test runs: 1
   Paste events: 3 (largest: 45 lines)
   ```

### 3.3 Core Algorithms

#### 3.3.1 Dwell Time Computation (`MetricsComputer.ts`)

Dwell time is active editing time, NOT wall clock time.

**Algorithm:**
1. Sort all events by timestamp.
2. Initialize `total_dwell_ms = 0`, `last_activity_ts = null`, `IDLE_THRESHOLD = 5 * 60 * 1000` (5 minutes).
3. For each event that represents activity (`file_edit`, `paste_burst`, `test_run`, `file_open`):
   - If `last_activity_ts` is not null and `(event.timestamp - last_activity_ts) < IDLE_THRESHOLD`:
     - `total_dwell_ms += (event.timestamp - last_activity_ts)`
   - Set `last_activity_ts = event.timestamp`
4. Also account for `focus_change` events: if `editor_active` becomes false, stop accumulating. When it becomes true again, set `last_activity_ts` to the focus-gain timestamp.
5. Return `Math.round(total_dwell_ms / 60000)` as `dwell_minutes`.

The 5-minute idle threshold is intentional: if someone stares at code for 4 minutes thinking, that counts. If they leave for 10 minutes, the gap doesn't count.

#### 3.3.2 Iteration Cycle Detection (`IterationDetector.ts`)

An "iteration cycle" is a distinct phase where the developer revisits and modifies previously-written code.

**Algorithm:**
1. Build a timeline of edit events grouped into "editing segments." A segment is a contiguous period of editing activity on related files (gap < 10 minutes).
2. For each segment, record the set of file regions touched (file_hash + approximate line range bucketed into 50-line windows).
3. An iteration cycle boundary occurs when:
   - A new segment touches at least one region that was also touched in a PREVIOUS segment AND
   - There is a meaningful gap (>= 3 minutes of non-editing or a `test_run` event between segments)
4. The first segment is cycle 0 (initial writing). Each return to previously-touched regions after a gap increments the cycle count.
5. Minimum `iteration_cycles = 0` (single continuous writing session, no revisits).

**Concretely:** If a developer writes code, runs tests, comes back and fixes things, runs tests again, that's 2 iteration cycles. Write-test-fix-test = 2 cycles (two revisit events).

#### 3.3.3 Post-Insert Edit Ratio (`MetricsComputer.ts`)

This measures how much of the inserted code was subsequently modified, indicating review/refinement of one's own work.

**Algorithm:**
1. Maintain a map: `inserted_regions: Map<string, Set<number>>` keyed by `file_hash`, value is set of 10-line bucket indices where lines were inserted.
2. For each `file_edit` event:
   - Record the bucket indices where `lines_inserted > 0`.
   - Check if any of the buckets being edited (via `lines_deleted > 0` or `lines_inserted > 0`) overlap with previously-recorded insertions in `inserted_regions` for the same file.
   - If yes, mark those overlapping buckets as "post-insert edited."
3. `post_insert_edit_ratio = count(post_insert_edited_buckets) / count(all_inserted_buckets)`.
4. If `all_inserted_buckets` is empty, ratio is 0.0.

The 10-line bucketing is deliberate: we don't track exact line numbers (privacy), but we can detect whether a developer returned to roughly the same region they previously inserted code into.

#### 3.3.4 Paste Burst Detection (`PasteDetector.ts`)

A "paste burst" is a single edit event that inserts a large number of lines in one operation.

**Algorithm (for CLI, which doesn't get real-time paste events):**
- CLI mode cannot directly detect pastes (it only sees git diffs). CLI-only tracking reports `paste_burst_count: 0` and `largest_paste_lines: 0` unless the CLI is running a file watcher.
- For v0.1, paste detection is only available via the VS Code extension.

**Algorithm (VS Code / JetBrains, real-time):**
1. On each `TextDocumentChangeEvent`, if the change inserts >= 5 lines in a single operation, classify it as a potential paste burst.
2. Threshold refinement: if >= 5 lines are inserted AND the insert happened in a single change event (not a sequence of single-line inserts over time), emit a `PasteBurstEvent`.
3. Record `line_count` as the number of lines in the inserted text.

### 3.4 VS Code Extension (v0.1)

#### 3.4.1 Extension Manifest (`packages/vscode/package.json`)

```json
{
  "name": "contrib-provenance",
  "displayName": "Contribution Provenance",
  "description": "Track your development process for transparent, signed PR attestations",
  "version": "0.1.0",
  "publisher": "contrib-provenance",
  "engines": { "vscode": "^1.85.0" },
  "categories": ["Other"],
  "activationEvents": [
    "workspaceContains:.provenance/config.json"
  ],
  "main": "./dist/extension.js",
  "contributes": {
    "commands": [
      {
        "command": "provenance.sessionStart",
        "title": "Provenance: Start Session"
      },
      {
        "command": "provenance.sessionEnd",
        "title": "Provenance: End Session"
      },
      {
        "command": "provenance.sessionStatus",
        "title": "Provenance: Show Session Status"
      }
    ],
    "configuration": {
      "title": "Contribution Provenance",
      "properties": {
        "provenance.autoStart": {
          "type": "boolean",
          "default": true,
          "description": "Automatically start a session when opening a provenance-enabled repo"
        },
        "provenance.idleTimeoutMinutes": {
          "type": "number",
          "default": 5,
          "description": "Minutes of inactivity before dwell timer pauses"
        }
      }
    }
  }
}
```

#### 3.4.2 Activation (`extension.ts`)

```typescript
export function activate(context: vscode.ExtensionContext) {
  // 1. Check if workspace has .provenance/config.json
  // 2. If provenance.autoStart is true and no active session, auto-start
  // 3. Register all command handlers
  // 4. Register document change listener
  // 5. Register terminal event listener (for test run detection)
  // 6. Create and show status bar item
  // 7. Register focus change listener (window.onDidChangeWindowState)
}

export function deactivate() {
  // End active session if one exists
  // Flush any buffered events to disk
}
```

#### 3.4.3 Document Change Listener (`SessionTracker.ts`)

The core tracking loop. Registered via `vscode.workspace.onDidChangeTextDocument`.

```typescript
class SessionTracker {
  private eventBuffer: SessionEvent[] = [];
  private flushInterval: NodeJS.Timer;       // Flush to disk every 10 seconds
  private insertedRegions: Map<string, Set<number>>; // For post-insert tracking
  private lastActivityTimestamp: number = 0;

  constructor(private store: SessionStore, private sessionId: string) {
    this.flushInterval = setInterval(() => this.flush(), 10_000);
  }

  onDocumentChanged(event: vscode.TextDocumentChangeEvent): void {
    // 1. Ignore non-file schemes (output, git, untitled)
    if (event.document.uri.scheme !== "file") return;

    // 2. Ignore files outside the workspace root
    // 3. Compute file_hash = SHA256(relative path from repo root)

    for (const change of event.contentChanges) {
      const linesInserted = change.text.split("\n").length - 1;
      const linesDeleted = change.range.end.line - change.range.start.line;

      // 4. Paste burst detection
      if (linesInserted >= 5 && this.isSingleOperation(event)) {
        this.eventBuffer.push({
          type: "paste_burst",
          timestamp: Date.now(),
          file_hash: fileHash,
          line_count: linesInserted,
        });
      }

      // 5. Post-insert edit detection
      const bucket = Math.floor(change.range.start.line / 10);
      const isPostInsertEdit = this.insertedRegions.get(fileHash)?.has(bucket) ?? false;

      // 6. Record file edit event
      this.eventBuffer.push({
        type: "file_edit",
        timestamp: Date.now(),
        file_hash: fileHash,
        lines_inserted: linesInserted,
        lines_deleted: linesDeleted,
        is_post_insert_edit: isPostInsertEdit,
      });

      // 7. Update inserted regions for future post-insert detection
      if (linesInserted > 0) {
        if (!this.insertedRegions.has(fileHash)) {
          this.insertedRegions.set(fileHash, new Set());
        }
        for (let b = bucket; b <= Math.floor((change.range.start.line + linesInserted) / 10); b++) {
          this.insertedRegions.get(fileHash)!.add(b);
        }
      }
    }
  }

  private isSingleOperation(event: vscode.TextDocumentChangeEvent): boolean {
    // Heuristic: if the change event has exactly 1 content change
    // and it inserts multiple lines, it's likely a paste.
    // Multiple small changes in one event are more likely formatting/refactoring.
    return event.contentChanges.length === 1;
  }
}
```

#### 3.4.4 Test Run Detection (`TestRunWatcher.ts`)

```typescript
class TestRunWatcher {
  // Strategy 1: Watch VS Code Task executions
  // vscode.tasks.onDidStartTask — check task definition for test/lint/build patterns

  // Strategy 2: Watch terminal output creation
  // vscode.window.onDidOpenTerminal + terminal.onDidWriteData (if available)
  // Look for command patterns: "npm test", "jest", "pytest", "cargo test",
  // "go test", "make test", "gradle test", etc.
  // ONLY detect command name, NEVER capture arguments.

  // Strategy 3: Watch for VS Code Test Controller runs
  // vscode.tests.onDidRunTests (available in newer VS Code versions)

  private readonly TEST_PATTERNS = [
    /^(npm|yarn|pnpm)\s+(test|run\s+test)/,
    /^(jest|vitest|mocha|ava)/,
    /^pytest/,
    /^(cargo|go|gradle|mvn|dotnet)\s+test/,
    /^make\s+(test|check|lint)/,
    /^(eslint|tsc|prettier)\b/,
  ];

  // When a match is detected:
  // Emit TestRunEvent with command_type inferred:
  // - Matches test patterns → "test"
  // - Matches eslint/prettier → "lint"
  // - Matches tsc/cargo build → "build"/"typecheck"
}
```

#### 3.4.5 Status Bar Item (`StatusBarController.ts`)

A status bar item on the left side showing session state:

- **No session:** `$(circle-outline) Provenance` — click to start session
- **Active session:** `$(pulse) Provenance: 23m` — shows live dwell time, click for status popup
- **Session ended:** `$(check) Provenance: Done` — click to view summary

The dwell time updates every 30 seconds by recomputing from the event buffer (not by running a timer, since idle gaps must be excluded).

#### 3.4.6 Focus Tracking

```typescript
vscode.window.onDidChangeWindowState((state) => {
  tracker.recordFocusChange(state.focused);
  // Emits FocusChangeEvent
});
```

---

## 4. PHASE v0.2 — Attestation Export + Provenance Inspect

### 4.1 Scope

- `provenance inspect` command
- `provenance export` command with signing
- Signing infrastructure (GPG and SSH)
- Pre-push hook integration
- VS Code commands for inspect/export

### 4.2 `provenance inspect`

**Flags:**
- `--session <uuid>` (optional, defaults to most recent ended session)
- `--json` (output raw JSON instead of formatted text)
- `--all` (list all sessions)

**Behavior:**
1. If `--all`: list all sessions with ID, status, start time, and duration. Exit.
2. Find the target session (most recent ended, or specified by `--session`).
3. Load the NDJSON event log. Run `MetricsComputer` to get aggregates.
4. Display formatted output:

```
┌──────────────────────────────────────────────────┐
│  Contribution Provenance — Session Inspect       │
├──────────────────────────────────────────────────┤
│  Session:    a1b2c3d4-e5f6-7890-abcd-ef1234567890│
│  Status:     ended                               │
│  Started:    2026-03-11 09:15:00                  │
│  Ended:      2026-03-11 10:29:00                  │
├──────────────────────────────────────────────────┤
│  METRICS (these will appear in the attestation)  │
│                                                  │
│  Active editing time:      47 minutes            │
│  Files edited:             5                     │
│  Iteration cycles:         2                     │
│  Post-insert edit ratio:   34%                   │
│  Test runs observed:       1                     │
│  Largest paste burst:      45 lines              │
│  Total paste events:       3                     │
├──────────────────────────────────────────────────┤
│  EVENT TIMELINE (never uploaded)                 │
│                                                  │
│  09:15  Session started (vscode)                 │
│  09:15  Opened file [hash:a3f2...]               │
│  09:16  Edited file [hash:a3f2...] +12 -0        │
│  09:22  Pasted 45 lines in [hash:a3f2...]        │
│  09:25  Edited file [hash:a3f2...] +3 -8 (*)    │
│         (*) = post-insert edit                   │
│  09:31  Opened file [hash:b7e1...]               │
│  ...                                             │
│  09:48  Test run detected (test)                 │
│  09:50  Edited file [hash:a3f2...] +5 -3 (*)    │
│  10:29  Session ended                            │
├──────────────────────────────────────────────────┤
│  This is YOUR data. Review before exporting.     │
│  Run `provenance export` to sign and package.    │
└──────────────────────────────────────────────────┘
```

### 4.3 `provenance export`

**Flags:**
- `--session <uuid>` (optional, defaults to most recent ended session)
- `--disclosure <string>` (optional AI disclosure note)
- `--no-sign` (skip signing, produce unsigned attestation — useful for testing)
- `--key <key-id>` (override git signing key)
- `--output <path>` (write attestation to custom path instead of `.provenance/attestations/`)

**Behavior:**
1. Find target session. Must be in `"ended"` status. Error if active or already exported.
2. Run `MetricsComputer` to get final metrics.
3. If `ai_disclosure_prompt` is configured (from project or global config) and no `--disclosure` flag, prompt interactively: "Did you use AI assistance? (optional, press Enter to skip):"
4. Build attestation JSON using `AttestationBuilder`.
5. Discover signing key:
   a. Check `--key` flag first.
   b. Check `git config user.signingkey`.
   c. Check `git config gpg.format` to determine GPG vs SSH.
   d. If no key found, warn and offer `--no-sign`.
6. Sign the attestation (details in section 4.4).
7. Write attestation to `.provenance/attestations/<session-id>.attestation.json`.
8. Update session meta status to `"exported"`.
9. Print the attestation in formatted view (similar to inspect but prefixed with "READY TO UPLOAD").

### 4.4 Signing Implementation

#### 4.4.1 What Gets Signed

The signature covers the entire attestation JSON **minus the `signature` and `signature_format` fields**. Specifically:

1. Build the attestation object without `signature` and `signature_format`.
2. Serialize to JSON with sorted keys and no whitespace (canonical form): `JSON.stringify(obj, Object.keys(obj).sort(), 0)`.
3. Actually, use a deterministic JSON canonicalization: sort all keys recursively, no trailing whitespace, `\n` line ending. Use the `json-canonicalize` npm package (RFC 8785).
4. Sign the canonical JSON bytes.

#### 4.4.2 GPG Signing

```typescript
// packages/core/src/crypto/gpg.ts

async function signWithGpg(payload: Buffer, keyId: string): Promise<string> {
  // Shell out to gpg:
  // echo <payload> | gpg --detach-sign --armor --local-user <keyId>
  // Return the ASCII-armored detached signature as base64 string
  const result = await execFile("gpg", [
    "--detach-sign",
    "--armor",
    "--local-user", keyId,
    "--status-fd", "2",
  ], { input: payload });
  return result.stdout; // Already base64 (ASCII armor)
}

async function verifyGpgSignature(payload: Buffer, signature: string, keyId?: string): Promise<boolean> {
  // Write signature to temp file, verify:
  // gpg --verify <sig-file> -
  // Check exit code 0 and parse --status-fd output for GOODSIG
}
```

#### 4.4.3 SSH Signing

```typescript
// packages/core/src/crypto/ssh.ts

async function signWithSsh(payload: Buffer, keyPath: string): Promise<string> {
  // Use ssh-keygen to create a detached signature:
  // ssh-keygen -Y sign -f <keyPath> -n contribution-provenance
  // The namespace "contribution-provenance" scopes the signature
  //
  // ssh-keygen writes the signature to <input-file>.sig
  // We write payload to a temp file, sign, read .sig, delete both
  //
  // Return the signature as base64 string
}

async function verifySshSignature(
  payload: Buffer,
  signature: string,
  allowedSignersContent: string // The "allowed_signers" format content
): Promise<boolean> {
  // ssh-keygen -Y verify -f <allowed-signers-file> -n contribution-provenance -s <sig-file>
}
```

#### 4.4.4 Key Discovery (`keyDiscovery.ts`)

```typescript
async function discoverSigningKey(): Promise<{ method: "gpg" | "ssh"; keyId: string }> {
  // 1. Check git config gpg.format
  const format = await gitConfig("gpg.format"); // "ssh" | "openpgp" | undefined

  // 2. Check git config user.signingkey
  const signingKey = await gitConfig("user.signingkey");

  if (!signingKey) {
    throw new Error(
      "No signing key configured. Set one with:\n" +
      "  git config user.signingkey <KEY_ID>     (for GPG)\n" +
      "  git config user.signingkey ~/.ssh/id_ed25519.pub  (for SSH)\n" +
      "  git config gpg.format ssh               (to use SSH signing)"
    );
  }

  if (format === "ssh") {
    return { method: "ssh", keyId: signingKey }; // keyId is path to pubkey
  } else {
    return { method: "gpg", keyId: signingKey }; // keyId is GPG key ID
  }
}
```

### 4.5 Pre-Push Hook (v0.2)

`provenance init` now writes a real pre-push hook:

```bash
#!/bin/sh
# contrib-provenance pre-push hook
# This hook runs `provenance export` if there's an active or ended session
# The contributor sees a preview and can abort with Ctrl+C

PROVENANCE_DIR=".provenance"

if [ ! -d "$PROVENANCE_DIR" ]; then
  exit 0
fi

# Check for ended but unexported sessions
UNEXPORTED=$(provenance session list --status=ended --quiet 2>/dev/null)
if [ -n "$UNEXPORTED" ]; then
  echo ""
  echo "📋 Contribution Provenance: You have an unexported session."
  echo "   Run 'provenance export' to create a signed attestation."
  echo "   (Push continues regardless)"
  echo ""
fi

exit 0  # Never block push
```

### 4.6 VS Code Extension Updates for v0.2

Add two new commands to `package.json` contributes:

```json
{
  "command": "provenance.inspect",
  "title": "Provenance: Inspect Current Session"
},
{
  "command": "provenance.export",
  "title": "Provenance: Export Attestation"
}
```

The `export` command triggers an interactive webview panel or output channel showing the inspect view, then prompts for disclosure and signing.

---

## 5. PHASE v0.3 — GitHub Action (Internal Mode Only)

### 5.1 Scope

- GitHub Action that verifies attestations posted as PR comments
- Signature verification
- Confidence label computation
- PR comment posting (summary)
- `.github/provenance.yml` config loading
- `provenance attach` CLI command (posts attestation as hidden PR comment)
- Replay detection via GitHub API search (no database)
- Published to GitHub Marketplace as an Action

### 5.2 `provenance attach <PR>`

**Arguments:**
- `<PR>` — PR number or URL (e.g., `42` or `https://github.com/owner/repo/pull/42`)

**Flags:**
- `--session <uuid>` (optional, defaults to most recently exported session)
- `--attestation <path>` (optional, path to attestation file if not using default location)
- `--dry-run` (print what would be uploaded without uploading)

**Behavior:**
1. Find the attestation file (from session or path).
2. Validate it's properly signed (unless `--no-sign` was used at export).
3. Resolve the PR: parse owner/repo/number from the argument or from git remote + argument.
4. Post the attestation as a hidden HTML comment on the PR via the GitHub API:

```markdown
<!-- provenance-attestation-v1
{...attestation JSON...}
-->
```

This approach requires no separate server. The GitHub Action, triggered by `issue_comment` events, reads PR comments and extracts the attestation. The comment is hidden from the rendered Markdown view (HTML comment).

**Authentication:** The CLI uses the user's existing GitHub authentication. It attempts these in order:
1. `gh auth token` (GitHub CLI — most common for developers)
2. `GITHUB_TOKEN` environment variable
3. If neither is available, prompt the user to authenticate via `gh auth login`

### 5.3 GitHub Action Architecture

#### 5.3.1 Action Metadata (`packages/action/action.yml`)

```yaml
name: 'Contribution Provenance'
description: 'Verify contribution provenance attestations on pull requests'
author: 'contrib-provenance'
branding:
  icon: 'shield'
  color: 'green'

inputs:
  github-token:
    description: 'GitHub token for API access'
    required: false
    default: ${{ github.token }}

runs:
  using: 'node20'
  main: 'dist/index.js'
```

The Action takes no required configuration inputs because all configuration lives in `.github/provenance.yml` inside the repository.

#### 5.3.2 Workflow File (Added by Maintainers)

Maintainers add a workflow file to their repository to enable the Action:

```yaml
# .github/workflows/provenance.yml
name: Contribution Provenance
on:
  pull_request:
    types: [opened, synchronize, reopened]
  issue_comment:
    types: [created]

permissions:
  pull-requests: write
  contents: read

jobs:
  provenance-check:
    runs-on: ubuntu-latest
    # Run on PR events, or on issue_comment events that are on PRs
    if: github.event_name == 'pull_request' || (github.event_name == 'issue_comment' && github.event.issue.pull_request)
    steps:
      - uses: contrib-provenance/action@v1
```

#### 5.3.3 Action Entry Point (`packages/action/src/index.ts`)

```typescript
import * as core from "@actions/core";
import * as github from "@actions/github";
import { loadRepoConfig } from "./config/loadRepoConfig";
import { findAttestation } from "./verification/verifyAttestation";
import { verifyAttestation } from "./verification/verifyAttestation";
import { computeConfidence } from "./labels/computeConfidence";
import { renderComment } from "./labels/renderComment";
import { checkReplay } from "./replay/checkReplay";

async function run(): Promise<void> {
  try {
    const token = core.getInput("github-token");
    const octokit = github.getOctokit(token);
    const context = github.context;

    // 1. Determine PR number
    let prNumber: number;
    if (context.eventName === "pull_request") {
      prNumber = context.payload.pull_request!.number;
    } else if (context.eventName === "issue_comment") {
      prNumber = context.payload.issue!.number;
    } else {
      core.info("Unsupported event type, skipping.");
      return;
    }

    const owner = context.repo.owner;
    const repo = context.repo.repo;

    // 2. Load .github/provenance.yml from the repo
    const config = await loadRepoConfig(octokit, owner, repo);
    if (!config) {
      core.info("No .github/provenance.yml found, skipping.");
      return;
    }

    // 3. Check bypass rules
    const pr = await octokit.rest.pulls.get({ owner, repo, pull_number: prNumber });
    const prLabels = pr.data.labels.map(l => l.name);
    const prAuthor = pr.data.user?.login;

    if (config.bypass?.users?.includes(prAuthor ?? "")) {
      core.info(`User ${prAuthor} is in bypass list, skipping.`);
      return;
    }
    if (config.bypass?.labels?.some(l => prLabels.includes(l))) {
      core.info("PR has a bypass label, skipping.");
      return;
    }

    // 4. Search PR comments for attestation
    const comments = await octokit.rest.issues.listComments({
      owner, repo, issue_number: prNumber, per_page: 100,
    });
    const attestation = findAttestationInComments(comments.data);

    if (!attestation) {
      // No attestation found
      if (config.attestation_reminder) {
        await postReminder(octokit, owner, repo, prNumber, config);
      }
      if (config.labels?.none) {
        await applyLabel(octokit, owner, repo, prNumber, config.labels.none);
      }
      return;
    }

    // 5. Run verification pipeline
    const commits = await octokit.rest.pulls.listCommits({
      owner, repo, pull_number: prNumber, per_page: 250,
    });
    const result = await verifyAttestation(attestation, {
      owner, repo, prNumber,
      commits: commits.data,
      octokit,
    });

    // 6. Compute confidence
    const confidence = computeConfidence({
      metrics: attestation.session,
      config,
      verificationPassed: result.allPassed,
    });

    // 7. Post summary comment (update existing if already posted)
    const comment = renderComment(result, confidence, config);
    await upsertSummaryComment(octokit, owner, repo, prNumber, comment);

    // 8. Apply labels
    const labelName = config.labels?.[confidence] ?? `provenance-${confidence}`;
    await applyLabel(octokit, owner, repo, prNumber, labelName);

    // 9. Set outputs
    core.setOutput("confidence", confidence);
    core.setOutput("verified", result.allPassed.toString());

  } catch (error) {
    core.setFailed(`Action failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

run();
```

#### 5.3.4 Config Loading (`loadRepoConfig.ts`)

```typescript
// packages/action/src/config/loadRepoConfig.ts

import { configSchema } from "./configSchema";

async function loadRepoConfig(octokit: Octokit, owner: string, repo: string): Promise<ProvenanceConfig | null> {
  try {
    const { data } = await octokit.rest.repos.getContent({
      owner, repo,
      path: ".github/provenance.yml",
      ref: "HEAD",
    });

    if ("content" in data) {
      const content = Buffer.from(data.content, "base64").toString("utf-8");
      const parsed = yaml.parse(content);
      return configSchema.parse(parsed);
    }
    return null;
  } catch (error: any) {
    if (error.status === 404) return null;
    throw error;
  }
}
```

#### 5.3.5 Attestation Extraction from PR Comments

```typescript
function findAttestationInComments(comments: IssueComment[]): AttestationV1 | null {
  const MARKER = "<!-- provenance-attestation-v1";

  // Search comments in reverse order (most recent first)
  for (let i = comments.length - 1; i >= 0; i--) {
    const body = comments[i].body ?? "";
    const startIdx = body.indexOf(MARKER);
    if (startIdx === -1) continue;

    const jsonStart = body.indexOf("\n", startIdx) + 1;
    const jsonEnd = body.indexOf("\n-->", jsonStart);
    if (jsonEnd === -1) continue;

    try {
      const json = body.slice(jsonStart, jsonEnd).trim();
      const attestation = JSON.parse(json);
      // Validate against Zod schema
      return AttestationSchemaV1.parse(attestation);
    } catch {
      continue; // Malformed, try earlier comments
    }
  }
  return null;
}
```

#### 5.3.6 Verification Pipeline (`verifyAttestation.ts`)

```typescript
interface VerificationContext {
  owner: string;
  repo: string;
  prNumber: number;
  commits: PullRequestCommit[];
  octokit: Octokit;
}

async function verifyAttestation(
  attestation: AttestationV1,
  ctx: VerificationContext
): Promise<VerificationResult> {
  const checks: Check[] = [];

  // 1. Schema validation
  const schemaResult = AttestationSchemaV1.safeParse(attestation);
  checks.push({ name: "schema", passed: schemaResult.success, detail: schemaResult.error?.message });

  // 2. Commit binding
  // Verify attestation.commit appears in the PR's commit list
  const commitInPR = ctx.commits.some(c => c.sha === attestation.commit);
  checks.push({ name: "commit_binding", passed: commitInPR });

  // 3. Identity binding
  // For each commit in the PR, compute SHA256(commit.author.email)
  // Check if any match attestation.identity
  const identityMatch = ctx.commits.some(c =>
    sha256(c.commit.author.email) === attestation.identity
  );
  checks.push({ name: "identity_binding", passed: identityMatch });

  // 4. Signature verification
  const sigResult = await verifySignature(attestation, ctx);
  checks.push({ name: "signature", passed: sigResult.valid, detail: sigResult.detail });

  // 5. Freshness check
  // Attestation timestamp should be within 24h of the commit timestamp
  const commitTime = new Date(ctx.commits.find(c => c.sha === attestation.commit)?.commit.committer.date ?? 0);
  const attestTime = new Date(attestation.timestamp);
  const hoursDiff = Math.abs(attestTime.getTime() - commitTime.getTime()) / 3600000;
  checks.push({ name: "freshness", passed: hoursDiff < 24 });

  // 6. Replay detection (via GitHub API search, no database)
  const replayResult = await checkReplay(ctx.octokit, ctx.owner, ctx.repo, ctx.prNumber, attestation.session.session_id);
  checks.push({ name: "replay", passed: !replayResult.isReplay, detail: replayResult.detail });

  return {
    checks,
    allPassed: checks.every(c => c.passed),
    attestation,
  };
}
```

#### 5.3.7 Signature Verification Detail

For the Action to verify signatures, it needs the signer's public key. The Action runs on GitHub's ubuntu runners, which have both `gpg` and `ssh-keygen` available.

**GPG verification:**
1. GitHub API exposes `GET /users/{username}/gpg_keys` which returns the user's uploaded GPG public keys.
2. The Action fetches the PR author's GPG keys.
3. For each key, attempt to verify the detached signature against the canonical attestation payload.
4. If any key produces a valid signature, verification passes.
5. The Action uses the `openpgp` npm package (OpenPGP.js) for in-process verification as the primary path. Falls back to shelling out to `gpg` if needed (available on ubuntu-latest runners).

**SSH verification:**
1. GitHub API exposes `GET /users/{username}/ssh_signing_keys` (available since 2022).
2. The Action fetches the PR author's SSH signing keys.
3. Construct an `allowed_signers` file content with each key.
4. Use `ssh-keygen -Y verify` to check the signature. `ssh-keygen` is available on ubuntu-latest runners.
5. Alternatively, use a pure JS implementation via the `sshpk` npm package for parsing and verifying Ed25519 signatures.

**Fallback:** If neither GPG nor SSH keys are available on GitHub, or if verification fails, the Action posts: "Attestation present but signature could not be verified against GitHub-registered keys. Ensure your signing key is uploaded to GitHub Settings > SSH and GPG keys."

#### 5.3.8 Replay Detection via GitHub API (`checkReplay.ts`)

Instead of querying a database, the Action uses the GitHub Search API to detect replayed session IDs:

```typescript
// packages/action/src/replay/checkReplay.ts

interface ReplayResult {
  isReplay: boolean;
  detail?: string;
}

async function checkReplay(
  octokit: Octokit,
  owner: string,
  repo: string,
  prNumber: number,
  sessionId: string
): Promise<ReplayResult> {
  try {
    // Search for this session_id in PR comments across the repo,
    // excluding the current PR
    const { data: results } = await octokit.rest.search.issuesAndPullRequests({
      q: `repo:${owner}/${repo} is:pr "${sessionId}" in:comments -number:${prNumber}`,
    });

    if (results.total_count > 0) {
      const otherPRs = results.items.map(i => `#${i.number}`).join(", ");
      return {
        isReplay: true,
        detail: `Session ID found in other PRs: ${otherPRs}`,
      };
    }

    return { isReplay: false };
  } catch (error: any) {
    // If search API fails (e.g., rate limit), log warning but don't block
    core.warning(`Replay check failed: ${error.message}. Skipping replay detection.`);
    return { isReplay: false, detail: "Replay check skipped due to API error" };
  }
}
```

**Rate limit considerations:** The GitHub Search API has a rate limit of 30 requests per minute for authenticated users. Since the Action runs once per PR event, this is unlikely to be hit. If it is, the Action logs a warning and skips the replay check (fail-open).

#### 5.3.9 Confidence Label Computation (`computeConfidence.ts`)

```typescript
interface ConfidenceInput {
  metrics: SessionMetrics;
  config: ProvenanceYmlConfig;
  verificationPassed: boolean;
}

type ConfidenceLevel = "high" | "medium" | "low";

function computeConfidence(input: ConfidenceInput): ConfidenceLevel {
  const { metrics, config } = input;
  const s = config.signals;

  // Must pass verification to be anything above "low"
  if (!input.verificationPassed) return "low";

  // HIGH: all four criteria met
  const isHigh =
    metrics.dwell_minutes >= (s.min_dwell_minutes ?? 30) &&
    metrics.iteration_cycles >= (s.min_iteration_cycles ?? 2) &&
    metrics.post_insert_edit_ratio >= (s.min_post_insert_ratio ?? 0.25) &&
    metrics.test_runs_observed >= 1;

  if (isHigh) return "high";

  // MEDIUM: partial criteria
  const isMedium =
    metrics.dwell_minutes >= Math.max(10, (s.min_dwell_minutes ?? 10) * 0.5) &&
    (metrics.iteration_cycles >= 1 || metrics.post_insert_edit_ratio > 0.1);

  if (isMedium) return "medium";

  return "low";
}
```

#### 5.3.10 PR Comment Rendering (`renderComment.ts`)

```typescript
function renderComment(result: VerificationResult, confidence: ConfidenceLevel, config: ProvenanceYmlConfig): string {
  const a = result.attestation;
  const icon = { high: "✅", medium: "⚠️", low: "🟡" }[confidence];
  const label = {
    high: "HIGH iteration signal",
    medium: "MEDIUM iteration signal",
    low: "LOW iteration signal"
  }[confidence];

  return `
## ${icon} Contribution Provenance Report

| Field | Value |
|-------|-------|
| **Attestation** | ${result.allPassed ? "Verified" : "Verification issues (see below)"} (${a.signature_format}) |
| **Review confidence** | ${label} |
| **Active editing time** | ${a.session.dwell_minutes} min across ${a.session.active_files} files |
| **Iteration cycles** | ${a.session.iteration_cycles} distinct revision phases |
| **Post-insert edit ratio** | ${Math.round(a.session.post_insert_edit_ratio * 100)}% of inserted lines subsequently edited |
| **Test runs observed** | ${a.session.test_runs_observed} |
| **Largest paste burst** | ${a.session.largest_paste_lines} lines |
| **AI disclosure** | ${a.disclosure ?? "None provided"} |
| **Tool version** | contrib-provenance v${a.tool_version} |

${!result.allPassed ? renderVerificationIssues(result.checks) : ""}

<sub>🔍 [What is this?](https://contrib-provenance.dev/docs/what-is-this) · Attestation is voluntary. No inference is made about PRs without attestation.</sub>
<!-- provenance-summary-v1 -->
`.trim();
}
```

The `<!-- provenance-summary-v1 -->` marker at the end allows the Action to find and update its own previous summary comment (upsert behavior) rather than posting duplicates.

#### 5.3.11 Upsert Summary Comment

```typescript
async function upsertSummaryComment(
  octokit: Octokit,
  owner: string,
  repo: string,
  prNumber: number,
  body: string
): Promise<void> {
  const MARKER = "<!-- provenance-summary-v1 -->";

  // Find existing summary comment
  const comments = await octokit.rest.issues.listComments({
    owner, repo, issue_number: prNumber, per_page: 100,
  });
  const existing = comments.data.find(c => c.body?.includes(MARKER));

  if (existing) {
    await octokit.rest.issues.updateComment({
      owner, repo, comment_id: existing.id, body,
    });
  } else {
    await octokit.rest.issues.createComment({
      owner, repo, issue_number: prNumber, body,
    });
  }
}
```

### 5.4 Permissions

The Action requires these permissions, declared in the maintainer's workflow file:

- **pull-requests: write** — to post comments and apply labels
- **contents: read** — to read `.github/provenance.yml`

The Action authenticates to the GitHub API using the `GITHUB_TOKEN` automatically provided by GitHub Actions. This token is scoped to the repository where the workflow runs. No GitHub App registration, private keys, or webhook secrets are needed.

For signature verification, the Action calls public GitHub API endpoints (`GET /users/{username}/gpg_keys`, `GET /users/{username}/ssh_signing_keys`) which are accessible with the default token.

---

## 6. PHASE v0.4 — JetBrains Plugin + Multi-Editor Session Merge

### 6.1 JetBrains Plugin Architecture

The JetBrains plugin is written in Kotlin and uses the IntelliJ Platform SDK. It delegates all heavy computation to the core library by invoking the CLI as a subprocess.

#### 6.1.1 Plugin Structure

```
src/main/kotlin/com/contribprovenance/
├── ProvenancePlugin.kt           # Plugin lifecycle
├── SessionTrackerService.kt      # Project-level service, manages lifecycle
├── DocumentChangeListener.kt     # BulkFileListener for document changes
├── PasteHandler.kt               # EditorActionHandler override for paste
├── TerminalWatcher.kt            # TerminalWidgetListener for test detection
├── StatusBarWidget.kt            # StatusBarWidgetFactory
├── CliBridge.kt                  # Subprocess management for provenance CLI
└── SessionMerger.kt              # Merges sessions from multiple editors
```

#### 6.1.2 plugin.xml Configuration

```xml
<idea-plugin>
  <id>com.contribprovenance.jetbrains</id>
  <name>Contribution Provenance</name>
  <version>0.4.0</version>
  <vendor>contrib-provenance</vendor>
  <depends>com.intellij.modules.platform</depends>
  <depends optional="true">org.jetbrains.plugins.terminal</depends>

  <extensions defaultExtensionNs="com.intellij">
    <projectService
      serviceImplementation="com.contribprovenance.SessionTrackerService"/>
    <statusBarWidgetFactory
      implementation="com.contribprovenance.StatusBarWidget$Factory"
      id="ProvenanceStatusBar"/>
    <notificationGroup id="Provenance"
      displayType="BALLOON"/>
  </extensions>

  <applicationListeners>
    <listener
      class="com.contribprovenance.DocumentChangeListener"
      topic="com.intellij.openapi.vfs.newvfs.BulkFileListener"/>
  </applicationListeners>

  <actions>
    <action id="Provenance.StartSession"
      class="com.contribprovenance.actions.StartSessionAction"
      text="Start Provenance Session"
      description="Start tracking a provenance session"/>
    <action id="Provenance.EndSession"
      class="com.contribprovenance.actions.EndSessionAction"
      text="End Provenance Session"/>
    <action id="Provenance.Inspect"
      class="com.contribprovenance.actions.InspectAction"
      text="Inspect Provenance Session"/>
    <action id="Provenance.Export"
      class="com.contribprovenance.actions.ExportAction"
      text="Export Provenance Attestation"/>
  </actions>
</idea-plugin>
```

#### 6.1.3 Document Change Tracking

```kotlin
// DocumentChangeListener.kt
class DocumentChangeListener : BulkFileListener {
    override fun after(events: List<VFileEvent>) {
        for (event in events) {
            when (event) {
                is VFileContentChangeEvent -> {
                    val project = ProjectLocator.getInstance()
                        .guessProjectForFile(event.file) ?: continue
                    val service = project.getService(SessionTrackerService::class.java)

                    // Compute file_hash = SHA256 of relative path
                    val relativePath = event.file.path.removePrefix(project.basePath ?: "")
                    val fileHash = sha256(relativePath)

                    // We can't easily get lines_inserted/deleted from VFileContentChangeEvent
                    // Strategy: compare old and new content length as heuristic
                    // OR use DocumentListener (per-document, more granular) instead
                    service.recordFileEdit(fileHash, event)
                }
            }
        }
    }
}
```

**Better approach using DocumentListener:**

```kotlin
// Per-document listener registered by SessionTrackerService
class ProvenanceDocumentListener(
    private val service: SessionTrackerService,
    private val fileHash: String
) : DocumentListener {
    override fun documentChanged(event: DocumentEvent) {
        val linesInserted = event.newFragment.toString().count { it == '\n' }
        val linesDeleted = event.oldFragment.toString().count { it == '\n' }

        // Paste detection: if linesInserted >= 5 in a single event
        if (linesInserted >= 5) {
            service.recordPasteBurst(fileHash, linesInserted)
        }

        service.recordFileEdit(fileHash, linesInserted, linesDeleted, event.offset)
    }
}
```

#### 6.1.4 Paste Handler

```kotlin
// PasteHandler.kt — intercepts paste actions for more reliable detection
class PasteHandler : EditorActionHandler() {
    private val originalHandler = EditorActionManager.getInstance()
        .getActionHandler(IdeActions.ACTION_EDITOR_PASTE)

    override fun doExecute(editor: Editor, caret: Caret?, dataContext: DataContext?) {
        // Get clipboard content line count BEFORE paste (we don't store content)
        val clipboard = CopyPasteManager.getInstance().contents
        val text = clipboard?.getTransferData(DataFlavor.stringFlavor) as? String
        val lineCount = text?.count { it == '\n' }?.plus(1) ?: 0

        // Execute the actual paste
        originalHandler.execute(editor, caret, dataContext)

        // Record paste event with line count
        if (lineCount >= 5) {
            val project = editor.project ?: return
            val service = project.getService(SessionTrackerService::class.java)
            val file = FileDocumentManager.getInstance().getFile(editor.document) ?: return
            val fileHash = sha256(file.path.removePrefix(project.basePath ?: ""))
            service.recordPasteBurst(fileHash, lineCount)
        }
    }
}
```

#### 6.1.5 CLI Bridge

The JetBrains plugin delegates session management to the provenance CLI binary:

```kotlin
// CliBridge.kt
class CliBridge(private val project: Project) {
    private val cliPath: String by lazy { findCliPath() }

    fun sessionStart(): String {
        val result = runCli("session", "start", "--editor", "jetbrains", "--json")
        return parseJson(result).getString("session_id")
    }

    fun sessionEnd(sessionId: String) {
        runCli("session", "end", "--session", sessionId)
    }

    fun writeEvent(sessionId: String, event: SessionEvent) {
        // Write event directly to the NDJSON file (faster than invoking CLI per event)
        val eventFile = project.basePath?.let {
            Path.of(it, ".provenance", "sessions", "$sessionId.ndjson")
        } ?: return
        Files.write(eventFile, (event.toJson() + "\n").toByteArray(), StandardOpenOption.APPEND)
    }

    private fun runCli(vararg args: String): String {
        val process = ProcessBuilder(cliPath, *args)
            .directory(File(project.basePath ?: "."))
            .redirectErrorStream(true)
            .start()
        return process.inputStream.bufferedReader().readText().also {
            process.waitFor(10, TimeUnit.SECONDS)
        }
    }

    private fun findCliPath(): String {
        // Search in order:
        // 1. Bundled with plugin (plugin resources)
        // 2. Global npm install: `which provenance`
        // 3. npx: `npx @contrib-provenance/cli`
        // Throw with helpful message if not found
    }
}
```

### 6.2 Multi-Editor Session Merge

When a developer uses both VS Code and a JetBrains IDE on the same repo, they need a merged view.

#### 6.2.1 Design

Each editor writes to the SAME `.provenance/sessions/` directory (they share the repo root). The key challenge is that two editors might have overlapping active sessions.

**Solution: One session per editor, merge at export time.**

1. When an editor starts a session, it checks for other active sessions. If one exists from a different editor, it records itself as a "companion session" by writing its own `<uuid>.meta.json` with a `companion_of: <other-session-id>` field.
2. At export time, `provenance export` detects all sessions that are companions and merges their event streams.
3. The merged attestation sets `editors_used: ["vscode", "jetbrains"]` and `partial_session: false` (since both editors are covered).

#### 6.2.2 Merge Algorithm (`SessionMerger.ts` in core)

```typescript
async function mergeSessions(primaryId: string, companionIds: string[]): Promise<SessionMetrics> {
  // 1. Load all NDJSON event streams
  const allEvents: SessionEvent[] = [];
  for (const id of [primaryId, ...companionIds]) {
    allEvents.push(...await loadEvents(id));
  }

  // 2. Sort all events by timestamp (interleave)
  allEvents.sort((a, b) => a.timestamp - b.timestamp);

  // 3. Deduplicate: if two editors record an edit to the same file_hash
  //    within 1 second, keep only one (the edit event from the editor
  //    that had focus, determined by focus_change events)
  const deduped = deduplicateEvents(allEvents);

  // 4. Run standard MetricsComputer on merged stream
  return computeMetrics(deduped);
}
```

#### 6.2.3 Partial Session Detection

If a developer uses an editor without the plugin (e.g., Neovim), the session is partial.

**Detection heuristic:** At `provenance export` time:
1. Look at git log between session start and end commits.
2. If commits exist from the same identity that don't correspond to any tracked file edits, flag as potentially partial.
3. Set `partial_session: true` in the attestation.
4. Add a note to the attestation: "This session may not cover all editing activity."

### 6.3 New CLI Command for v0.4

`provenance session list` — shows all sessions with status, editor, and companion relationships.

```
$ provenance session list
SESSION ID                            STATUS    EDITOR     STARTED              COMPANION OF
a1b2c3d4-...                         ended     vscode     2026-03-11 09:15     —
b5c6d7e8-...                         ended     jetbrains  2026-03-11 09:20     a1b2c3d4-...
c9d0e1f2-...                         active    vscode     2026-03-11 14:00     —
```

---

## 7. PHASE v1.0 — OSS Mode + Fast-Lane + Marketplace

### 7.1 OSS Mode Changes

#### 7.1.1 Config Changes

`.github/provenance.yml` gains OSS-specific options:

```yaml
mode: oss

fast_lane:
  enabled: true
  sla_hours: 72
  label: "fast-lane"
  standard_label: "standard-queue"

# OSS-specific: softer defaults
signals:
  min_dwell_minutes: 10     # Lower bar for OSS
  require_test_run: false
  ai_disclosure_prompt: true

# OSS-specific: contributor-facing messaging
messaging:
  attested_comment: |
    ✅ Attestation verified. Review confidence: {confidence}.
    This PR qualifies for the fast-lane queue.
    Expected first review within {sla_hours}h.
  unattested_comment: |
    ⬜ No attestation provided.
    This PR is in the standard review queue.
    Want faster review? See CONTRIBUTING.md for the provenance-cli.
  no_gate: true              # Always true. Config exists for transparency.
```

#### 7.1.2 Fast-Lane Queue Logic

The "queue" is not a literal queue data structure. It is a label-based filtering system. There is no database — the Action applies labels and posts comments. Maintainers use GitHub's built-in label filtering to manage their review queue.

```typescript
// packages/action/src/index.ts (extended for v1.0 OSS mode)

async function handleOSSMode(
  octokit: Octokit,
  owner: string,
  repo: string,
  prNumber: number,
  config: ProvenanceYmlConfig,
  attestation: AttestationV1 | null
): Promise<void> {
  if (attestation) {
    const result = await verifyAttestation(attestation, { owner, repo, prNumber, octokit });
    const confidence = computeConfidence({
      metrics: attestation.session,
      config,
      verificationPassed: result.allPassed,
    });

    // Apply fast-lane label if confidence >= medium and verification passed
    if (result.allPassed && (confidence === "high" || confidence === "medium")) {
      await applyLabel(octokit, owner, repo, prNumber, config.fast_lane.label);
      const comment = renderAttestedComment(attestation, confidence, config);
      await upsertSummaryComment(octokit, owner, repo, prNumber, comment);
    } else {
      // Low confidence: standard queue
      await applyLabel(octokit, owner, repo, prNumber, config.fast_lane.standard_label);
      const comment = renderLowConfidenceComment(attestation, confidence, config);
      await upsertSummaryComment(octokit, owner, repo, prNumber, comment);
    }
  } else {
    // No attestation: standard queue
    if (config.fast_lane.standard_label) {
      await applyLabel(octokit, owner, repo, prNumber, config.fast_lane.standard_label);
    }
    const comment = renderUnattestedComment(config);
    await upsertSummaryComment(octokit, owner, repo, prNumber, comment);
  }
}
```

#### 7.1.3 SLA Tracking (Label-Based)

Without a database, SLA tracking is simplified to a purely label-based system:

- The Action applies `fast-lane` or `standard-queue` labels based on attestation confidence.
- The SLA commitment (e.g., "first review within 72 hours") is communicated in the PR comment text only. The Action does not track whether the SLA was met.
- Maintainers who want SLA analytics can:
  1. Use GitHub's built-in label filtering and sorting to see how long PRs with `fast-lane` labels sat before first review.
  2. Use the GitHub API to query label application timestamps and review submission timestamps.
  3. Use third-party tools (e.g., LinearB, Sleuth, or custom scripts) that consume GitHub event data.
- This is a deliberate simplification. A project that needs rigorous SLA tracking can build a lightweight bot or cron job that queries the GitHub API — but that is out of scope for the core Action.

### 7.2 Marketplace Listing

#### 7.2.1 VS Code Marketplace

- Publisher: `contrib-provenance`
- Extension ID: `contrib-provenance.contrib-provenance`
- Categories: `["Other", "SCM Providers"]`
- Icon, README, CHANGELOG in `packages/vscode/`
- Build via: `vsce package` then `vsce publish`

#### 7.2.2 JetBrains Marketplace

- Plugin ID: `com.contribprovenance.jetbrains`
- Published via Gradle: `./gradlew publishPlugin`
- Requires JetBrains marketplace vendor account

#### 7.2.3 GitHub Marketplace (Action)

The Action is published to the GitHub Marketplace as an Action (not an App):

- The Action lives in its own public repository: `contrib-provenance/action`
- Listing requires: description, icon, README, categories
- The `action.yml` metadata at the root of that repo defines the Action
- Users install by adding the workflow file to their repo (no OAuth flow, no installation step)
- Privacy policy URL (link to `docs/privacy.md`)
- Free, open-source

#### 7.2.4 npm Registry

- `@contrib-provenance/cli` published to npm
- `@contrib-provenance/core` published (for programmatic use)

### 7.3 CLI v1.0 Additions

The `provenance attach` command remains the same as v0.3. The `--mode` flag is removed since there is no API endpoint — the only upload method is posting a PR comment. This simplification is a direct benefit of the Action-based architecture.

---

## 8. TESTING STRATEGY

### 8.1 Unit Tests (all phases)

**Framework:** Vitest (fast, TypeScript-native, ESM support).

**Core package tests:**
- `MetricsComputer.test.ts` — Feed known event sequences, assert exact metric outputs. Test edge cases: empty session, single event, overlapping edits.
- `IterationDetector.test.ts` — Test various editing patterns: single pass, write-test-fix, interleaved file editing. Assert correct cycle counts.
- `PasteDetector.test.ts` — Test paste burst classification with various line counts.
- `AttestationBuilder.test.ts` — Build attestation from known metrics, verify schema compliance.
- `AttestationSigner.test.ts` — Sign with test GPG/SSH keys, verify round-trip.
- `SessionStore.test.ts` — Write/read NDJSON files, handle corruption gracefully.
- `ConfigStore.test.ts` — Load/validate configs, test defaults, test invalid configs.
- `identity.test.ts` — SHA256 email hashing, various email formats.

**CLI tests:**
- Each command tested via `yargs.parse()` with mocked filesystem.
- `init.test.ts` — Test directory creation, gitignore writing, hook installation.
- `session.test.ts` — Test start/end lifecycle, duplicate session prevention.
- `inspect.test.ts` — Test output formatting.
- `export.test.ts` — Test signing flow with mock keys.
- `attach.test.ts` — Test PR URL parsing, comment posting protocol.

**Action tests:**
- `verifyAttestation.test.ts` — Test each verification check independently. Mock Octokit responses.
- `computeConfidence.test.ts` — Test all confidence level boundaries with exact threshold values.
- `renderComment.test.ts` — Snapshot tests for comment Markdown output.
- `configSchema.test.ts` — Test valid and invalid provenance.yml files.
- `loadRepoConfig.test.ts` — Test config loading with mock GitHub API responses (found, not found, invalid YAML).
- `checkReplay.test.ts` — Test replay detection with mock search API responses.
- `findAttestationInComments.test.ts` — Test attestation extraction from various comment formats (valid, malformed, multiple attestations, no attestation).

### 8.2 Integration Tests

- **CLI integration:** Spawn real CLI process against a temp git repo. Verify session lifecycle end-to-end.
- **Signing integration:** Use real GPG/SSH test keys (generated in CI setup) to sign and verify attestations.
- **Action integration:** Use `@actions/github` mock context to simulate `pull_request` and `issue_comment` payloads end-to-end. No HTTP server needed since the Action is a plain Node.js script.

### 8.3 VS Code Extension Tests

- Use `@vscode/test-electron` to run tests inside a real VS Code instance.
- Open a test workspace, trigger document changes, verify events are recorded.
- Test status bar updates.
- Test auto-session start.

### 8.4 JetBrains Plugin Tests

- Use IntelliJ Platform test framework (`BasePlatformTestCase`).
- Minimal: test that the plugin loads without errors, service is registered.
- Test document listener fires on file changes.

### 8.5 Test Fixtures

```
packages/core/src/__fixtures__/
├── sessions/
│   ├── simple-edit.ndjson          # Basic editing session
│   ├── paste-heavy.ndjson          # Session with many paste bursts
│   ├── multi-iteration.ndjson      # Session with 3 iteration cycles
│   ├── idle-gaps.ndjson            # Session with long idle periods
│   └── multi-editor.ndjson         # Merged session from two editors
├── attestations/
│   ├── valid-gpg.json              # Valid GPG-signed attestation
│   ├── valid-ssh.json              # Valid SSH-signed attestation
│   ├── unsigned.json               # Unsigned attestation
│   └── tampered.json               # Attestation with modified metrics
└── configs/
    ├── internal.yml                # Internal mode config
    ├── oss-fastlane.yml            # OSS fast-lane config
    └── minimal.yml                 # Minimum valid config
```

---

## 9. BUILD AND RELEASE PIPELINE

### 9.1 CI Pipeline (`ci.yml`)

```yaml
name: CI
on: [push, pull_request]
jobs:
  lint-and-typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
      - run: npx turbo run lint typecheck

  test-core:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npx turbo run test --filter=@contrib-provenance/core

  test-cli:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npx turbo run test --filter=@contrib-provenance/cli

  test-action:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npx turbo run test --filter=@contrib-provenance/action

  test-vscode:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - uses: GabrielBB/xvfb-action@v1
        with:
          run: npx turbo run test --filter=contrib-provenance-vscode

  test-jetbrains:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-java@v4
        with: { java-version: 17, distribution: 'temurin' }
      - run: cd packages/jetbrains && ./gradlew test
```

### 9.2 Release Strategy

**Versioning:** All packages share the same version number (e.g., 0.1.0, 0.2.0, etc.). Turborepo handles synchronized versioning via changesets.

**CLI Release (`release-cli.yml`):** On git tag `v*`:
1. Build: `npx turbo run build --filter=@contrib-provenance/cli`
2. Publish: `npm publish --workspace=packages/cli`

**VS Code Release (`release-vscode.yml`):** On git tag `v*`:
1. Build: `cd packages/vscode && npx vsce package`
2. Publish: `npx vsce publish`

**JetBrains Release (`release-jetbrains.yml`):** On git tag `v*`:
1. Build: `cd packages/jetbrains && ./gradlew buildPlugin`
2. Publish: `./gradlew publishPlugin`

**Action Release (`release-action.yml`):** On git tag `v*`:
1. Build: `cd packages/action && npm run build` (runs `ncc build src/index.ts -o dist`)
2. Copy `action.yml` and `dist/` to a checkout of the `contrib-provenance/action` repo
3. Commit and push with the version tag (e.g., `v0.3.0`)
4. Update the major version tag (e.g., `v1` points to latest `v1.x.x`) so users pinning `@v1` get updates

```yaml
# release-action.yml
name: Release Action
on:
  push:
    tags: ['v*']
jobs:
  release-action:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
      - run: cd packages/action && npx ncc build src/index.ts -o dist --minify
      - name: Push to action repo
        uses: cpina/github-action-push-to-another-repository@main
        with:
          source-directory: 'packages/action'
          destination-github-username: 'contrib-provenance'
          destination-repository-name: 'action'
          target-branch: 'main'
        env:
          SSH_DEPLOY_KEY: ${{ secrets.ACTION_REPO_DEPLOY_KEY }}
      - name: Tag action repo
        run: |
          # Tag with full version and update major version tag
          VERSION=${GITHUB_REF#refs/tags/}
          MAJOR=$(echo $VERSION | cut -d. -f1)
          cd /tmp/action-repo
          git tag $VERSION
          git tag -f $MAJOR
          git push origin $VERSION
          git push origin $MAJOR --force
```

---

## 10. MIGRATION PATHS BETWEEN PHASES

### v0.1 to v0.2
- **No breaking changes.** v0.2 adds new commands (`inspect`, `export`) and the signing subsystem.
- Existing session NDJSON files are fully compatible.
- `.provenance/config.json` gains no new required fields.

### v0.2 to v0.3
- **No local breaking changes.** v0.3 adds the GitHub Action and `attach` command.
- Session meta gains a new status value: `"attached"` (after successful comment post).
- Maintainers add a workflow file (`.github/workflows/provenance.yml`) and a config file (`.github/provenance.yml`) to enable the Action. This is a one-time setup step.

### v0.3 to v0.4
- **Session meta gains new field:** `companion_of: string | null`. Existing session files default to `null`.
- **Attestation schema unchanged** — `editors_used` and `partial_session` were always in the schema from v0.1.
- JetBrains plugin is a new component, no migration needed.

### v0.4 to v1.0
- **Repo config gains `fast_lane` section.** Existing internal configs without it continue to work (fast_lane defaults to `{ enabled: false }`).
- **No database migration** — there is no database. The Action is stateless.
- **CLI:** No new flags needed. `provenance attach` behavior is unchanged.

---

## 11. ERROR HANDLING AND EDGE CASES

### 11.1 CLI Error Handling

| Scenario | Behavior |
|----------|----------|
| `provenance init` in non-git directory | Error: "Not a git repository. Run `git init` first." |
| `provenance session start` with no `.provenance/` | Error: "Not initialized. Run `provenance init` first." |
| `provenance session start` with active session | Warning + error: "Session `<id>` already active. End it first or pass `--force` to start a new one." |
| `provenance session end` with no active session | Error: "No active session found." |
| `provenance export` with active (not ended) session | Error: "Session still active. Run `provenance session end` first." |
| `provenance export` with no signing key | Warning: "No signing key found. Pass `--no-sign` to export unsigned, but the attestation cannot be verified." |
| GPG/SSH signing failure | Error with the tool's stderr. Suggest checking `git config user.signingkey`. |
| `provenance attach` with no GitHub remote | Error: "No GitHub remote found. Ensure `origin` points to GitHub." |
| `provenance attach` fails to post comment | Retry once. On second failure, save attestation locally and print: "Upload failed. Attestation saved at `<path>`. Upload manually or retry." |
| `provenance attach` with no GitHub auth | Error: "GitHub authentication required. Run `gh auth login` or set GITHUB_TOKEN." |
| Corrupt NDJSON file (invalid JSON line) | Skip corrupt lines, log warning. Process remaining valid events. |
| `.provenance/` directory deleted mid-session | On next event write, detect missing directory, recreate it, log warning about data loss. |
| Disk full | Catch ENOSPC, pause event recording, show status bar warning. |

### 11.2 Action Error Handling

| Scenario | Behavior |
|----------|----------|
| Invalid attestation JSON in PR comment | Post comment: "Attestation found but could not be parsed. Please regenerate with `provenance export`." |
| Signature verification fails | Post comment: "Attestation signature could not be verified. Ensure your signing key is uploaded to GitHub Settings > SSH and GPG keys." |
| Identity mismatch | Post comment: "Attestation identity does not match any commit author in this PR." |
| Replay detected | Post comment: "This attestation session ID has been used on a different PR. Please create a new session." |
| `.github/provenance.yml` missing | Do nothing (Action runs but repo not configured). Log info and exit. |
| `.github/provenance.yml` invalid | Post single issue comment: "provenance.yml contains errors: <details>. See docs for valid config." |
| GitHub API rate limit | Use exponential backoff via Octokit's built-in retry plugin. If exhausted, fail the Action run (GitHub Actions will show the failure). |
| GitHub Search API rate limit (replay check) | Log warning, skip replay check (fail-open). The replay check is defense-in-depth, not a hard gate. |
| Action triggered by non-PR issue_comment | The `if` condition in the workflow file filters these out. If it somehow fires, the Action detects no pull_request association and exits cleanly. |
| Multiple attestation comments on same PR | Use the most recent valid one. Earlier attestations are superseded. |
| Comment pagination (>100 comments) | Paginate through all comments using Octokit's `paginate` helper to ensure the attestation comment is found even on busy PRs. |

### 11.3 Rate Limiting

- **CLI:** No rate limiting needed (local tool).
- **Action:** Rate limits are governed by GitHub's API limits for the GITHUB_TOKEN (1,000 requests per hour per repo). The Action makes at most ~10 API calls per PR event, so this is not a concern.
- **Comment posting:** Maximum 1 provenance summary comment per PR (upsert via the `<!-- provenance-summary-v1 -->` marker). The contributor's attestation comment is separate and not managed by the Action.

---

## 12. SECURITY CONSIDERATIONS

### 12.1 Attestation Integrity

- The canonical JSON serialization (RFC 8785) ensures that re-serialization produces identical bytes, so signatures remain valid.
- The `commit` field binds the attestation to a specific git state. The `session_id` is a UUIDv4 that prevents cross-PR replay.
- The `identity` field is a SHA256 hash of the email, not the email itself. This prevents email enumeration while still allowing identity binding.

### 12.2 What Can Be Spoofed

- **Dwell time:** A malicious actor could leave their editor open. The 5-minute idle threshold mitigates casual inflation, but a script that generates fake edit events every 4 minutes would inflate dwell time. This is acknowledged as a limitation.
- **Iteration cycles:** Harder to fake because it requires editing previously-written regions after a gap. An automated script would need to understand the code structure.
- **Test runs:** Easy to fake by running `npm test` repeatedly. The `test_runs_observed` count is a weak signal on its own.
- **The composite signal is the value.** No single metric is reliable. The combination of dwell + iterations + post-insert edits + test runs is what provides confidence.

### 12.3 Privacy

- All file paths are SHA256 hashed before storage. Even in the local NDJSON log, file paths are hashed.
- No file content is ever stored, even locally.
- No clipboard content is accessed (the paste detector counts lines from the TextDocumentChangeEvent, not from the clipboard API, in VS Code; the JetBrains plugin reads clipboard line count only, not content, and discards it immediately).
- The `provenance inspect` command shows file hashes, not file names, unless run with `--resolve` which maps hashes to paths locally (never uploaded).

### 12.4 Action Security Model

- The Action runs in the context of the target repository's CI. It uses the `GITHUB_TOKEN` automatically scoped to that repository. No long-lived secrets or private keys are needed.
- The Action never checks out repository code (it only reads `.github/provenance.yml` via the GitHub API and PR comments via the Issues API). This minimizes the attack surface.
- Since the Action runs on `issue_comment` events, a malicious user could post a forged attestation comment. The signature verification step prevents this — without the contributor's private signing key, a forged attestation will fail verification and receive a "low" confidence label.
- The `GITHUB_TOKEN` permissions are scoped to `pull-requests: write` and `contents: read`. The Action cannot push code, modify workflows, or access secrets.

---

## 13. CONFIGURATION REFERENCE (ALL OPTIONS)

### 13.1 Global Config (`~/.config/provenance/config.json`)

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `version` | `1` | `1` | Config schema version |
| `default_signing_method` | `"gpg" \| "ssh" \| "auto"` | `"auto"` | Default signing method |
| `ai_disclosure_default` | `string \| null` | `null` | Pre-filled AI disclosure text |
| `telemetry` | `boolean` | `false` | Anonymous usage stats |

### 13.2 Project Config (`.provenance/config.json`)

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `version` | `1` | `1` | Config schema version |
| `remote` | `string` | (from git) | Repository remote |
| `initialized_at` | `string` | (auto) | ISO 8601 init timestamp |
| `signing_method` | `"gpg" \| "ssh" \| "auto"` | `"auto"` | Signing method for this repo |
| `hooks.pre_push` | `boolean` | `true` | Pre-push hook installed |

### 13.3 VS Code Extension Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `provenance.autoStart` | `boolean` | `true` | Auto-start session on repo open |
| `provenance.idleTimeoutMinutes` | `number` | `5` | Idle threshold for dwell computation |
| `provenance.showStatusBar` | `boolean` | `true` | Show status bar item |
| `provenance.autoExportOnCommit` | `boolean` | `false` | Auto-export when committing |

### 13.4 Repo Config (`.github/provenance.yml`)

Complete schema documented in section 2.7 above.

---

## 14. DEPENDENCY GRAPH AND BUILD ORDER

```
Phase v0.1:
  Build: core → cli → vscode
  Ship:  npm (cli), VS Code marketplace (vscode)

Phase v0.2:
  Build: core (add attestation/, crypto/) → cli (add inspect, export) → vscode (add inspect/export commands)
  Ship:  npm (cli, core), VS Code marketplace

Phase v0.3:
  Build: core (no changes) → action (new) → cli (add attach)
  Ship:  npm (cli), GitHub Marketplace (action), VS Code marketplace

Phase v0.4:
  Build: core (add SessionMerger) → jetbrains (new) → cli (add session list) → vscode (companion session support)
  Ship:  npm (cli, core), JetBrains marketplace, VS Code marketplace, GitHub Marketplace (action)

Phase v1.0:
  Build: core (no changes) → action (add OSS fast-lane logic)
  Ship:  All marketplaces, npm
```

---

### Critical Files for Implementation

- `/home/dan/osstool/contribution-provenance-v2.md` - Source design document containing all requirements, the canonical reference for every implementation decision
- `packages/core/src/session/MetricsComputer.ts` (to be created) - The most algorithmically complex file: computes dwell time, iteration cycles, and post-insert edit ratio from raw events. Every other component depends on its output.
- `packages/core/src/attestation/AttestationSigner.ts` (to be created) - The trust backbone: handles GPG and SSH signing/verification. Errors here break the entire verification chain.
- `packages/action/src/index.ts` (to be created) - The Action entry point: orchestrates config loading, attestation extraction from PR comments, verification pipeline, confidence computation, and summary comment posting. This replaces the entire Probot-based GitHub App.
- `packages/action/src/replay/checkReplay.ts` (to be created) - The stateless replay detection mechanism using GitHub Search API, replacing the database-backed approach. Critical to get the search query and fail-open behavior right.