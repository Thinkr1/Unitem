---
name: generate-fix
description: Generate line-by-line code fix for propagate or flag verdicts on the target platform, then open a PR.
---

# Generate Fix (RECONCILE)

For verdicts **propagate** (required) or **flag** (best-effort). Skip for **hold**
(hold emits an explanation record only). Maps to ARCHITECTURE.md §4 step 4.

## Routing

| Target platform | Subagent |
|-----------------|----------|
| ios | `ios-patcher` |
| android | `android-patcher` |

## Output

Update the ticket's `proposed_fix`:

```json
{
  "target_platform": "ios",
  "file": "sample-ios/LoginView.swift",
  "diff": "- .background(Color(hex: \"#5A55F2\"))\n+ .background(Color(hex: \"#4F46E5\"))"
}
```

## Apply + PR

1. Apply patch to working tree (mapped files only).
2. Commit: `sync(propagate): update primary color on iOS (UNI-001)`
3. Push branch `sync/propagate-UNI-001`.
4. Open PR (GitHub or cloud agent `autoCreatePR`); include ticket JSON in the body.

## Verify

Always invoke `verifier` after apply.
