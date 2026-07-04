---
name: classify-change
description: Classify one atomic change as propagate, hold, or flag using the convention knowledge base.
---

# Classify Change

Invoke the `classifier` subagent or `POST /api/classify`.

## Input

One item from `atomic_changes` (see `detect-diff` skill).

## Process

1. Load `knowledge-base/conventions.yaml`.
2. Retrieve rules where `applies_to` matches `kind`.
3. Run classifier with matched rules as context.
4. Optionally run WCAG contrast check for color changes (deterministic).

## Output

Full ticket object per `docs/03-architecture.md`:

- `verdict`, `confidence`, `reason`, `convention_refs`
- `proposed_fix` only if verdict is `propagate` or `flag`

## Slash command

`/classifier classify change_001 for Settings screen`
