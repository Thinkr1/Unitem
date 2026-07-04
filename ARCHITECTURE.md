# Unitem — Architecture v1

> AI-native design-consistency engine for the RAISE Summit hackathon (Cursor track, Statement One).
> This document is the authoritative architecture. The `/docs` folder is the original planning handoff; where they differ, this file wins.

---

## 1. What we're building

**Unitem** watches a product's **iOS (Swift)** and **Android (Kotlin)** codebases and reasons about design consistency between them. For every design-relevant difference or change, it issues one of three verdicts:

| Verdict | Meaning | Action |
|---|---|---|
| **Propagate** | A brand/semantic change that belongs on both platforms | Generate the equivalent edit on the other platform → open a PR |
| **Hold** | A platform idiom — the platforms *should* differ here | Do nothing, but explain *why the difference is correct* |
| **Flag** | Real drift or regression (stale value, hardcoded hex, off-scale spacing, reimplemented component) | Propose the fix as a ticket, with a one-line diff where possible |

The intelligence is **not** "make iOS and Android identical" — that would be bad design. The intelligence is knowing **which differences should exist**. This maps directly onto the track statement:

- "detecting drift" → the diff/audit engine
- "proposing reconciliation" → generated fixes + PRs
- "without a synchronization meeting" → the review console
- "**taste** to know when something is wrong" → the three-verdict model grounded in a convention knowledge base

Our three verdicts are a near-exact instantiation of the track's example project #2 (*intentional redesign / accidental regression / platform-imposed constraint*), with the "platform-imposed constraint" case promoted from edge case to the center of the product.

**Framing note:** the track statement is about *any* design system fracturing over time. We instantiate the general problem as **cross-platform iOS ↔ Android drift** because it is the hardest, least-served version of it: the one place where "different" is sometimes *correct*, so naive matching tools fail and taste is mandatory.

---

## 2. Positioning — why this isn't already built

| Existing tool | What it does | What it can't do |
|---|---|---|
| Style Dictionary | Mechanically translates one token source into iOS/Android outputs | No judgment — propagates everything, including things that should stay native |
| Visual-regression tools (Chromatic, Percy) | Flag pixel diffs | No idea whether a diff is intentional, idiomatic, or a bug |
| Linters / custom scripts | Enforce syntactic rules per platform | Can't reason across platforms or explain *why* |

**Unitem's unique layer = judgment + convention knowledge + cross-platform reconciliation.** Everything else is deliberately assembled from existing infrastructure (see §6). The defensible asset is the taste; the plumbing is replaceable.

**Startup trajectory:** `diff` mode (§3) is a **CI gate** — every PR on either platform gets judged; high-confidence propagations auto-open the counterpart PR on the other platform. That's a recurring product that sits in an existing budget line (design-tooling / CI spend, next to Figma, Chromatic, linters), with a natural expansion path to web ↔ mobile and design-file ↔ code consistency.

---

## 3. Two operating modes

Drift is both a **state** (the codebases have already diverged) and an **event** (a change just landed on one platform). One mode for each:

### `unitem audit` — baseline scan (state)
First-run experience. Walk both trees, map screens, fan out one analysis agent per mapped section, aggregate everything into a deduplicated finding list. Answers: *"where have these apps already drifted?"* Findings are Hold or Flag (nothing to propagate — no change event occurred).

### `unitem diff` — change-driven judgment (event) ← **the demo centerpiece**
Given a change (a commit range, branch, or working-tree edit) on **either** platform, extract the atomic changes, judge each one, and for Propagate verdicts generate the counterpart edit and open a PR. Answers: *"this just changed on platform A — what should happen on platform B?"*

Direction is symmetric: never hardcode "iOS is the source of truth." A change originates on either platform; the question is always *"should this specific change cross?"*

`audit` gives immediate value on any existing codebase; `diff` is the ongoing product (and the CI-gate business model).

---

## 4. Pipeline

