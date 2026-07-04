---
name: detect-diff
description: Deterministically detect atomic UI changes between iOS and Android code or token files. Use before classification.
---

# Detect Diff

Run **before** any LLM classification. Detection must be deterministic.

## Steps

1. Load `engine/screen-map.json` for the target screen.
2. If token-level: diff `knowledge-base/tokens-before.json` vs `tokens-after.json`.
3. If code-level: parse mapped files with tree-sitter (Swift + Kotlin grammars).
4. Emit a list of **atomic changes**:

```json
{
  "atomic_changes": [
    {
      "id": "change_001",
      "kind": "color | spacing | component | copy",
      "name": "color.primary",
      "before": "#2563EB",
      "after": "#1D4ED8",
      "origin_platform": "ios | android",
      "location": { "file": "path", "line": 0 }
    }
  ]
}
```

## Rules

- One semantic change per entry (not whole-file diff).
- Include hardcoded values as separate atoms from token changes.
- Never use LLM for this step.

## Engine entrypoint

```bash
cd engine && python -m engine.detect --screen Settings
```

Or call `POST /api/detect` with `{ "screen": "Settings", "origin": "ios" }`.
