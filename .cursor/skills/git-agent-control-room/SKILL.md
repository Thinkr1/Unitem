---
name: git-agent-control-room
description: Read Git-linked team and agent activity, summarize past/current/next workflow, and generate natural-language steering prompts.
---

# Git Agent Control Room

Use this skill when the user wants to understand or steer what agents/team
members are doing through Git-linked signals rather than through the product UI.

## Goal

Produce a concise "room read" that explains:

1. **Past** — what changed recently.
2. **Now** — what branches, PRs, CI runs, diffs, or artifacts are active.
3. **Next** — what should be done next, with copy-paste words for the right
   agent/person.

## Data boundary

Only claim what is backed by visible signals:

- `git status`, `git log`, `git diff`, local branch
- remote branches and open PRs
- CI run state and failure logs
- committed docs, screenshots, videos, or PR descriptions

If something is not visible in Git, CI, or artifacts, label it **unproven**.

## Read order

1. Read local state:
   - current branch
   - uncommitted changes
   - recent commits
2. Read remote state:
   - remote branches
   - open PRs
   - latest CI runs/logs when available
3. Read attached proof:
   - PR body
   - screenshots/videos
   - build or test outputs
4. Summarize the flow as `Past`, `Now`, `Next`.
5. Generate "words to steer" prompts for the next focused action.

## Output format

Use this structure:

- `Room read`: one paragraph describing the visible vibe.
- `Past`: bullets of recent changes and proof.
- `Now`: bullets of active branches/PRs/CI/artifacts/blockers.
- `Next`: three concrete moves.
- `Words to steer`: short prompts the user can paste into agents.
- `Proof needed`: tests/artifacts still required before trusting the work.

## Steering prompt patterns

- "Focus on `<branch-or-PR>`. Explain what changed, what proof exists, and what
  is still risky."
- "Find the lag. Only use Git, CI, PRs, and artifacts as evidence."
- "Turn recent commits into a before/after story."
- "Write a verifier prompt for the next agent. Keep it tied to current files."
- "Label anything not backed by Git/CI/artifacts as unproven."

## Guardrails

- Do not pretend to see private teammate activity.
- Do not infer agent intent beyond Git-linked evidence.
- Keep summaries actionable, not theatrical.
- Prefer exact branch, PR, file, commit, and artifact references.
