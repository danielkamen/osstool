<p align="center">
  <img src="fingerprint_imresizer.jpg" alt="Contribution Provenance" width="120" />
</p>

<h1 align="center">Contribution Provenance</h1>

<p align="center">
  <strong>Optional signed provenance for pull requests: show that code was iterated on and exercised, without recording raw keystrokes.</strong>
</p>

<p align="center">
  <a href="#why-this-exists">Why This Exists</a> &bull;
  <a href="#who-should-try-this-first">Who It's For</a> &bull;
  <a href="#2-minute-local-demo">2-Minute Demo</a> &bull;
  <a href="#what-this-does-not-claim">What It Doesn't Claim</a> &bull;
  <a href="#privacy">Privacy</a> &bull;
  <a href="#contributing">Contributing</a>
</p>

<p align="center">
  <a href="https://github.com/danielkamen/osstool/actions"><img src="https://img.shields.io/github/actions/workflow/status/danielkamen/osstool/ci.yml?branch=main&style=flat-square" alt="CI" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue?style=flat-square" alt="License" /></a>
</p>

---

## Why This Exists

Open-source maintainers are drowning in AI-generated drive-by PRs — mass-produced patches from agents that never ran the tests, never read the surrounding code, and never iterated on the change. Reviewing these wastes hours and burns out maintainers.

There is no good way to tell the difference. Pure AI detectors are unreliable, invasive, and accusatory. Manual review doesn't scale.

Contribution Provenance takes a different approach: instead of guessing _who_ wrote code, it records _how_ it was worked on. Aggregate signals — editing time, revision passes, test runs — are packaged into a signed snapshot that the contributor attaches to their PR. A GitHub Action reads the snapshot and labels the PR with a confidence level.

**Attested PRs can be fast-tracked. Unattested PRs follow the standard review queue. Missing attestation is not an accusation — it just means no extra signal is available.**

## Who Should Try This First

This is not for "all developers." It is for:

- **Maintainers of medium/large OSS repos** getting noisy, low-effort PRs
- **Security and DevEx teams** thinking about AI-generated contribution quality
- **Developers who care about trust and reputation** in code review

If you maintain a repo that has dealt with low-signal PR volume, or if you're thinking about AI contribution policies for your project, this tool was built for you.

## What This Does Not Claim

Be clear about what this is and is not:

- **It is optional.** Contributors are never required to use it.
- **Missing attestation is not an accusation.** It simply means no provenance data was provided.
- **It is a review signal, not a truth machine.** It helps prioritize, not gatekeep.
- **It tracks aggregate metrics only.** Never raw keystrokes, file contents, or clipboard data.
- **It does not prove authorship.** A determined actor could spoof signals. That's why this is a soft signal for prioritization, never a gate.

## 2-Minute Local Demo

### Maintainers: add the GitHub Action to your repo

The fastest way to try this is the GitHub Action. It scores PRs using server-side metrics (commit patterns, file diffs, temporal analysis) — no client-side tooling required for contributors at all.

```bash
# Any language — no Node.js required in your project
curl -fsSL https://raw.githubusercontent.com/danielkamen/osstool/main/scripts/setup.sh | sh
```

Or if you have Node installed locally:

```bash
npx @contrib-provenance/cli init --server-only
```

Both generate the GitHub Action config and workflow. Commit, push, and your PRs start getting labeled.

### Full setup (npm projects)

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

### For contributors (zero setup)

**npm projects:** Contributors don't need to install anything or learn any commands. When they clone your repo and run `npm install`, everything is automatic:

1. **Clone & install** — `npm install` installs the CLI as a devDependency, which auto-configures git hooks
2. **Code normally** — the [VS Code extension](https://marketplace.visualstudio.com/items?itemName=caiman.contrib-provenance-vscode) (if installed) tracks editing time, test runs, and iteration patterns silently
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

## How This Compares

|  | Raw AI detector | Contribution Provenance | Manual review alone |
|---|---|---|---|
| **Certainty** | Low — high false-positive rate | Moderate — measures engagement, not authorship | Varies by reviewer |
| **Privacy** | Often requires code/keystroke access | Aggregate metrics only, no raw content | N/A |
| **Spoof resistance** | Arms race with generators | Signatures + multiple signals raise the bar | Relies on reviewer intuition |
| **Maintainer friction** | Integrate + triage false positives | One-time GitHub Action setup | Status quo |
| **Developer friction** | Often involuntary | Optional, zero-setup for contributors | None |

## Packages

This is a monorepo managed with [Turbo](https://turbo.build). Each package has a focused responsibility:

| Package | Description |
|---|---|
| [`packages/core`](packages/core) | Session types, metrics, schema (Zod), signing & verification, storage |
| [`packages/cli`](packages/cli) | `provenance` CLI — `init`, `session start/end`, `inspect`, `export`, `attach` |
| [`packages/vscode`](packages/vscode) | [VS Code extension](https://marketplace.visualstudio.com/items?itemName=caiman.contrib-provenance-vscode) — auto-tracks edits, focus, test runs; status bar |
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

## Get Involved

We're looking for feedback, not adoption (yet). The most useful things you can do:

- **Try the GitHub Action on a test repo** and tell us where setup breaks
- **Roast the README or threat model** — open an issue with what doesn't hold up
- **Tell us if this fits your review flow** — or what would stop you from enabling it
- **Run the VS Code extension for one coding session** and share your experience

If you maintain a repo dealing with low-signal PR volume, we'd especially value your perspective on whether this is useful or dead-on-arrival for your workflow.

Contributions are also welcome — please open an issue or pull request.

## License

[MIT](LICENSE)
