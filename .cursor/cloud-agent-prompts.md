# Cloud Agent Prompts — copy-paste into cursor.com/agents

`ARCHITECTURE.md` is authoritative. The `/UI` app is the review console (built).
The engine (`/engine` unitem package) serves it via FastAPI on port 8787.

## Full pipeline (propagate demo — Login screen)

```
Run the Unitem `diff` pipeline for the Login screen.

Read:
- mapping.json
- conventions/conventions.yaml
- ARCHITECTURE.md (§4 pipeline, §7 tickets.json schema)

Steps:
1. Discover atomic changes from the latest git diff on sample-ios/ (deterministic)
2. Resolve the mapped iOS<->Android pair via mapping.json
3. For each change, invoke the classifier subagent (propagate | hold | flag)
4. For propagate verdicts on brand color, invoke android-patcher
5. Apply the minimal Kotlin diff, invoke verifier
6. Commit on branch sync/propagate-UNI-001 and open a PR
7. Emit tickets.json for the /UI console (GET /comparison?screen=login)

Do not edit files outside the mapped Login pair. Enable auto-create PR.
```

## Audit mode (baseline scan)

```
Run `unitem audit` on the Login screen.
Map both platforms, judge each mapped-section difference (hold/flag only,
nothing to propagate). Aggregate deduplicated findings into tickets.json.
```

## Classify only

```
Invoke the classifier subagent for this atomic change:

{
  "kind": "component",
  "name": "toggle.notifications",
  "before": "custom-switch",
  "after": "native-toggle",
  "origin_platform": "ios"
}

Ground in conventions/conventions.yaml. Return the tickets.json verdict entry.
```

## Android patch after iOS edit

```
iOS primary color changed in sample-ios/LoginView.swift from #5A55F2 to #4F46E5.

Invoke orchestrator -> classifier -> android-patcher.
Generate the minimal Kotlin diff for the mapped LoginScreen.kt.
Open a PR on branch sync/propagate-UNI-001.
```

## Pre-push review

```
/review-bugbot
/review-security

Review uncommitted changes on sample-ios/ and sample-android/ against .cursor/BUGBOT.md
```
