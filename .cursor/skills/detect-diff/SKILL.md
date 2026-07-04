---
name: detect-diff
description: Deterministically discover atomic UI changes / design facts between iOS and Android before classification.
---

# Detect / Discover (deterministic)

Runs **before** any LLM classification. Detection is deterministic
(tree-sitter + regex), never LLM. Maps to ARCHITECTURE.md §4 steps 1–2.

## Steps

1. Walk both trees; classify stack (SwiftUI/UIKit · Compose/XML).
2. Extract design facts: colors, spacing, radii, type sizes, component usage,
   string keys, nav routes.
3. Resolve the mapped screen pair via `mapping.json`
   (overridable in `mapping.overrides.yaml`).
4. **audit:** emit per-section differences. **diff:** emit atomic changes from the
   commit/branch/working-tree edit.

## Atomic change shape

```json
{
  "id": "change_001",
  "kind": "color | spacing | typography | component | content",
  "name": "color.primary",
  "before": "#5A55F2",
  "after": "#4F46E5",
  "origin_platform": "ios | android",
  "location": { "file": "LoginView.swift", "line": 34 }
}
```

## Rules

- One semantic change per entry (not a whole-file diff).
- Hardcoded values are separate atoms from token changes.
- A screen present on only one platform is itself a finding.

## Engine entrypoint

```bash
unitem diff --screen login        # change-driven (demo)
unitem audit --screen login       # baseline scan
```
