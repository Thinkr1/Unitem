# 10 — Pipeline I/O Contract (read this to understand the system)

> **For humans and agents.** One page per layer: what goes in, what comes out, when to skip the LLM, and known flaws.
> Authoritative product spec: `ARCHITECTURE.md`. Runnable demo fixture: `examples/login-demo-full-flow.json`.

---

## Flow at a glance

```
SCOPE-CHECK ──► DISCOVER ──► MAP ──► FAST-JUDGE ──► JUDGE* ──► RECONCILE ──► VERIFY ──► REVIEW
   (gate)      (deterministic) (heuristics) (no LLM)   (LLM*)    (patchers)   (build)    (human)
                                                      * skip when fast-judge resolves
```

| Layer | Skill / agent | LLM? | Model (when LLM) |
|-------|---------------|------|------------------|
| Scope check | `scope-check` | Rarely | `fast` / inherit |
| Discover | `detect-diff` | **Never** | — |
| Map | part of discover / orchestrator | Reconcile only | orchestrator model |
| Fast judge | `fast-judge` | **Never** | — |
| Judge | `classify-change` → `/classifier` | **Only if fast-judge missed** | `claude-4.6-sonnet-high-thinking` |
| Reconcile | `generate-fix` → patchers | Yes (patch gen) | `composer-2.5` |
| Verify | `/verifier` | No | `composer-2.5` |
| Review | `/UI` | Human | — |

Full routing table: `.cursor/MODEL-ROUTING.md`

---

## Layer 0 — Scope check (gate)

**Purpose:** Stop wasted work when the task, files, or narrative don't match Unitem's product.

| | |
|---|---|
| **Input** | User request + list of files to touch + optional `docs/09-market-analysis-v2.md` context |
| **Output** | `scope_check.json` entry (see demo fixture) |

```json
{
  "aligned": true,
  "product": "unitem-design-consistency",
  "flags": [],
  "blocked_steps": [],
  "notes": "Login screen diff — in demo scope."
}
```

