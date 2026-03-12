# Changelog

All notable changes to the Contribution Provenance VS Code extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-03-12

### Added

- Automatic session tracking when opening a provenance-enabled repository
- Edit tracking via `onDidChangeTextDocument` listener
- Idle detection with configurable timeout (`provenance.idleTimeoutMinutes`)
- Test/build run detection through terminal output monitoring
- Status bar indicator showing session state and elapsed time
- Commands:
  - `Provenance: Start Session` — begin tracking a coding session
  - `Provenance: End Session` — stop tracking and finalize metrics
  - `Provenance: Checkpoint Session` — capture metrics without ending the session
  - `Provenance: Show Session Status` — display current session details
  - `Provenance: Inspect Current Session` — view the full session data
  - `Provenance: Export Attestation` — generate a signed attestation file
- Configuration options:
  - `provenance.autoStart` — auto-launch session on workspace open (default: `true`)
  - `provenance.idleTimeoutMinutes` — idle timeout in minutes (default: `5`)
