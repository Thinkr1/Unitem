---
name: classify-change
description: Classify one atomic change / difference as propagate, hold, or flag using the convention knowledge base.
---

# Classify (JUDGE)

Invoke the `classifier` subagent. Maps to ARCHITECTURE.md §4 step 3 / §5.

## Input

One item from the discover step (see `detect-diff`).

## Process

1. Retrieve rules from `conventions/conventions.yaml` by `kind`.
2. Layer grounding: `overrides.jsonl` > `agent.md` > shipped KB.
3. Run deterministic tool checks where relevant (WCAG contrast, scale membership).
4. Classifier returns verdict + reason + confidence + cited rule ids.

## Output

Full `tickets.json` entry per ARCHITECTURE.md §7:
`id, mode, category, change, verdict, severity, confidence, reason,
convention_refs, proposed_fix (null for hold), status`.

## Slash command

`/classifier classify change_001 for the Login screen`
