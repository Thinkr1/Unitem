# 03 — Architecture

## Two possible versions (and which we chose)

**Version A — design-level.** Operate on design tokens / a design representation only. "Propagate" = update a token in the other side's design. No real repos, no real phones. Reliable and easy, but less impressive and closer to "already exists."

**Version B — code-level (CHOSEN).** Ingest **real** Swift and Kotlin code, generate actual source edits / a PR, and prove it by rebuilding the screen in a simulator/emulator. More useful, more differentiated, more impressive.

**Decision:** Build **Version B**, scoped to **one real screen on both platforms** (see `04-scope-plan-risks.md`). Keep a Version-A-style token path as the reliable skeleton and graceful fallback.

---

## The conceptual pipeline

```
Inputs → 1. Detect change → 2. Classify each change → { Propagate | Hold | Flag } → 3. Human reviews → (override feeds back)
```

- **Inputs:** the design source (tokens), the two platform implementations (iOS + Android code), and the **convention knowledge base** (the rules of what's a platform idiom). See `06`.
- **1. Detect change (deterministic):** diff before/after → a clean list of *atomic changes* (e.g. `primary color #2563EB → #1D4ED8`, `Android button radius 6px but token says 8px`). Not AI.
- **2. Classify (the brain / LLM):** for each atomic change, return `propagate | hold | flag` + a plain-language reason + a confidence score, grounded by the convention KB.
- **3. Human reviews:** verdicts appear as cards; user taps accept or override.
- **Override loop:** an override is remembered so similar future changes are classified the user's way. (This is the "learns from override" motif the tracks reward.)

**Where iOS/Android come in:** they are the *two sides being reconciled*. Every verdict is a decision about whether something on one platform should cross to the other. The whole reason the tool exists is that gap between them.

---

## The real-codebase workflow (Version B)

```
Real iOS + Android repos (GitHub)
        │
        ▼
Parse the code structure   ← tree-sitter (deterministic, no LLM)
        │
        ▼
Classify + generate fix    ← LLM engine (OUR CORE) + convention KB
        │
        ▼
Rebuild the one screen     ← iOS simulator (Mac) · Android emulator (Windows)
        │
        ▼
Review dashboard           ← iOS view · verdicts · Android view
        │
        ▼
Open a PR                  ← on the team's own GitHub repo
```

**Never scan the whole codebase.** The flow is: detect the small diff → retrieve *only* the relevant file/screen → reason about that slice → emit the change. Selective, multi-step retrieval is exactly the agentic behavior the hackathon rewards.

---

## Tech stack (stand on existing tools; only build the judgment)

| Concern | Tool | Notes |
|---------|------|-------|
| Parse Swift/Kotlin structure | **tree-sitter** (Swift + Kotlin grammars) | Deterministic AST extraction of colors, spacing, component usage. Don't write your own parser. |
| The judgment (classify + explain + generate) | **LLM (Claude)** | This is the only part we invent. Use whatever model the sponsors credit; Claude fits the reasoning/taste emphasis. |
| Emit token output (optional) | **Style Dictionary** | Only useful for the Propagate case; hand-templating is fine for a demo. Name-drop in pitch regardless. |
| Build + "run on the phone" | **Android Studio emulator** (Windows) + **Xcode iOS simulator** (Mac) | Free. No physical devices needed. |
| PR dispatch | **git / GitHub PR** | The tool opens a PR on the team's own repo. No custom dispatcher needed. |
| Agent orchestration | **Claude / Cursor agent tooling** | Plan → tool calls → sub-agents. Keep it minimal (see below). |

---

## Hybrid: deterministic + LLM

- **Deterministic** for the cheap, reliable part: extract token values, compute what changed.
- **LLM** only for judgment: classify, explain, generate.
- Pure-LLM-everything is flaky and wasteful; pure-deterministic can't do "taste." **Deterministic front-end, LLM brain.**

---

## The agentic loop (keep it lean)

A legitimate agent loop — enough to look serious, not so much it breaks live:

- **Planner/orchestrator** decides what to look at.
- **Tool calls:** read token file, read the relevant screen's code (tree-sitter), query the convention KB, run a check (e.g. color-contrast), emit a diff.
- **Sub-agents:** one classifier, one generator (code/token), one that writes the ticket/PR.
- **Convention KB** is a retrievable resource.

> Rule of thumb: a 3-tool, 2-sub-agent loop that runs end-to-end beats a 10-agent architecture that half-works on stage.

---

## Data contract — the verdict/ticket schema

Every atomic change produces one ticket. This is both the engine's output and what the dashboard renders as a card.

```json
{
  "id": "ticket_001",
  "change": {
    "kind": "token | component | style",
    "name": "color.primary",
    "before": "#2563EB",
    "after": "#1D4ED8",
    "origin_platform": "ios | android",
    "location": { "file": "Theme.swift", "line": 42 }
  },
  "verdict": "propagate | hold | flag",
  "confidence": 0.92,
  "reason": "Brand primary color changed; this is a semantic brand token, so it should apply to Android as well.",
  "convention_refs": ["brand-tokens/primary-color", "propagate/brand-color"],
  "proposed_fix": {
    "target_platform": "android",
    "file": "Color.kt",
    "diff": "- val Primary = Color(0xFF2563EB)\n+ val Primary = Color(0xFF1D4ED8)"
  },
  "status": "pending | accepted | overridden"
}
```

**Screen mapping (only relevant for code-level):** the tool must know that e.g. `SettingsView.swift ↔ SettingsScreen.kt`. For the hackathon, use an **explicit mapping manifest** (a tiny JSON) — it's reliable and removes a failure mode. LLM/path-similarity *inference* is a stretch, not the default.

```json
{
  "screens": [
    { "name": "Settings", "ios": "SettingsView.swift", "android": "SettingsScreen.kt" }
  ]
}
```