**Auto-flag when:**
- Task describes Swift→Flutter **migration playbook** (that's `docs/09`, not the product)
- Edits outside `mapping.json` Login pair
- `/classifier` requested but `fast-judge` already returned `resolved: true`
- Android target is Dart/Flutter in new code (product = **Kotlin/Compose**)

**Invoke:** `"Run scope-check before pipeline"` or skill `scope-check`

---

## Layer 1 — Discover

| | |
|---|---|
| **Input** | `mode`: `audit` \| `diff` · `screen`: `login` · git ref or working tree |
| **Output** | `atomic_changes[]` — one semantic change per object |

```json
{
  "id": "change_001",
  "kind": "color",
  "name": "color.primary",
  "before": "#5A55F2",
  "after": "#4F46E5",
  "origin_platform": "ios",
  "location": { "file": "LoginView.swift", "line": 34 }
}
```

**Rules:** tree-sitter + regex only. No LLM. One atom per semantic change.

**Invoke:** `detect-diff` · `unitem diff --screen login` (when engine exists)

---

## Layer 2 — Map

| | |
|---|---|
| **Input** | `screen` name · iOS/Android file paths |
| **Output** | `mapping.json` entry with `confidence` |

```json
{
  "feature": "login",
  "ios": ["sample-ios/LoginView.swift"],
  "android": ["sample-android/LoginScreen.kt"],
  "confidence": 0.94,
  "status": "confirmed"
}
```

**LLM:** Only when heuristics disagree — one reconcile pass, not per-change.

---

## Layer 2.5 — Fast judge (skip LLM when possible)

| | |
|---|---|
| **Input** | One `atomic_change` + matching rules from `conventions/conventions.yaml` + `overrides.jsonl` |
| **Output** | Either full ticket (resolved) or `{ "resolved": false, "reason": "needs_llm" }` |

**Resolve without LLM when:**
1. Rule id matches exactly (`propagate/brand-color`, `hold/native-switch`, `flag/hardcoded-color`)
2. Deterministic tool passes: off-scale spacing, WCAG fail, stale token vs rulebook
3. `overrides.jsonl` has precedent for same `kind` + `name`

```json
{
  "resolved": true,
  "source": "fast-judge",
  "ticket": { "id": "UNI-002", "verdict": "propagate", "confidence": 0.98, "convention_refs": ["propagate/brand-color"] }
}
```

**Invoke:** `fast-judge` — **always run before `/classifier`**

---

## Layer 3 — Judge (LLM classifier)

| | |
|---|---|
| **Input** | Atomic change where `fast-judge.resolved === false` |
| **Output** | Ticket fragment: `verdict`, `confidence`, `reason`, `convention_refs` |

```json
{
  "verdict": "hold",
  "confidence": 0.91,
  "reason": "iOS uses native Toggle; Android keeps Material Switch — correct platform idiom.",
  "convention_refs": ["hold/native-switch"]
}
```

**Invoke:** `/classifier` · `classify-change` — **only if fast-judge did not resolve**

---

## Layer 4 — Reconcile

| | |
|---|---|
| **Input** | Full ticket with `verdict` |
| **Output** | Updated ticket + optional git branch/PR |

| Verdict | Action |
|---------|--------|
| **propagate** | `/android-patcher` or `/ios-patcher` → `proposed_fix` → PR |
| **flag** | patcher → one-line fix in ticket |
| **hold** | explanation only — **no patch, no PR** |

**Invoke:** `generate-fix` · patcher agents

---

## Layer 5 — Verify

| | |
|---|---|
| **Input** | Applied diff · mapped files |
| **Output** | `verify_report.json` |

```json
{
  "status": "pass",
  "ios_build": "skipped",
  "android_build": "pass",
  "visual_match": "manual_review"
}
```

**Invoke:** `/verifier` after every patch

---

## Layer 6 — Review (UI)

| | |
|---|---|
| **Input** | `ComparisonResult` / `tickets.json` aggregated |
| **Output** | Human accept/override → `overrides.jsonl` |

**Endpoints (when engine live):** `GET /comparison?screen=login` · `POST /findings/{id}/accept` · `POST /findings/{id}/override`

**Today:** `UI/src/mockData.ts` (static)

---

## Full ticket shape (handoff between layers)

See `ARCHITECTURE.md` §7 and `examples/login-demo-full-flow.json` → `pipeline.final_tickets[]`.

---

## Known flaws (fix or work around)

| ID | Flaw | Impact | Mitigation |
|----|------|--------|------------|
| **F1** | Classifier called for every change | Wasted tokens/latency | Use `fast-judge` first (this doc + skill) |
| **F2** | `engine/`, `sample-*`, `conventions/` missing | Pipeline can't run in code | Use `examples/login-demo-full-flow.json` + agents manually |
| **F3** | UI mock uses **Dart/Flutter**, spec says **Kotlin/Compose** | Wrong Android mental model | Treat mock as visual-only; new work = Kotlin |
| **F4** | `mockData.ts` findings are all flag-shaped — no propagate/hold cards | Demo misses money moment | Demo fixture has all 3 verdicts; UI adoption pending |
| **F5** | `docs/09-market-analysis-v2.md` = migration playbook, not Unitem | Agent scope drift | `scope-check` skill flags this |
| **F6** | Cursor may ignore subagent `model:` in frontmatter | Wrong model/cost | See `.cursor/MODEL-ROUTING.md` workarounds |
| **F7** | No `overrides.jsonl` yet | Judge can't learn team taste | Create on first human override |
| **F8** | Orchestrator doesn't enforce fast-judge gate | LLM waste persists if agents skip skill | Updated orchestrator + run-pipeline skill |

When you hit a flaw during a run, append to the run log:

```json
{ "flaw_id": "F1", "observed": "classifier invoked for brand-color change", "action": "add fast-judge rule" }
```
