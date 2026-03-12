<p align="center">
  <img src="fingerprint_imresizer.jpg" alt="Contribution Provenance" width="120" />
</p>

<h1 align="center">Contribution Provenance</h1>

<p align="center">
  <strong>Help OSS maintainers cut through low-effort PR spam. Signed proof that a human actually wrote the code.</strong>
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
  <a href="https://github.com/danielkamen/osstool/actions"><img src="https://img.shields.io/github/actions/workflow/status/danielkamen/osstool/ci.yml?branch=main&style=flat-square" alt="CI" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue?style=flat-square" alt="License" /></a>
</p>

---

Open-source maintainers are drowning in AI-generated drive-by PRs — mass-produced patches from agents that never ran the tests, never read the surrounding code, and never iterated on the change. Reviewing these wastes hours and burns out maintainers.

This project was written with AI assitance, but that doesn't matter, this isn't a 1k+ stared open source project.

Contribution Provenance gives contributors a way to **prove they actually did the work**. It tracks editing time, revisions, test runs, and paste patterns locally, then packages them into a signed snapshot attached to the PR. Maintainers can prioritize PRs that show real engagement and let the fire-and-forget ones wait.

**Always optional.** No attestation? No problem — the PR goes through normal review. Attested PRs just get fast-tracked.

## Quickstart

### For maintainers (one command)

```bash
# Install the CLI and set up everything in one shot
npm install -g @contrib-provenance/cli
provenance init
```

That single `provenance init` command:
- Creates `.provenance/` config (committed to repo so contributors get auto-tracking)
- Generates `.github/provenance.yml` with sensible defaults
- Generates `.github/workflows/provenance.yml` (the GitHub Action)
- Adds `@contrib-provenance/cli` as a devDependency
- Installs git hooks (pre-push, post-commit)

Commit the generated files and push. You're done.

Use `provenance init --minimal` if you only want the `.provenance/` directory and hooks without the GitHub Action setup.

### For non-npm repos (Rust, Python, Go, etc.)

No Node.js required in your project. One shell command sets up server-side PR scoring:

```bash
curl -fsSL https://raw.githubusercontent.com/danielkamen/osstool/main/scripts/setup.sh | sh
```

Or if you have Node installed locally (without adding it to your project):

```bash
npx @contrib-provenance/cli init --server-only
```

Both generate the GitHub Action config and workflow. The Action scores PRs using **server-side metrics only** (commit patterns, file diffs, temporal analysis) — no client-side tooling required for contributors at all.

### For contributors (zero setup)

**npm projects:** Contributors don't need to install anything or learn any commands. When they clone your repo and run `npm install`, everything is automatic:

1. **Clone & install** — `npm install` installs the CLI as a devDependency, which auto-configures git hooks
2. **Code normally** — the VS Code extension (if installed) tracks editing time, test runs, and iteration patterns silently
3. **Push** — the pre-push hook automatically builds and signs a provenance attestation
4. **Open a PR** — the GitHub Action reads the attestation and labels the PR with a confidence level

No manual `provenance` commands needed. The VS Code extension provides richer tracking data but is optional — git-derived metrics work automatically via the hooks.

**Non-npm projects:** Contributors don't need to do anything. The GitHub Action computes metrics server-side from the PR's commit history and file diffs. Richer client-side metrics are available if contributors install the VS Code extension, but it's entirely optional.

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

The system tracks **totals and counts only** — never raw keystrokes, file contents, or clipboard data. It measures:

| What we track | What it tells the reviewer |
|---|---|
| **Active editing time** | How long the contributor actually spent in the editor (pauses after 5 min of inactivity) |
| **Revision passes** | Did they go back and rework earlier code, or was it a single dump? |
| **Rework ratio** | What % of new lines were later refined — real coding involves iteration |
| **Test runs** | Did they actually run the tests before opening the PR? |
| **Bulk pastes** | Large single-shot inserts (≥5 lines) — common in AI-generated PRs |

These combine into an **activity level** on the PR:

| Level | What it means |
|---|---|
| **High** | 30+ min editing, multiple revision passes, reworked their code, ran tests |
| **Medium** | 10+ min editing with at least one revision pass, or partial criteria met |
| **Low** | Snapshot present but minimal hands-on activity detected |
| **None** | No snapshot provided — normal review queue, no judgment |

## Packages

This is a monorepo managed with [Turbo](https://turbo.build). Each package has a focused responsibility:

| Package | Description |
|---|---|
| [`packages/core`](packages/core) | Session types, metrics, schema (Zod), signing & verification, storage |
| [`packages/cli`](packages/cli) | `provenance` CLI — `init`, `session start/end`, `inspect`, `export`, `attach` |
| [`packages/vscode`](packages/vscode) | VS Code extension — auto-tracks edits, focus, test runs; status bar |
| [`packages/action`](packages/action) | GitHub Action — checks PRs for snapshots, labels them, posts summary comments |

## Snapshot Format

Activity snapshots follow the [`contribution-provenance/v1` schema](docs/spec/attestation-v1.schema.json):

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

Each snapshot is tied to a specific commit and signed with the developer's GPG or SSH key, so it can't be faked or reused on a different PR.

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
  min_active_minutes: 15
  min_revision_passes: 1
  min_rework_ratio: 0.25

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

Privacy is a hard constraint, not a toggle.

**Never collected:**
- Keystrokes or what you typed
- File contents or diffs
- Clipboard data
- Command arguments (only "a test ran", not what test)
- Network traffic
- Typing-style fingerprints

**What is collected:**
- Totals: minutes spent editing, files touched, test runs, bulk paste counts
- A hash of your Git email (not the email itself)

Everything stays on your machine until you run `provenance export`. You can review exactly what will be shared with `provenance inspect` first.

## Known Limitations

This tool is honest about its blind spots:

- **Copilot / inline AI** — Accepting a Copilot suggestion looks like a normal edit. We surface accepted-suggestion counts where the IDE exposes them, but it's not perfect.
- **Multiple editors** — If you split work across VS Code and Vim, the tool only sees the VS Code side. Gaps are flagged as `partial_session: true`.
- **Legit large pastes** — Moving code between files, running codemods, or vendoring types all look like bulk pastes. Paste size alone is never treated as a red flag.
- **Determined spoofing** — Someone could script an agent to drip-feed code slowly. That's why this is a *soft signal* for prioritization, never a gate.

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

Contributions are welcome! Please open an issue or pull request.

## License

[MIT](LICENSE)
