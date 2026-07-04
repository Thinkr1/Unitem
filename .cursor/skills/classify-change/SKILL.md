---
name: classify-change
description: Classify one atomic change / difference as propagate, hold, or flag using the convention knowledge base.
---

# Classify (JUDGE)

Invoke `/classifier` subagent. Maps to `ARCHITECTURE.md` §4 step 3.

## Precondition — run fast-judge first

```
fast-judge → if resolved: STOP (do not call classifier)
           → if needs_llm: proceed below
```

Skill: `fast-judge` · **F1 flaw** if skipped.

## Input

One item from discover (`detect-diff`).

## Process

1. Confirm `fast-judge.resolved === false`.
2. Retrieve rules from `conventions/conventions.yaml` by `kind`.
3. Grounding: `overrides.jsonl` > `examples/agent.md` > conventions.
4. Deterministic tool checks (WCAG, scale membership) where relevant.
5. Classifier returns verdict + reason + confidence + `convention_refs`.

## Output

Full `tickets.json` entry per `ARCHITECTURE.md` §7.

## Slash command

`/classifier classify change_003 for the Login screen` — only after fast-judge returns `needs_llm`.
