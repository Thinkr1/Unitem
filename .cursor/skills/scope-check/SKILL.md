---
name: scope-check
description: Gate pipeline runs — flag product drift, wrong stack, out-of-scope files, or wasted LLM calls.
---

# Scope Check (pipeline gate)

Run **first** on every pipeline request. Maps to `docs/10-pipeline-io.md` layer 0.

## Purpose

Stop agents from:
- Building the **migration playbook** product when the task is **Unitem design consistency**
- Editing outside the mapped Login screen
- Calling `/classifier` when `fast-judge` already resolved
- Adding Flutter/Dart Android code (product = Kotlin/Compose)

## Input

```json
{
  "user_request": "string",
  "files_to_touch": ["path/..."],
  "planned_agents": ["classifier", "android-patcher"]
}
```

## Checks (deterministic)

| Check | Flag if |
|-------|---------|
| Product alignment | Request mentions "Swift to Flutter migration playbook", "port entire app", "playbook marketplace" **without** design-consistency context |
| File scope | Any path outside `examples/mapping.json` Login pair (except `engine/`, `conventions/`, `.cursor/`, `docs/`, `UI/`) |
| Stack | New Android code in `.dart` or Flutter widgets |
| LLM waste | `classifier` in plan but change matches `fast_judge: true` rule |
| Doc confusion | Agent cites `docs/09-market-analysis-v2.md` as **product spec** (it's adjacent GTM only) |

## Output

```json
{
  "aligned": true,
  "product": "unitem-design-consistency",
  "flags": [
    {
      "severity": "warning",
      "code": "PRODUCT_DRIFT",
      "message": "Task sounds like migration playbook (docs/09), not Unitem propagate/hold/flag.",
      "inject_into_llm": true,
      "suggested_action": "Re-read ARCHITECTURE.md §1 and scope to Login design consistency."
    }
  ],
  "blocked_steps": [],
  "notes": ""
}
```

## When `aligned: false`

- Set `blocked_steps`: e.g. `["classifier", "android-patcher"]`
- **Inject flags into next LLM prompt** as a system reminder (do not silently ignore)
- Ask human to confirm scope before continuing

## Trigger phrases

- "Scope-check this before running the pipeline"
- "Is this task aligned with Unitem?"

## Product truth (for LLM injection)

> **Unitem** = cross-platform **design consistency** (propagate / hold / flag) on mapped iOS+Android screens.
> **Not** the Swift→Flutter migration playbook in `docs/09-market-analysis-v2.md` (adjacent research only).
