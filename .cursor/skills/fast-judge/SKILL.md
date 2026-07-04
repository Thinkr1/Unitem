---
name: fast-judge
description: Deterministic verdict before LLM — skip classifier when convention rule matches exactly.
---

# Fast Judge (skip LLM when possible)

Run **before** `classify-change` / `/classifier`. Maps to `docs/10-pipeline-io.md` layer 2.5.

## Why

Calling the classifier on every atomic change wastes tokens and latency when the convention KB already has an unambiguous rule (`fast_judge: true` in `conventions/conventions.yaml`).

## Input

One atomic change from `detect-diff`:

```json
{
  "id": "change_001",
  "kind": "color",
  "name": "color.primary",
  "before": "#5A55F2",
  "after": "#4F46E5",
  "origin_platform": "ios"
}
```

Plus: `conventions/conventions.yaml`, `examples/agent.md` rulebook, `overrides.jsonl` (if exists).

## Process (deterministic — no LLM)

1. Load rules where `applies_to` includes change `kind`.
2. Check `overrides.jsonl` for precedent on same `kind` + `name` → use human verdict.
3. Match rule `when` patterns:
   - `color.primary` / semantic color change → `propagate/brand-color`
   - `toggle.*` + native control → `hold/native-switch`
   - raw hex not in rulebook → `flag/hardcoded-color`
   - spacing value ∉ rulebook scale → `flag/off-scale-spacing` (if scale check fails unambiguously)
4. If rule has `fast_judge: true` and match is unambiguous → emit full ticket partial.
5. Else → `{ "resolved": false, "change_id": "...", "reason": "needs_llm" }`.

## Output

**Resolved (skip classifier):**

```json
{
  "resolved": true,
  "source": "fast-judge",
  "change_id": "change_001",
  "ticket_partial": {
    "verdict": "propagate",
    "confidence": 0.98,
    "reason": "...",
    "convention_refs": ["propagate/brand-color"]
  }
}
```

**Needs LLM:**

```json
{
  "resolved": false,
  "change_id": "change_003",
  "reason": "needs_llm"
}
```

## Trigger phrases

- "Fast-judge this change before classifying"
- "Can we skip the classifier for this color change?"

## Reference fixture

See `examples/login-demo-full-flow.json` → `pipeline.fast_judge` — 2 resolved, 1 needs LLM.
