<p align="center">
  <img src="docs/assets/logo-placeholder.svg" alt="Contribution Provenance" width="120" />
</p>

<h1 align="center">Contribution Provenance</h1>

<p align="center">
  <strong>Transparent, signed attestations of developer engagement for code review.</strong>
</p>

<p align="center">
  <a href="#quickstart">Quickstart</a> &bull;
  <a href="#how-it-works">How It Works</a> &bull;
  <a href="#packages">Packages</a> &bull;
  <a href="#configuration">Configuration</a> &bull;
  <a href="#privacy">Privacy</a> &bull;
  <a href="#contributing">Contributing</a>
</p>

<p align="center">
  <a href="https://github.com/anthropics/contribution-provenance/actions"><img src="https://img.shields.io/github/actions/workflow/status/anthropics/contribution-provenance/ci.yml?branch=main&style=flat-square" alt="CI" /></a>
  <a href="https://www.npmjs.com/package/@contrib-provenance/cli"><img src="https://img.shields.io/npm/v/@contrib-provenance/cli?style=flat-square" alt="npm" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue?style=flat-square" alt="License" /></a>
</p>

---

Contribution Provenance is a toolchain that generates **cryptographically signed attestations** of how code was written. It gives code reviewers a lightweight, voluntary signal: *"Does this PR show evidence that a human engaged with the codebase, iterated on changes, and exercised the code?"*

**Attestation is always optional.** Missing attestation is never an accusation — unattested PRs simply follow the standard review queue. Attested PRs can be fast-tracked.

## Quickstart

### For developers

```bash
# Install the CLI
npm install -g @contrib-provenance/cli

# One-time repo setup (creates .provenance/ config, installs pre-push hook)
provenance init --signing auto --hooks

# Start a coding session (or use the VS Code extension for auto-tracking)
provenance session start

# ... write code, run tests, iterate ...

provenance session end

# Generate a signed attestation and attach it to your PR
provenance export
provenance attach <PR-URL>
```

### For maintainers

Add a GitHub Action and config to your repo:

```yaml
# .github/provenance.yml
version: 1
mode: oss
labels:
  high: provenance-high
  medium: provenance-medium
  low: provenance-low
signals:
  min_dwell_minutes: 15
  min_iteration_cycles: 1
  min_post_insert_ratio: 0.25
notifications:
  comment_on_pr: true
```

Then add the GitHub Action to your CI workflow. It will automatically verify attestations on incoming PRs and apply confidence labels.

## How It Works

```
Developer                          GitHub
┌──────────────┐                   ┌──────────────────┐
│  VS Code ext │──events──▶│      │  GitHub Action    │
│  or CLI      │           │      │                   │
└──────┬───────┘           │      │  1. Load config   │
       │                   │      │  2. Find artifact  │
  session start            │      │  3. Verify sig    │
       │                   │      │  4. Check binding  │
  ... code ...             │      │  5. Score signals  │
       │                   │      │  6. Label PR       │
  session end              │      └──────────────────┘
       │                   │               ▲
  provenance export        │               │
       │                   │          attestation
  provenance attach ───────┴──────────────▶│
```

The system tracks **aggregate metrics only** — never raw keystrokes, file contents, or clipboard data. It measures:

| Signal | What it captures |
|---|---|
| **Dwell time** | Total active editing time (5-min idle threshold) |
| **Iteration cycles** | Revisits to previously edited regions after breaks |
| **Post-insert edit ratio** | Lines inserted then later refined (vs. fire-and-forget) |
| **Test runs observed** | Detected test/lint/build executions |
| **Paste bursts** | Large single-operation inserts (≥5 lines) |

These signals combine into a **confidence level**:

| Level | Criteria |
|---|---|
| **High** | >30 min dwell + 2+ iterations + >25% post-insert edits + test run |
| **Medium** | >10 min dwell + 1 iteration, or partial criteria met |
| **Low** | Attestation present but signals below thresholds |
| **None** | No attestation provided |

## Packages

