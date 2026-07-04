---
name: run-pipeline
description: Run the full Design Diplomat pipeline for a screen change — detect, classify, generate, verify.
---

# Run Pipeline

End-to-end workflow for one screen change.

## Trigger phrases

- "Run Design Diplomat on Settings"
- "Sync iOS change to Android for primary color"
- "Classify all changes on Settings screen"

## Steps

1. **detect-diff** — atomic changes
2. **classify-change** — one ticket per atom
3. Human review in dashboard (accept / override)
4. **generate-fix** — for accepted propagate/flag tickets
5. **verifier** — build + screenshots
6. Open PR

## Cloud agent prompt (copy-paste)

```
Run the Design Diplomat pipeline for the Settings screen.

1. Read engine/screen-map.json and knowledge-base/conventions.yaml
2. Detect atomic changes from the latest git diff on sample-ios/
3. Classify each change (invoke classifier subagent)
4. For propagate verdicts, generate Android patch (android-patcher)
5. Verify build, open PR on sample-android changes
6. Output ticket JSON for dashboard

Demo scope only — do not scan outside mapped files.
```

## Parallelism

Use `/multitask` or Plan → Build in Parallel for:
- ios-patcher + android-patcher (when both sides need updates)
- classifier runs per atomic change (batch if independent)
