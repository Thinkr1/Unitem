# Unitem

**AI-native design-consistency engine for cross-platform (iOS ↔ Android) products.**
Built for the RAISE Summit hackathon (Cursor track, Statement One).

Unitem watches an iOS (Swift) codebase and its Android/Flutter counterpart and judges
every design difference between them as one of three verdicts:

| Verdict | Meaning | Action |
|---|---|---|
| **Propagate** | A brand/semantic change that belongs on both platforms | Generate the equivalent edit on the other platform |
| **Hold** | A platform idiom — the platforms *should* differ here | Explain *why* the difference is correct, no edit |
| **Flag** | Real drift or regression (stale token, hardcoded hex, off-scale spacing) | Propose a fix as a ticket |

The intelligence isn't "make iOS and Android identical" — it's knowing **which
differences should exist**. See [`ARCHITECTURE.md`](ARCHITECTURE.md) for the full spec;
this file covers how to run it and a condensed version of the pipeline.

![Unitem review console — iOS panel, Android panel, verdict cards](android-now.jpeg)

---

## Status: run the browser version

**The only verified path right now is the React console in a regular browser tab**
(`npm run dev:vite`, `http://127.0.0.1:5173`). Everything below assumes that.

The repo also contains an Electron desktop shell, iOS Simulator / Android emulator
bridges, and Capacitor mobile build targets (`cap:ios`, `cap:android`) — those are
real code, not stubs, but they're unverified in this environment and not part of the
supported demo path today. Don't rely on them; use the browser tab.

---

## Quick start

### Prerequisites

- **Node.js 20+** (tested with Node 24) and npm, for the console.
- **Python 3.10+**, for the engine.
- Nothing else — no Xcode, no Android SDK, no API keys required for the browser path.

### 1. Install and run the console (UI)

```bash
cd UI
npm install
npm run dev:vite       # NOT `npm run dev` — that also launches the Electron shell
```

Open **http://127.0.0.1:5173/**. The console works standalone: with no engine running
it falls back to local mock data (`UI/src/mockData.ts`) so the three-panel layout,
verdict cards, and screen switcher are all browsable with zero backend setup.

### 2. Run the engine for live data (optional, still zero API keys)

In a second terminal, from the repo root:

```bash
python3 -m venv ~/.venvs/unitem
source ~/.venvs/unitem/bin/activate
pip install -e engine pytest httpx

unitem serve            # FastAPI on :8787 — run from the repo root
```

The console at `:5173` auto-detects the engine at `:8787` and switches from mock data
to live tickets; if the engine isn't reachable it silently falls back, so it's safe to
run the UI with or without this step.

By default `unitem.yaml` configures the `claude` runner (shells out to the Claude Code
CLI). For a fully offline run that needs no subscription or API key, replay recorded
agent responses instead:

```bash
# offline walking-skeleton demo: prints 3 findings (propagate/hold/flag) to the terminal
unitem diff --runner mock --changes-file examples/changes/login-changes.json

# to make `unitem serve` (and the console) use mock data too, set in unitem.yaml:
#   runner: { name: mock, ... }
```

The CLI command above is the fastest way to see the judgment model work without
touching the UI at all.

### 3. Live LLM agents (optional)

Two runners can drive real judgments instead of mock replay — set `runner.name` in
`unitem.yaml`, or pass `--runner` on the CLI:

- `claude` — shells out to the `claude` CLI; requires Claude Code installed and logged
  in with your Claude subscription.
- `cursor` — shells out to `cursor-agent -p --output-format json`; requires
  `cursor-agent login` with a Cursor subscription.
- `mock` — offline, replays fixtures; the default-safe/stage-fallback path.

---

## Testing

```bash
# engine unit + integration tests (the mock end-to-end test is the CI gate)
source ~/.venvs/unitem/bin/activate
cd engine && pytest -q

# UI: type-check + production build
cd UI && npm run build

# UI: lint
cd UI && npm run lint
```

---

## Technical architecture

### Pipeline

