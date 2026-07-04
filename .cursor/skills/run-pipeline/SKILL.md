---
name: run-pipeline
description: Run the full Unitem pipeline for a screen — discover, map, judge, reconcile, review.
---

# Run Pipeline

End-to-end workflow for one mapped screen (`ARCHITECTURE.md` §4).

**I/O reference:** `docs/10-pipeline-io.md` · **Demo fixture:** `examples/login-demo-full-flow.json`

## Trigger phrases

- "Run Unitem diff on the Login screen"
- "Sync the iOS primary-color change to Android"
- "Audit the Login screen for drift"

## Steps (strict order)

0. **scope-check** — gate; inject flags into LLM if product drift detected
1. **discover** — `detect-diff` (deterministic)
2. **map** — `examples/mapping.json` / `mapping.json`
3. **fast-judge** — resolve unambiguous rules **without LLM**
4. **judge** — `/classifier` **only** for `needs_llm[]` from fast-judge
5. **review** — human in `/UI` (accept / override → `overrides.jsonl`)
6. **reconcile** — `generate-fix` for accepted propagate/flag
7. **verify** — `/verifier`, then PR

## Model routing

See `.cursor/MODEL-ROUTING.md`. Summary: no LLM for steps 0–3; thinking model for ambiguous classify only; composer for patches.

## UI / engine contract

FastAPI `:8787` when engine exists — see `ARCHITECTURE.md` §7. Today: `examples/login-demo-full-flow.json` + `UI/src/mockData.ts`.

## Cloud agent prompt (copy-paste)

```
Run the Unitem diff pipeline for the Login screen.

0. scope-check — confirm design-consistency scope (not migration playbook)
1. Read examples/mapping.json, conventions/conventions.yaml, examples/login-demo-full-flow.json
2. Discover atomic changes (detect-diff / git diff on sample-ios/)
3. fast-judge EACH change — skip classifier when resolved
4. /classifier ONLY for unresolved changes
5. propagate → android-patcher; hold → no patch; flag → one-line fix
6. /verifier on Android; branch sync/propagate-UNI-001; open PR
7. Emit final_tickets matching the demo fixture schema

Demo scope only. Do not scan outside mapped Login files.
```

## Parallelism

Classifier fan-out only for `needs_llm[]`. Patchers parallel only when both platforms need independent fixes.
