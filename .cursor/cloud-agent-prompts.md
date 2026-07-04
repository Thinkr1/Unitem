# Cloud Agent Prompts — copy-paste into cursor.com/agents

`ARCHITECTURE.md` is authoritative. The `/UI` app is the review console (built).
The engine (`/engine` unitem package) serves it via FastAPI on port 8787.

## Full pipeline (propagate demo — Login screen)

```
Run the Unitem `diff` pipeline for the Login screen.

Read:
- docs/10-pipeline-io.md (layer I/O)
- examples/login-demo-full-flow.json (target end-to-end shape)
- examples/mapping.json, conventions/conventions.yaml
- ARCHITECTURE.md (§4 pipeline, §7 tickets.json schema)

Steps:
0. scope-check — gate (not migration-playbook scope)
1. Discover atomic changes from git diff on sample-ios/ (deterministic)
2. fast-judge EACH change — skip classifier when resolved
3. /classifier ONLY for needs_llm[] changes
4. propagate → android-patcher; hold → no patch; flag → one-line fix
5. /verifier, branch sync/propagate-UNI-001, open PR
6. Emit final_tickets for /UI console

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