This is a monorepo managed with [Turbo](https://turbo.build). Each package has a focused responsibility:

| Package | Description |
|---|---|
| [`packages/core`](packages/core) | Session types, metrics computation, attestation schema (Zod), crypto (GPG/SSH signing & verification), storage |
| [`packages/cli`](packages/cli) | `provenance` CLI — `init`, `session start/end`, `inspect`, `export`, `attach` |
| [`packages/vscode`](packages/vscode) | VS Code extension — auto-tracks edits, focus, test runs; status bar integration |
| [`packages/action`](packages/action) | GitHub Action — verifies attestations on PRs, applies labels, posts summary comments |

## Attestation Format

Attestations follow the [`contribution-provenance/v1` schema](docs/spec/attestation-v1.schema.json):

```jsonc
{
  "schema": "contribution-provenance/v1",
  "repo": "github.com/owner/repo",
  "commit": "<HEAD SHA>",
  "identity": "<SHA256(git user.email)>",
  "session": {
    "session_id": "uuid",
    "dwell_minutes": 74,
    "active_files": 5,
    "iteration_cycles": 3,
    "post_insert_edit_ratio": 0.41,
    "test_runs_observed": 2,
    "largest_paste_lines": 112,
    "paste_burst_count": 4,
    "editors_used": ["vscode"],
    "partial_session": false
  },
  "disclosure": "AI used for scaffolding. Logic/tests by hand.",
  "tool_version": "0.1.0",
  "timestamp": "2025-03-11T14:22:00Z",
  "signature": "<ed25519 sig>",
  "signature_format": "ssh"
}
```

Attestations are bound to a specific commit SHA and signed with the developer's GPG or SSH key, preventing replay and tampering.

## Configuration

### CLI (`provenance init`)

Running `provenance init` creates a `.provenance/` directory in your repo with:
- Signing key configuration (auto-detects GPG or SSH)
- Optional pre-push hook to remind you to export before pushing

### GitHub Action

Configure via `.github/provenance.yml`:

```yaml
version: 1
mode: oss                          # "oss" or "internal"

labels:
  high: provenance-high
  medium: provenance-medium
  low: provenance-low
  none: provenance-none            # optional

signals:
  min_dwell_minutes: 15
  min_iteration_cycles: 1
  min_post_insert_ratio: 0.25

bypass:
  users: ["dependabot[bot]"]       # skip verification for bots
  labels: ["dependencies"]         # skip for dependency updates

notifications:
  comment_on_pr: true
  slack_webhook: ""                # optional Slack notifications

fast_lane:
  enabled: true
  sla_hours: 24                    # target review SLA for attested PRs
```

### VS Code Extension

| Setting | Default | Description |
|---|---|---|
| `provenance.autoStart` | `true` | Auto-launch session when opening a provenance-enabled repo |
| `provenance.idleTimeoutMinutes` | `5` | Minutes of inactivity before pausing the session timer |

## Privacy

Contribution Provenance is designed with privacy as a hard constraint, not a feature toggle.

**Never collected:**
- Raw keystrokes or character-level input
- File contents or diffs
- Clipboard data
- Command arguments (only presence of test/build runs)
- Network traffic
- Biometric or typing-cadence fingerprints

**What is collected:**
- Aggregate time-based metrics (total minutes, not timestamps of individual actions)
- Event counts (files edited, test runs, paste bursts)
- A hash of your Git email (not the email itself)

All data stays local until you explicitly run `provenance export`. You can inspect the full attestation with `provenance inspect` before sharing it.

## Known Limitations

This project is honest about what it can and cannot detect:

- **AI agents in the editor** — Copilot-style suggestions can look like real edits. VS Code API hooks help but aren't perfect.
- **Multi-editor workflows** — Switching between editors may create coverage gaps, flagged as `partial_session: true`.
- **Legitimate large pastes** — Code motion, codemods, and vendoring are valid workflows that produce paste-like signals.
- **Sophisticated spoofing** — A determined actor could mimic gradual insertion. This is why attestation is a *soft signal*, never a gate.

## Development

```bash
# Prerequisites: Node.js 20+, npm 11+

# Install dependencies
npm install

# Build all packages
npm run build

# Run tests
npm run test

# Type-check
npm run typecheck

# Lint
npm run lint
```

The monorepo uses [Turbo](https://turbo.build) for task orchestration. Package dependencies are resolved automatically — `turbo run build` builds `core` before `cli` and `action`.

## Roadmap

| Phase | Focus |
|---|---|
| **v0.1–0.4** | Signal validation with internal teams |
| **v1.0** | OSS fast-lane mode for open-source maintainers |
| **v1.5** | Education dashboard & GitHub Classroom integration |

## Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

[MIT](LICENSE)
