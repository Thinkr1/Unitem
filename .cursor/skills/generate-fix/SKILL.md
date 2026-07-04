---
name: generate-fix
description: Generate line-by-line code fix for propagate or flag verdicts on the target platform.
---

# Generate Fix

Only for verdicts **propagate** or **flag**. Skip for **hold**.

## Routing

| Target platform | Subagent |
|-----------------|----------|
| ios | `ios-patcher` |
| android | `android-patcher` |

## Input

Accepted ticket with `verdict` and `change` metadata.

## Output

Update ticket `proposed_fix`:

```json
{
  "target_platform": "android",
  "file": "sample-android/Color.kt",
  "diff": "- val Primary = Color(0xFF2563EB)\n+ val Primary = Color(0xFF1D4ED8)"
}
```

## Apply + PR

1. Apply patch to working tree.
2. Commit: `sync(propagate): update primary color on Android (ticket_001)`
3. Push branch `sync/propagate-ticket_001`.
4. Open PR via GitHub or cloud agent `autoCreatePR`.

## Verify

Always invoke `verifier` after apply.
