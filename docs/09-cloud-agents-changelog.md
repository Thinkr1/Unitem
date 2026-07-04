# 09 — Cloud Agents Setup: Changelog & Rationale

> **What this document is:** a plain-language record of the Cursor cloud-agents
> work done on the branch `cursor/cloud-agents-setup-a02e` ([PR #3](https://github.com/Thinkr1/Unitem/pull/3)) —
> every change, *why* it was made, and *how it affects the product*.
> `ARCHITECTURE.md` remains the authoritative spec; this file just explains the
> agent-configuration layer that wraps it.

---

## TL;DR

- We added an **in-repo Cursor agent configuration** (`.cursor/`) so Unitem's
  propagate/hold/flag pipeline can be run by AI agents — locally and as cloud agents —
  with consistent behavior grounded in our own architecture.
- The first draft also scaffolded an engine, a dashboard, and sample apps. Once the
  team's authoritative `ARCHITECTURE.md` and `/UI` app landed on `main`, **we removed
  all of that** because it competed with work owned by the UI and architecture owners.
- The PR is now scoped **only** to `.cursor/` + setup docs — the cloud-agents piece —
  and is fully aligned with `ARCHITECTURE.md` (Unitem naming, Login screen,
  Kotlin/Compose, `audit`/`diff` modes, the `tickets.json` schema, and the engine API
  on port 8787).

---

## Timeline of what happened

### Revision 1 — initial setup
Created a complete `.cursor/` agent config **plus** a starter engine (`engine/`),
a Next.js dashboard (`dashboard/`), Kotlin/Swift sample apps, and a
`knowledge-base/`. At the time, `main` only had planning docs and a bare README, so
this was a best-guess scaffold to make the cloud agents runnable end-to-end.

### Revision 2 — realignment (current state)
`main` gained two authoritative files: **`ARCHITECTURE.md`** and
**`UI/ARCHITECTURE-ALIGNMENT.md`**, plus the real **`/UI`** review console. These
changed several assumptions. We re-checked everything and **stripped the parts that
now conflicted**, keeping only the cloud-agents configuration and aligning it to the
authoritative spec.

---

## Changes in detail

### 1. Added — `.cursor/` agent configuration (kept)

| Path | What it does |
|------|--------------|
| `.cursor/rules/unitem.mdc` | Core rules every agent follows: the three verdicts, hard constraints, the pipeline, repo layout |
| `.cursor/rules/swift-ios.mdc`, `kotlin-android.mdc` | Platform-specific guidance for Swift/SwiftUI and Kotlin/Compose |
| `.cursor/agents/orchestrator.md` | Coordinates the full pipeline (discover → map → judge → reconcile → review) |
| `.cursor/agents/classifier.md` | The "brain": classifies a change as propagate/hold/flag, grounded in the convention KB |
| `.cursor/agents/ios-patcher.md`, `android-patcher.md` | Generate the minimal counterpart code fix on the target platform |
| `.cursor/agents/verifier.md` | Builds + screenshot-checks a fix before it merges |
| `.cursor/agents/security-reviewer.md` | Secrets / unsafe-pattern checks on PRs |
| `.cursor/skills/*` | `detect-diff`, `classify-change`, `generate-fix`, `run-pipeline` — invokable workflows |
| `.cursor/BUGBOT.md` | PR-review rules for Bugbot |
| `.cursor/environment.json` | Cloud VM setup (installs the `/UI` app; engine command is a placeholder) |
| `.cursor/hooks.json` | Reminder hook after editing a mapped screen file |
| `.cursor/cloud-agent-prompts.md` | Copy-paste prompts for cursor.com/agents |

**Why:** the original request was to "set up all the cloud agents." These files are
exactly that — they encode *how* Unitem's agents should behave so any agent run
(local or cloud) produces consistent, on-spec results instead of ad-hoc guesses.

### 2. Added — `docs/08-cloud-agents-setup.md` (kept)

Step-by-step **dashboard activation** guide (connect GitHub, create the cloud
environment, enable Bugbot + Security automations, add API-key secrets).

**Why:** those steps can only be done in the Cursor dashboard, not in the repo. This
doc is the checklist so anyone on the team can turn the agents on.

### 3. Removed — engine, dashboard, sample apps, knowledge-base

Deleted `dashboard/`, `engine/`, `sample-ios/`, `sample-android/`, `knowledge-base/`.

**Why:**
- `ARCHITECTURE.md` §6/§7 declares the **`/UI` app (React + Vite + Electron) the
  official front end** — "already built… we extend its data contract, not its
  layout." Our `dashboard/` (Next.js) duplicated and competed with it.
- `ARCHITECTURE.md` §10 assigns the **`/engine` unitem Python package** (and the
  sample apps + `/conventions`) to the architecture owner, with a specific module
  layout, two operating modes, and a runner abstraction. Our starter engine had a
  different shape and would have collided with that work.
- Keeping them would have created merge conflicts and confusion about who owns what.

### 4. Realigned — `.cursor/` content to the authoritative spec

| Was (first draft) | Now (matches `ARCHITECTURE.md`) | Why |
|-------------------|-------------------------------|-----|
| "Design Diplomat" naming | **Unitem** | Product name in the authoritative docs |
| Settings screen | **Login** screen | The demo screen the `/UI` mock already renders (§8) |
| Dart references | **Kotlin / Jetpack Compose** | §7 decision — Flutter/Dart breaks the "two native codebases" premise |
| Single pipeline | **`audit` + `diff`** modes | §3 — drift is both a state and an event |
| `knowledge-base/` | `conventions/conventions.yaml` | §10 repo layout |
| Basic ticket schema | Full `tickets.json` (§7) + `mapping.json`, `overrides.jsonl` | The real data contract, incl. override-learning memory |
| `/api/pipeline` on `:8000` | `/comparison` + `/findings/{id}/accept\|override` on **`:8787`** | §7 — the exact UI↔engine API |

**Why:** so that when the agents run, they read the right files, produce output the
`/UI` app can render, and hit the engine endpoints the architecture owner is building.

### 5. Housekeeping

- Reverted `README.md` to match `main` (avoid stepping on repo-level docs).
- Renamed `.cursor/rules/design-diplomat.mdc` → `unitem.mdc`.
- Merged latest `main` into the branch so it carries the `/UI` app + `ARCHITECTURE.md`.

---

## How this affects the product

### What it enables now
- **Consistent AI runs.** Any teammate (or cloud agent) invoking `/orchestrator`,
  `/classifier`, etc. gets behavior grounded in our verdict model and convention KB —
  no drifting prompts, no "make them identical" mistakes.
- **The SCALE stage of our SDLC.** Cloud agents can run the propagate flow (classify
  an iOS change → generate the Android patch → open a PR) in parallel and unattended.
- **REVIEW + SECURE stages.** Bugbot (`.cursor/BUGBOT.md`) and the security reviewer
  guard generated code so a bad patch is caught before the demo.
- **Faster onboarding.** `docs/08` + this changelog mean the setup is reproducible,
  not tribal knowledge.

### What it deliberately does *not* do
- It does **not** build the engine or the UI. Those stay with their owners. This layer
  is the *orchestration wrapper*, so the config and the real code evolve independently
  without conflict.

### Clean ownership boundaries (the main product benefit)
| Area | Owner | Where |
|------|-------|-------|
| Review console | UI owner | `/UI` |
| Engine + samples + conventions | Architecture owner | `/engine`, `/sample-*`, `/conventions` |
| Agent orchestration + cloud/Bugbot/security setup | This PR | `.cursor/`, `docs/08` |

Because the config references the architecture's paths and schema rather than
re-implementing them, the engine can be built to spec and the agents will "just work"
against it — no rewiring needed.

### One decision this surfaces for the team
`ARCHITECTURE.md` §7 asks the UI owner to switch the mock from **Dart → Kotlin**.
Our agent config already assumes Kotlin/Compose, so it's consistent with that
recommendation. Until that switch happens, the UI mock and the agent config describe
Android slightly differently — worth resolving so the demo stack is uniform.

---

## Follow-ups (not in this PR)

1. **Merge PR #3** to make the agents available when the repo is opened in Cursor.
2. **Complete the dashboard steps** in `docs/08` (GitHub, environment, Bugbot,
   security, secrets).
3. **Architecture owner builds `/engine`** per `ARCHITECTURE.md` §10; once `api.py`
   serves `:8787`, update the placeholder command in `.cursor/environment.json`.
4. **UI owner adds the verdict fields** per `UI/ARCHITECTURE-ALIGNMENT.md` and makes
   the Dart→Kotlin swap.