```
unitem.yaml (config) · conventions/ (shipped KB) · agent.md (project design spec)
        │
        ▼
┌─ 1. DISCOVER (deterministic) ──────────────────────────────────────┐
│  Walk both trees · classify stack (SwiftUI/UIKit · Compose/XML)    │
│  Extract design facts: colors, spacing, radii, type sizes,         │
│  component usage, string keys, nav routes   ← tree-sitter + regex  │
└────────────────────────────────────────────────────────────────────┘
        │
        ▼
┌─ 2. MAP (heuristics + LLM reconciliation) ─────────────────────────┐
│  Auto-generate mapping.json: {feature, ios files, android files,   │
│  confidence} via path/name/route/string-key similarity, then one   │
│  agent pass to reconcile ambiguous pairs.                          │
│  Human-overridable: mapping.overrides.yaml                         │
│  A screen existing on only ONE platform is itself a finding.       │
└────────────────────────────────────────────────────────────────────┘
        │
        ▼
┌─ 3. JUDGE (the brain — LLM agents, fan-out) ───────────────────────┐
│  audit: one classifier agent per mapped section                    │
│  diff:  one classifier agent per atomic change                     │
│  Each agent gets: the extracted facts, the relevant code slices,   │
│  retrieved convention rules, agent.md principles, override memory, │
│  and a strict output schema.                                       │
│  Returns: verdict + reason + confidence + cited rule ids           │
│  Deterministic checks as tools (e.g. WCAG contrast ratio).         │
└────────────────────────────────────────────────────────────────────┘
        │
        ▼
┌─ 4. RECONCILE (act on verdicts) ───────────────────────────────────┐
│  Propagate → generator agent emits the counterpart source edit     │
│              → git branch + PR on the target repo                  │
│  Flag      → ticket with proposed one-line fix                     │
│  Hold      → explanation record (the "money moment" — why the      │
│              difference is correct)                                │
└────────────────────────────────────────────────────────────────────┘
        │
        ▼
┌─ 5. REVIEW (human-in-the-loop console — the /UI app) ──────────────┐
│  Three panels: iOS code · Android code · verdict cards,            │
│  line-linked (clicking a card jumps both code panels).             │
│  Accept / override each verdict.                                   │
│  Overrides are persisted (overrides.jsonl) and fed back into       │
│  future JUDGE runs as few-shot precedent → the tool learns the     │
│  team's taste.                                                     │
└────────────────────────────────────────────────────────────────────┘
```

**Retrieval discipline:** never dump whole codebases into a prompt. Detect the small diff (or one section) → retrieve only the mapped counterpart slice and the matching convention rules → judge that slice. Selective multi-step retrieval is both the cost control and the agentic behavior the track rewards.

---

## 5. The knowledge layer (the secret sauce)

Judgment is grounded in three sources, in priority order:

1. **Shipped convention KB** (`conventions/*.yaml`) — curated Apple HIG vs. Material Design rules: what propagates (brand color, semantic roles, brand typography, spacing scale, copy), what holds (native switches, navigation idioms, pickers, system fonts, elevation, ripple vs. highlight, touch targets), what flags (stale tokens, hardcoded values, off-scale spacing, reimplemented components, contrast failures). Machine-readable, each rule with `id / verdict / when / why / examples`. **This ships with the product — it's the moat.** See `docs/06-convention-knowledge-base.md` for the seed rules.
2. **Project design spec** (`agent.md`) — the team's own principles and brand decisions. Overrides and extends the KB (e.g. "our brand roundness is 12px everywhere" turns a corner-radius change from ambiguous into Propagate).
3. **Override memory** (`overrides.jsonl`) — every human override of a verdict, replayed into future classifications as precedent. Rule of specificity: override memory > agent.md > shipped KB.