```
unitem.yaml (config) · conventions/*.yaml (shipped KB) · agent.md (project design spec)
        │
        ▼
┌─ 1. DISCOVER (deterministic) ──────────────────────────────────────┐
│  Walk both trees · classify stack (SwiftUI/UIKit · Compose/Flutter)│
│  Extract design facts: colors, spacing, radii, type sizes,         │
│  component usage, strings, nav routes   ← regex extractors today,  │
│  tree-sitter is the planned upgrade                                │
└──────────────────────────────────────────────────────────────────┘
        │
        ▼
┌─ 2. MAP (heuristics + LLM reconciliation) ─────────────────────────┐
│  Auto-generate mapping.json: {feature, ios files, android files,   │
│  confidence} via path/name/route/string-key similarity, then one   │
│  agent pass to reconcile ambiguous pairs. Human-overridable via     │
│  mapping.overrides.yaml. A screen on only one platform is itself   │
│  a finding.                                                         │
└──────────────────────────────────────────────────────────────────┘
        │
        ▼
┌─ 3. JUDGE (the brain — LLM agents, fan-out) ───────────────────────┐
│  diff: one classifier agent per atomic change                      │
│  audit: one classifier agent per mapped section (not yet built)    │
│  Each agent gets: extracted facts, the counterpart code slice,     │
│  retrieved convention rules, agent.md principles, override         │
│  memory, and a strict pydantic output schema.                      │
│  Returns: verdict + reason + confidence + cited rule ids.          │
└──────────────────────────────────────────────────────────────────┘
        │
        ▼
┌─ 4. RECONCILE (act on verdicts) ───────────────────────────────────┐
│  Propagate → generate the counterpart edit (token path via design  │
│      tokens, or a writer-agent code edit for whole-screen transfer)│
│  Flag      → ticket with a proposed one-line fix                   │
│  Hold      → explanation record — the "why this difference is      │
│      correct" money moment                                         │
└──────────────────────────────────────────────────────────────────┘
        │
        ▼
┌─ 5. REVIEW (human-in-the-loop console — the /UI app) ──────────────┐
│  Three panels: iOS code · Android code · verdict cards,             │
│  line-linked. Accept / override each verdict. Overrides persist to  │
│  overrides.jsonl and feed back into future JUDGE runs as few-shot   │
│  precedent — the tool learns the team's taste over time.            │
└──────────────────────────────────────────────────────────────────┘
```

**Retrieval discipline:** never dump whole codebases into a prompt. Detect the small
diff (or one mapped section) → retrieve only the counterpart slice and the matching
convention rules → judge that slice.

### Knowledge layer (grounds every verdict, in priority order)

1. **Shipped convention KB** (`conventions/conventions.yaml`) — curated Apple HIG vs.
   Material rules: what propagates (brand color, semantic tokens, spacing scale), what
   holds (native switches, nav idioms, system fonts, ripple vs. highlight), what flags
   (stale tokens, hardcoded values, contrast failures).
2. **Project design spec** (`agent.md`) — the team's own principles; overrides/extends
   the KB.
3. **Override memory** (`overrides.jsonl`) — every human override, replayed as
   precedent in future runs. Specificity order: overrides > agent.md > shipped KB.

### Design transfer (v2)

Beyond `diff`/`audit`, the engine can regenerate a whole Flutter screen from an iOS
design (`unitem transfer` / the console's "Transfer to Android" action):
reader agent → `DesignSpec` (colors, fonts, layout, and now a materials/effects
vocabulary for things like iOS 26 Liquid Glass) → writer agent → deterministic
substring verification → a DartPad compile gate → repair round → files land in
`sample-flutter`. See [`docs/10-liquid-glass-analysis.md`](docs/10-liquid-glass-analysis.md)
for how the Liquid Glass tier system extends this without touching the base pipeline.

### Runner abstraction

One `Runner` interface, three implementations (`engine/unitem/runner/`): `cursor`
(shells to `cursor-agent`), `claude` (shells to the `claude` CLI), `mock` (replays
`examples/fixtures/judge/*.json`, fully offline). Swapping providers never touches the
pipeline — see `unitem.yaml`'s `runner.name`.

### Reliability

- Bounded concurrency on agent fan-out; per-section timeouts and retries.
- Strict pydantic schema validation on every agent response; invalid → retry, then
  degrade to `flag / low confidence` rather than guessing.
- Stable finding IDs (`UNI-NNN`) and dedupe across runs.
- The `mock` runner makes the entire pipeline runnable offline with zero API keys —
  used for local dev, CI, and as the live-demo fallback.

### Repo structure

```
/engine            unitem Python package
  unitem/          cli.py · config.py · discovery.py · extractors.py · mapping.py
                   judge.py · generate.py · transfer.py · runner/ (cursor|claude|mock)
                   schema.py (pydantic) · aggregate.py · api.py (FastAPI, serves /UI)
  prompts/         classifier.md · generator.md · mapping-reconcile.md · transfer_*.md
  tests/
/conventions       conventions.yaml — the shipped convention KB (the moat)
/UI                review console (React 19 + Vite + TS + Electron) — browser is
                   the verified entry point; see UI/README.md for the full app map
/sample-ios        one-screen SwiftUI app (demo "iOS" side)
/sample-flutter    one-screen Flutter app (demo "Android" side)
/sample-android    Kotlin/Compose sample (kept supported, not the demo default)
/examples          fixture pair + agent.md + seeded changes for --runner mock
/docs              planning handoff, live-flow side doc, Liquid Glass analysis
ARCHITECTURE.md    the authoritative architecture spec (this file is the summary)
unitem.yaml        config: paths, runner/model, concurrency, output dir
```

For the full architecture rationale (positioning vs. existing tools, data contracts,
risk register, hackathon scope) see [`ARCHITECTURE.md`](ARCHITECTURE.md). For a
pipeline-lag/agent-conversation map to use while running a live demo, see
[`docs/09-live-flow-side-doc.md`](docs/09-live-flow-side-doc.md).
