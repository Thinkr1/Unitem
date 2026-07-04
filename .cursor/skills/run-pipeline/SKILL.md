---
name: run-pipeline
description: Run the full Unitem pipeline for a screen — discover, map, judge, reconcile, review.
---

# Run Pipeline

End-to-end workflow for one mapped screen (ARCHITECTURE.md §4).

## Trigger phrases

- "Run Unitem diff on the Login screen"
- "Sync the iOS primary-color change to Android"
- "Audit the Login screen for drift"

## Steps

1. **discover** — deterministic facts / atomic changes (`detect-diff`)
2. **map** — resolve iOS↔Android pair via `mapping.json`
3. **judge** — one ticket per change (`classify-change` → `classifier`)
4. Human review in the `/UI` console (accept / override → `overrides.jsonl`)
5. **reconcile** — for accepted propagate/flag, `generate-fix` (`ios/android-patcher`)
6. **verify** — build + screenshots (`verifier`), then open PR

## UI / engine contract (ARCHITECTURE.md §7)

The `/UI` app is the review console (already built). The engine serves it via a
local FastAPI on port **8787**:

| Endpoint | Purpose |
|----------|---------|
| `GET /comparison?screen=login` | Latest `ComparisonResult` (replaces `mockData.ts`) |
| `POST /findings/{id}/accept` | Apply fix; propagate ⇒ open PR, return PR URL |
| `POST /findings/{id}/override` `{verdict, note?}` | Record corrected verdict to `overrides.jsonl` |
| `GET /events` (SSE, stretch) | Push re-analysis progress during the demo |

## Cloud agent prompt (copy-paste)

```
Run the Unitem diff pipeline for the Login screen.

1. Read mapping.json and conventions/conventions.yaml
2. Discover atomic changes from the latest git diff on sample-ios/
3. Classify each change (invoke classifier subagent)
4. For propagate verdicts, generate the Android patch (android-patcher)
5. Verify build, open PR on the Android repo
6. Emit tickets.json for the /UI console

Demo scope only — do not scan outside the mapped Login files.
```

## Parallelism

Use `/multitask` or Plan → Build in Parallel for independent work (ios-patcher +
android-patcher, or classifier fan-out across atomic changes). Bound concurrency.
