# Contribution Provenance
## Next-Generation Implementation Specification — Wedge-First Product Architecture

---

# Page 1 — Architecture & Core Product

## North Star: What We're Actually Building

Contribution Provenance is a three-layer open-source toolchain: a local session agent (CLI + editor plugins), a signed attestation format, and a GitHub App that surfaces review signals on PRs. It does not detect AI. It answers a single question for reviewers: does this pull request show evidence that a human engaged with the codebase, iterated on the change, and exercised the code?

The product ships against three specific adoption wedges — internal engineering teams, OSS fast-lane review, and education — each with distinct UX, surfacing, and trust models. This document specifies how the product is used, installed, and experienced in each context.

> **The tool is always optional. Attestation is an incentive, never a gate. A missing attestation is not an accusation.**

---

## Core Architecture (Shared Across All Wedges)

### Component 1 — Session Agent

The session agent runs locally during development. It is available as a standalone CLI and as a VS Code extension and JetBrains plugin. It requires zero configuration beyond authenticating against a local git identity.

| CLI Command | What It Does |
|---|---|
| `provenance init` | One-time setup in repo root. Writes `.gitignore`-d config. Binds to git remote. |
| `provenance session start` | Opens a named session. Editor plugins call this automatically on repo open. |
| `provenance session end` | Closes session, finalises event log, computes aggregates. |
| `provenance inspect` | Prints your own session log in plain text. Contributor reviews before upload. |
| `provenance export` | Generates signed attestation JSON. Prompts for optional AI disclosure note. |
| `provenance attach <PR>` | Uploads attestation to GitHub PR as a draft check artifact. |

---

### Component 2 — Attestation Schema

The attestation is a JSON file signed with the contributor's local git signing key (GPG or SSH). It contains no raw file content and no keystroke data — only aggregated behavioral metadata.

```json
{
  "schema":   "contribution-provenance/v1",
  "repo":     "github.com/owner/repo",
  "commit":   "<HEAD SHA at export time>",
  "identity": "<git user.email SHA256 hash>",
  "session": {
    "dwell_minutes":          74,
    "active_files":           5,
    "iteration_cycles":       3,
    "post_insert_edit_ratio": 0.41,
    "test_runs_observed":     2,
    "largest_paste_lines":    112,
    "paste_burst_count":      4
  },
  "disclosure":   "AI used for scaffolding in parser.ts. Logic and tests written by hand.",
  "tool_version": "0.4.1",
  "signature":    "<ed25519 sig>",
  "timestamp":    "2025-03-11T14:22:00Z"
}
```

> **`provenance inspect` shows the full log before export. Contributors always know exactly what's being signed and uploaded.**

---

### Component 3 — GitHub App

The GitHub App receives the uploaded attestation, verifies the signature against the PR's commit history, computes a confidence label, and posts a structured comment. It also applies a PR label. The App is open-source and self-hostable. Maintainers configure it via `.github/provenance.yml`.

| Confidence Label | Criteria |
|---|---|
| ✅ High iteration signal | Dwell > 30 min, 2+ iteration cycles, post-insert edit ratio > 25%, at least 1 test run. |
| ⚠️ Medium iteration signal | Dwell > 10 min, 1 iteration cycle detected, or contributor self-disclosed AI use with edits. |
| 🟡 Low iteration signal | Short session, single large insert, no test runs, no post-insert edits detected. |
| ⬜ No attestation | Contributor did not use the tool. No inference made. Standard review queue. |

---
---

# Page 2 — Wedge 01: Internal Engineering Teams

*Full installation flow, surfacing model, and team configuration*

## Why This Wedge First

Internal teams are the only context where all three preconditions for adoption are met simultaneously: standardized editors (controllable), employment consent (no coercion question), and same trust domain (attestation gaming carries real consequences). This is the validation environment for the whole product. If it doesn't work here, it doesn't work anywhere.

---

## Installation Flow

| # | Actor | Action |
|---|---|---|
| 1 | Eng admin | Installs the Contribution Provenance GitHub App on the org. Configures `.github/provenance.yml` with `mode: internal` and desired signals. |
| 2 | Developer | Installs CLI: `npm install -g @contrib-provenance/cli` or the VS Code / JetBrains plugin (auto-bundles CLI). Runs `provenance init` once in each repo. |
| 3 | Developer | Session starts automatically when they open the repo in the monitored editor. CLI users run `provenance session start`. No other workflow change. |
| 4 | Developer | At PR creation, the pre-push hook (installed by `provenance init`) runs `provenance export` automatically and calls `provenance attach`. Contributor sees a preview of the attestation in terminal and can abort. |
| 5 | Reviewer | GitHub App posts a structured comment on the PR within seconds. PR receives a label. Reviewer sees the signal inline — no extra tool, no dashboard login required. |
| 6 | Eng lead | Optional dashboard (self-hosted or cloud) aggregates team-level signals over time: avg iteration depth per engineer, test-run rates, AI-disclosure trends. |