**Classifier guardrails** (encoded in the prompt):
- The question is never "are they the same?" — it's "*should this specific change cross?*"
- If no rule matches confidently → **Flag with low confidence and defer to the human.** Never auto-propagate on a guess.
- Every verdict must cite the rule id(s) it relied on (`convention_refs`) and give a reason a designer would accept.
- Hold verdicts must explain *why the difference is correct* — that explanation is the demo's money moment.

---

## 6. Engine decisions — stand on existing tools, invent only the judgment

| Concern | Tool | Build vs. buy |
|---|---|---|
| Parse Swift/Kotlin structure | **tree-sitter** (swift + kotlin grammars) + targeted regex extractors | Existing — never write a parser |
| Screen-mapping similarity | Path/name/route/string-key heuristics (stdlib) + one LLM reconciliation pass | Trivial glue |
| Agent execution | **Cursor headless CLI** (`cursor-agent -p --output-format json`) — sponsor-track alignment | Existing; we write only the runner wrapper |
| Provider abstraction | Runner interface with three impls: `cursor` (default), `anthropic` (Claude API fallback), `mock` (fixtures, offline dev/CI/stage-fallback) | Thin wrapper we own |
| Deterministic checks | WCAG contrast math, scale-membership check | A few lines each — cheap rigor that grounds Flag verdicts in hard numbers |
| Token translation (Propagate output) | Hand-templated for the demo; **Style Dictionary** name-checked as the mechanical layer we add judgment on top of | Existing |
| PR dispatch | git + GitHub CLI/API on our own repos | Existing |
| Review console | **Existing `/UI` app** (React 19 + Vite + Electron, three resizable line-linked panels) fed by the engine's local API | Already built — we extend its data contract, not its layout |

**Reliability engineering** (adopted from the fan-out design):
- Bounded concurrency on agent fan-out; per-section timeouts and retries.
- **Strict JSON schema validation** (pydantic) on every agent response; invalid → retry, then degrade to `flag / low confidence`.
- Dedupe + stable finding IDs across runs; file-hash caching so unchanged sections aren't re-analyzed.
- `--mock` runner makes the entire pipeline runnable with zero API keys — the team develops offline and it's the stage fallback.

**Orchestration stays lean:** one planner, ~3 tools (read facts, retrieve conventions, run deterministic check), 2 sub-agents (classifier, generator). A small loop that runs end-to-end beats a 10-agent architecture that half-works on stage.

---

## 7. Data contracts

### `mapping.json` (generated, overridable)
```json
{
  "screens": [
    {
      "feature": "settings",
      "ios": ["Sources/Settings/SettingsView.swift"],
      "android": ["app/src/main/java/.../SettingsScreen.kt"],
      "confidence": 0.94,
      "status": "auto | confirmed | overridden",
      "one_sided": false
    }
  ]
}
```

### `tickets.json` — the verdict/finding contract (engine output = dashboard input = dispatch input)
```json
{
  "id": "UNI-001",
  "mode": "audit | diff",
  "category": "color | spacing | typography | layout | component | navigation | content | accessibility | missing-screen",
  "change": {
    "kind": "token | component | style | screen",
    "name": "color.primary",
    "before": "#2563EB",
    "after": "#1D4ED8",
    "origin_platform": "ios | android",
    "location": { "file": "Theme.swift", "line": 42 }
  },
  "verdict": "propagate | hold | flag",
  "severity": "high | medium | low",
  "confidence": 0.92,
  "reason": "Brand primary color changed; semantic brand tokens must match across platforms.",
  "convention_refs": ["propagate/brand-color"],
  "proposed_fix": {
    "target_platform": "android",
    "file": "ui/theme/Color.kt",
    "diff": "- val Primary = Color(0xFF2563EB)\n+ val Primary = Color(0xFF1D4ED8)"
  },
  "status": "pending | accepted | overridden"
}
```

