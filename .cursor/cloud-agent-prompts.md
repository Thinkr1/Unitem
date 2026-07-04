# Cloud Agent Prompts — copy-paste into cursor.com/agents

## Full pipeline (propagate demo)

```
Run the Design Diplomat pipeline for the Settings screen.

Read:
- engine/screen-map.json
- knowledge-base/conventions.yaml
- docs/03-architecture.md

Steps:
1. Start engine: cd engine && pip3 install -r requirements.txt && python3 -m uvicorn main:app --port 8000 &
2. POST /api/pipeline with {"screen":"Settings","mode":"token"}
3. For each ticket, invoke classifier subagent to validate verdict
4. For propagate verdicts on brand.color.primary, invoke android-patcher
5. Apply patch to sample-android/app/src/main/java/com/unitem/settings/Color.kt
6. Invoke verifier subagent
7. Commit on branch sync/propagate-ticket_002
8. Open PR with ticket JSON in description

Do not edit files outside screen-map.json. Enable auto-create PR.
```

## Classify only

```
Invoke classifier subagent for this atomic change:

{
  "kind": "component",
  "name": "toggle.notifications",
  "before": "custom-switch",
  "after": "native-uiswitch",
  "origin_platform": "ios"
}

Ground in knowledge-base/conventions.yaml. Return JSON verdict.
```

## Android patch after iOS edit

```
iOS primary color changed in sample-ios/Theme.swift from #2563EB to #1D4ED8.

Invoke orchestrator → classifier → android-patcher.
Generate minimal Kotlin diff for sample-android/.../Color.kt.
Open PR on branch sync/propagate-primary-color.
```

## Pre-push review

```
/review-bugbot
/review-security

Review uncommitted changes on sample-ios/ and sample-android/ against .cursor/BUGBOT.md
```