---

## What the Reviewer Sees

The PR comment is designed to be scannable in under five seconds. It is not a verdict — it is a signal that a reviewer factors in alongside the diff.

```
🤖 provenance-bot  commented on this pull request
─────────────────────────────────────────────────────────
── Contribution Provenance Report ──

✅ Attestation:              Verified (ed25519, git identity bound)
Review confidence:           • HIGH iteration signal
Active editing time:         74 min across 5 files
Iteration cycles:            3 distinct revision phases
Post-insert edit ratio:      41% of inserted lines subsequently edited
Test runs observed:          2 (npm test)
Largest paste burst:         112 lines (src/parser.ts)
AI disclosure (optional):    "Used for scaffolding in parser.ts only"
Tool version:                contrib-provenance v0.4.1
```

---

## Configuration (`.github/provenance.yml`)

```yaml
mode: internal
require_attestation: false          # never a hard gate
fast_lane_label: provenance-high    # applied automatically by App
signals:
  min_dwell_minutes: 15
  require_test_run: false            # flag, not block
  ai_disclosure_prompt: true         # asks contributor at export time
privacy:
  upload_paste_content: false        # never upload file content
  upload_command_args: false         # only command presence, not args
notifications:
  slack_webhook: https://hooks.slack.com/...   # optional
```

---
---

# Wedge 02: OSS Fast-Lane Review

*How open-source maintainers surface and incentivize attestation without coercion*

## Core Mechanic: Two Queues, One Incentive

The fast-lane is not a reward system. It is an honest statement of reviewer bandwidth. Maintainers publicly declare that attested PRs receive a faster review SLA because the reviewer can front-load confidence without reading the full diff cold. Unattested PRs are not penalized — they simply join the standard queue.

**Standard Queue (No Attestation)**
- PR opens → assigned to normal review backlog
- Reviewer reads diff cold, no context on contributor process
- Review SLA: best-effort (days to weeks for large projects)
- No label applied. No negative inference.
- Contributor may optionally add attestation later to move queue

**Fast Lane (Attested)**
- PR opens + attestation uploaded → provenance-app verifies
- App posts review signal comment + applies `attested` label
- Reviewer sees confidence summary before opening diff
- Review SLA: committed (e.g., 72h for high-signal PRs)
- Maintainer README advertises the two-queue model openly

---

## Maintainer Setup Flow

| # | Step | Detail |
|---|---|---|
| 1 | Install App | Maintainer installs Contribution Provenance GitHub App from GitHub Marketplace (free, open-source). Authorises read on PR artifacts. |
| 2 | Add config | Add `.github/provenance.yml` with `mode: oss`. Set `fast_lane_sla` (e.g., `'72h'`) and the label names to apply. Commit. |
| 3 | Update README | Add a short CONTRIBUTING.md section: "Attested PRs are reviewed within 72h. Install provenance-cli to generate an attestation." Link to docs. |
| 4 | PR arrives | On any PR, App checks for attestation artifact. Posts comment regardless (verified / not provided). Applies appropriate label. |
| 5 | Reviewer workflow | Reviewer filters by `attested` label when they have review capacity. High-signal PRs get first pass. Standard queue is not abandoned. |

---

## What OSS Contributors See

**Attested PR:**
```
✅ Attestation verified. Review confidence: HIGH.

This PR qualifies for the fast-lane queue.
Expected first review within 72h.

Active editing: 74 min  •  3 iteration phases  •  Tests run: yes
```

**Unattested PR:**
```
⬜ No attestation provided.

This PR is in the standard review queue. No inference is made
about the quality or origin of the contribution.

Want faster review? See CONTRIBUTING.md for the provenance-cli.
```

---
---

# Page 3 — Wedge 03: Education & Bootcamps

*Instructor workflow, student experience, and assignment integration*

## Why Education Is the Strongest Wedge

The Google Docs revision history analogy is strongest here. Educators already have a legitimate, socially-accepted interest in process evidence — not just final output. Contribution Provenance translates that existing norm into code submissions without requiring a full AI detection apparatus. The privacy question is also cleanest: students understand the context, consent is built into enrollment, and the tool replaces the honor code checkbox with actual evidence of engagement.

> **This is not about catching cheaters. It is about making process quality a gradable dimension alongside output quality.**

---

## Student Experience

| # | Step | Detail |
|---|---|---|
| 1 | Onboarding | Instructor shares repo link + provenance setup guide. Student runs `provenance init` once. Editor plugin handles the rest automatically for VS Code and JetBrains users. |
| 2 | Working on assignment | Student codes normally. Session agent runs in background. Student can run `provenance inspect` at any time to review what's being recorded. |
| 3 | Submission | Student runs `provenance export` before opening a PR or submitting. Reviews summary. Optionally adds a reflection note (like an AI disclosure but for any context). Runs `provenance attach <PR>`. |
| 4 | Instructor review | GitHub App posts attestation summary. Instructor sees session timeline alongside the diff. Dashboard aggregates across all students for the assignment. |