- `verdict` mapping to the analyzer taxonomy: `flag` = inconsistency, `hold` = expected-native, `propagate` = reconciliation (the verdict a pure detector lacks).
- `proposed_fix` is null for Hold; required for Propagate; best-effort for Flag.
- Overrides append `{ticket_id, human_verdict, note, timestamp}` to `overrides.jsonl`.

### Screen-mapping override (`mapping.overrides.yaml`)
Human corrections to the auto-mapping; always wins over heuristics.

### UI contract — engine ↔ `/UI` app

The `/UI` app (React 19 + Vite + Electron; three resizable panels: iOS code · Android code · findings, line-linked cards) already defines its seam in `UI/src/types.ts` (`ComparisonResult`) with a swappable `mockData.ts` and three callbacks. **That seam is the official integration point.** The engine serves it via a small local API; the layout and interaction model stay as built.

> UI-owner brief with the incremental adoption path: [`UI/ARCHITECTURE-ALIGNMENT.md`](UI/ARCHITECTURE-ALIGNMENT.md).
> Compatibility stance: all new fields are **optional/additive** (a finding without `verdict` renders as today's card); field *names* (`inconsistencies` vs `findings`, `resolved/ignored` vs `accepted/overridden`) are the UI owner's call — the engine's adapter emits whatever `types.ts` declares. The shape below is the semantic contract, not a naming mandate.

**`ComparisonResult` v2** — the current UI shape, extended so verdicts are renderable
(current fields kept; `+` = added, `~` = changed):

```ts
type Verdict = 'propagate' | 'hold' | 'flag'

interface Finding {                       // was: Inconsistency
  id: string
  property: string                        // e.g. "Primary color"
  verdict: Verdict                        // + THE core field — drives card look & actions
  severity: 'error' | 'warning' | 'info'  // secondary, for flag ranking
  confidence: number                      // + 0..1
  rule: string                            // rulebook/convention text (kept)
  conventionRefs: string[]                // + cited rule ids, e.g. "hold/native-switch"
  reason: string                          // + plain-language explanation (the money moment)
  expected?: string                       // ~ optional: only flag has a known expected value
  originPlatform?: 'ios' | 'android'      // + propagate: where the change started
  ios: { value: string; line: number }
  android: { value: string; line: number }
  proposedFix?: {                         // + propagate/flag: previewable diff
    targetPlatform: 'ios' | 'android'
    file: string
    diff: string
  }
  status: 'open' | 'accepted' | 'overridden'  // ~ was open|resolved|ignored
}

interface ComparisonResult {
  screen: string                          // + which mapped screen
  ios: CodePanel                          // language: 'swift'
  android: CodePanel                      // ~ language: 'kotlin' (was 'dart' — see decision below)
  findings: Finding[]
  rulebook: Record<string, string>        // kept — the agent.md/token values in force
}
```

**Card rendering per verdict** (the one real UI change requested):
- **Flag** — current card design as-is: expected vs both values, severity border. Action: *Apply fix*.
- **Propagate** — no "expected"; show `before → after` on the origin platform, the generated diff for the target platform. Action: *Approve → opens PR*.
- **Hold** — not a violation: neutral/green treatment, counted separately from "open issues", body = the *why the difference is correct* explanation. No fix action.
- Filter chips become verdict chips (All / Propagate / Hold / Flag) with severity as secondary.

**API (engine, local FastAPI) — replaces `mockData.ts` and the three stubbed callbacks:**

| Endpoint | Replaces | Behavior |
|---|---|---|
| `GET /comparison?screen=` | `mockData.ts` import | Latest `ComparisonResult` for the screen |
| `POST /findings/{id}/accept` | `onResolve` | Apply the proposed fix; for propagate, branch + open the PR; returns updated finding (+ PR URL) |
| `POST /findings/{id}/override` `{verdict, note?}` | `onIgnore` | Record the human's *corrected verdict* to `overrides.jsonl` (feeds future judging); returns updated finding |
| `GET /events` (SSE, stretch) | — | Push re-analysis progress to the UI during a live demo |

`onResolveAll` applies to flag findings only (each propagate is an individual PR decision).

**Decision needed with the UI owner:** the mock currently treats Android as **Flutter/Dart**. Architecture says **Kotlin/Compose** — Flutter is itself cross-platform (one Dart codebase usually ships *both* platforms), which breaks the premise of two native codebases drifting, and undercuts the Hold story (HIG-vs-Material native idioms). Recommendation: switch the mock + `language` union to Kotlin; cosmetic change today, expensive later.

---

## 8. Hackathon scope

**Demo (locked):** one real screen — **Login**, matching the screen the `/UI` mock already renders — implemented on both platforms in `/sample-ios` and `/sample-android`; three rehearsed changes, one per verdict, run through `unitem diff`; verdict cards in the dashboard with a live override; the Propagate case produces a real PR; screens rebuilt in the iOS simulator (Mac) / Android emulator (Windows), with pre-captured before/after screenshots as the stage fallback.

**Build order (graceful degradation — each layer demoable alone):**
1. Schemas + mock runner + token-level diff → classify → ticket (the reliable spine)
2. Convention KB + classifier prompt (highest-value work)
3. tree-sitter extraction + auto-mapping on the sample screen
4. Propagate code-gen + PR
5. Dashboard override loop feeding back into classification
6. *Stretch:* live simulator rebuild · `audit` mode fan-out on a larger sample · confidence-driven auto-accept

**In scope:** Swift/SwiftUI + Kotlin/Compose. Both modes designed; `diff` fully built, `audit` at least mocked.
**Out of scope:** Flutter/Dart, full-repo PRs at scale, arbitrary changes on arbitrary code, physical devices, Figma ingestion (we acknowledge the track's example #1 and deliberately take the code-is-truth path instead).
**Interactive surface:** the statement mentions state graphs ("fortieth branching state"). v1 covers it minimally via component-**state coverage** checks (e.g. one platform's control handles a `disabled`/`error` state the other lacks — a Flag). Full interaction-graph tracing is explicitly future work, stated rather than silently omitted.

---

## 9. Risks

| Risk | Mitigation |
|---|---|
| Generated code doesn't compile (biggest) | Only the 3 rehearsed changes must be bulletproof; generator scoped to token-value edits; rehearse |
| Live agent calls flake on stage | `--mock` runner replays recorded real outputs; pre-captured screenshots |
| Cursor CLI/API access issues | Provider abstraction → swap to Claude API without touching the pipeline |
| LLM output non-determinism | Strict schema validation, retries, low-confidence-flag fallback, dedupe, caching |
| Auto-mapping mis-pairs screens | `mapping.overrides.yaml`; demo uses a confirmed mapping |
| Noise (100 findings) | Severity + confidence ranking; dedupe; the whole verdict model exists to suppress noise |
| Over-engineered agent mesh | Hard cap: 1 planner, ~3 tools, 2 sub-agents |

---

## 10. Repo structure

```
/engine            unitem Python package
  unitem/          cli.py · config.py · discovery.py · extractors.py · mapping.py
                   judge.py · generate.py · runner/ (cursor|anthropic|mock)
                   schema.py (pydantic) · aggregate.py · report.py
                   api.py (FastAPI — serves the /UI contract, §7)
  prompts/         classifier.md · generator.md · mapping-reconcile.md
  tests/
/conventions       conventions.yaml (shipped KB — seed in docs/06)
/UI                review console (React 19 + Vite + Electron) — already built;
                   integration seam: UI/src/types.ts + the 3 stubbed callbacks
/sample-ios        one-screen SwiftUI app (demo "before" state we control)
/sample-android    one-screen Compose app (mirror)
/examples          tiny fixture pair + agent.md for --mock e2e tests
/docs              original planning handoff (historical)
ARCHITECTURE.md    this file
unitem.yaml        config: paths, model/runner, concurrency, output dir
```
