# Contribution Provenance for VS Code

Automatically track your development sessions and generate cryptographically signed attestations of developer engagement for code review.

## Features

- **Automatic session tracking** — starts recording when you open a provenance-enabled repo
- **Edit metrics** — tracks dwell time, iteration cycles, and post-insert edit ratio without capturing keystrokes or file contents
- **Test run detection** — monitors terminal output for test, lint, and build executions
- **Status bar integration** — shows session state and elapsed time at a glance
- **Export & attach** — generate signed attestations and attach them to pull requests

## Getting Started

1. Install the [Contribution Provenance CLI](https://www.npmjs.com/package/@contrib-provenance/cli):
   ```bash
   npm install -g @contrib-provenance/cli
   ```

2. Initialize provenance in your repository:
   ```bash
   provenance init --signing auto --hooks
   ```

3. Open the repo in VS Code — the extension activates automatically and begins tracking.

4. When you're ready to submit a PR:
   ```bash
   provenance export
   provenance attach <PR-URL>
   ```

## Commands

| Command | Description |
|---|---|
| `Provenance: Start Session` | Begin tracking a coding session |
| `Provenance: End Session` | Stop tracking and finalize metrics |
| `Provenance: Checkpoint Session` | Capture metrics without ending the session |
| `Provenance: Show Session Status` | Display current session details |
| `Provenance: Inspect Current Session` | View the full session data |
| `Provenance: Export Attestation` | Generate a signed attestation file |

## Settings

| Setting | Default | Description |
|---|---|---|
| `provenance.autoStart` | `true` | Automatically start a session when opening a provenance-enabled repo |
| `provenance.idleTimeoutMinutes` | `5` | Minutes of inactivity before the session timer pauses |

## Privacy

This extension collects **aggregate metrics only** — never raw keystrokes, file contents, or clipboard data. All data stays local until you explicitly export an attestation. See the [project README](https://github.com/danielkamen/osstool#privacy) for full details.

## License

[MIT](https://github.com/danielkamen/osstool/blob/main/LICENSE)