---

## Instructor Dashboard

| Dashboard View | Signal Shown | Instructor Use |
|---|---|---|
| Assignment overview | Distribution of dwell time, iteration counts across cohort | Spot outliers at either extreme (unusually fast OR unusually slow) |
| Per-student timeline | Session phases, paste events, test runs, revision arcs | Understand how a student approached the problem; identify confusion points |
| AI disclosure log | Student's self-reported AI usage notes | Assess appropriate vs. inappropriate reliance on tooling for the assignment type |
| Process quality score | Composite: dwell + iteration + test run + post-insert edits | Use as one grading dimension (process) alongside output quality rubric |
| Anomaly flags | Single-insert, no-dwell, no-test submissions | Prompt a conversation with student — never automatic grade penalty |

---

## GitHub Classroom Integration Path

Contribution Provenance integrates with GitHub Classroom's assignment workflow via the GitHub App. Instructors add `provenance-check` as a required status in the Classroom assignment settings. The check is advisory (never a build-blocking gate) but surfaces in the student's PR view alongside CI results. Students see their own process signal before the instructor does, encouraging self-reflection.

---
---

# Page 4 — Privacy, Limits & Build Sequence

## Privacy Architecture

Privacy is a first-class constraint, not an afterthought. The following rules are hard-coded into the session agent and enforced in the attestation schema validator.

**Never Collected**
- Raw keystrokes or character-level input
- File contents at any point in the session
- Clipboard contents of pasted text
- Shell command arguments (only presence: "test ran" not `npm test --grep auth`)
- Network traffic or external API calls
- Anything outside the monitored git repo directory
- Biometric or timing data that could fingerprint typing style

**Always Collected (aggregates only)**
- Total active editing time per file (minutes)
- Number of paste burst events and approximate line count
- Ratio of inserted lines subsequently modified
- Count of test/lint/build command invocations
- Number of distinct edit phases (iteration cycles)
- Session start/end timestamps
- Git identity hash (email SHA256, not plaintext)

> **The `provenance inspect` command shows the full local log in plain language before anything is signed or uploaded. No surprises.**

---

## Known Failure Modes (Honest)

These are the cases where the tool's signals are structurally weakened. They are documented here because honest communication of limitations is part of the privacy and trust strategy. Overclaiming accuracy destroys the product faster than any attack.

| Failure Mode | Impact | Honest Response |
|---|---|---|
| AI agent inside monitored editor | High | Copilot/Cursor suggestions accepted inside VS Code look like real edits. Agent-generated code cannot be distinguished from typed code at the event level. We surface accepted-suggestion count where the IDE exposes it (VS Code API). We do not claim to solve this. |
| Multi-editor workflow | Med | Developer uses Neovim for heavy editing, plugin only tracks VS Code session. Coverage gaps are surfaced honestly in the attestation ('partial session: 1 of 3 editors'). Not penalised. |
| Legitimate large pastes | Med | Moving code between files, applying codemods, vendoring types, and porting from a branch all produce large paste events. These are noted explicitly in reviewer guidance: paste size alone is never a signal. |
| Slow-drip agent spoofing | High | Sophisticated actor uses an agent that inserts code gradually to mimic typing. Iteration cycles and test runs are harder to fake, but not impossible. This is why the tool is a soft signal, not a gate. |
| Unsigned attestation replay | Low | Commit SHA + timestamp binding makes cross-PR replay detectable. Same-PR replay is mitigated by session ID uniqueness. Explained in verification docs. |

---

## Build Sequence: What Ships in What Order

The wedge order is also the build order. Internal teams validate the signal model under controlled conditions. OSS fast-lane tests the incentive mechanic under adversarial conditions. Education validates the dashboard layer. Nothing in the OSS or education wedge gets built until the internal wedge is proven.

| Phase | Deliverable | Success Criterion | Unlocks |
|---|---|---|---|
| v0.1 | CLI + VS Code plugin (session tracking only) | 10 internal devs use it for 4 weeks without friction complaints | Schema design validation |
| v0.2 | Attestation export + `provenance inspect` | Contributors review and understand their own log before upload | Privacy posture confirmed |
| v0.3 | GitHub App (internal mode only) | PR comments posted correctly; no false-positive high-signal labels on one-shot PRs | Signal model calibration |
| v0.4 | JetBrains plugin + multi-editor session merge | Partial session flagging works; developers with split workflows not penalised | OSS wedge readiness |
| v1.0 | OSS mode + fast-lane config + public marketplace listing | 3 open-source repos adopt fast-lane; contributor friction <5% opt-out rate on attested repos | Education wedge |
| v1.5 | Instructor dashboard + GitHub Classroom integration | Pilot with 2 bootcamps; instructors replace honor code checklist for 1 assignment type | Full product launch |

> **The product is finished when the attestation format is boring enough that GitHub could absorb it as a native PR feature. That's the exit, not the failure.**
