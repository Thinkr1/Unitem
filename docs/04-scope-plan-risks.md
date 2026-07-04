# 04 — Scope, Plan & Risks

## The exact demo scope (lock this)

> **One real screen, on both platforms. Three rehearsed changes. A PR to our own repo. Rebuilt in the two simulators.**

The three rehearsed changes should each demonstrate one verdict:

1. **Propagate** — a brand color change on one platform → generate + apply the equivalent on the other.
2. **Hold** — a platform-idiom change (e.g. iOS switch style) → explain why Android correctly stays different → do nothing.
3. **Flag** — a stray hardcoded old color / off-scale value on one platform → propose the one-line fix.

Showing propagate / hold / flag in one flow demonstrates all three of the track's buckets in a single narrative.

---

## Where to stop

Stop when the engine reliably produces, for each of the three scenarios: **the right verdict + a plain-language reason + the generated fix + a ticket**, shown live in the dashboard, with the **override loop** working, and at least the Propagate case rebuilt in the simulator/emulator and opened as a PR.

**Out of scope:** full-repo scanning, PRs at scale, arbitrary changes on arbitrary code, physical-device testing.

---

## Core vs. stretch

**Core (must have):**
- Deterministic diff → atomic change list.
- LLM classifier (propagate/hold/flag) + reason + confidence, grounded by the convention KB.
- Ticket JSON output.
- Review dashboard: iOS view · verdicts · Android view, with accept/override.
- Propagate case: generate the real code edit and open a PR on our repo.

**Stretch (nice to have, additive):**
- Live rebuild of the changed screen in emulator/simulator during the demo.
- Override actually retrains/adjusts future classifications.
- Screen-mapping inference (vs. explicit manifest).
- Confidence-driven UI (e.g. auto-accept high-confidence propagates).
- Cursor-workflow integration for sponsor goodwill.

---

## Build order (graceful-degradation ladder)

Build so you always have *something* demoable:

1. **Token-level skeleton first.** Diff two token files → classify → ticket → dashboard card. Fully self-contained, no code parsing. This is your reliable spine and your fallback.
2. **Add the convention KB + classifier prompt.** (Highest-value work — see `06`.)
3. **Add real-code parsing** (tree-sitter) for the ONE chosen screen.
4. **Add code-gen + PR** for the Propagate case.
5. **Add the live rebuild** in emulator/simulator (stretch).

Each layer is additive. If a later layer isn't ready, the demo still works on the previous one.

---

## Risks + mitigations

| Risk | Mitigation |
|------|------------|
| **Code-gen that doesn't compile** (biggest risk) | Don't promise arbitrary changes. Pick the exact 2–3 changes; make the generator bulletproof for *those*; rehearse. |
| **Live rebuild flakes on stage** | Fallback: show the generated diff + **pre-captured** before/after screenshots. Still fully convincing. |
| **Two front doors (CLI vs website)** | Resolve now: engine is a backend behind a small API; the dashboard is the demo. CLI is an internal dev tool only. |
| **Over-engineered agent framework eats time** | Cap at ~3 tools / 2 sub-agents that run end-to-end. |
| **Screen-mapping ambiguity** | Use an explicit manifest for the demo; inference is stretch only. |
| **No API credits** | Confirm sponsor credits (Claude/OpenAI) before committing a provider. |

---

## Definition of done (demo checklist)

- [ ] Three scenarios each return the correct verdict with a clear reason.
- [ ] Tickets render as cards in the dashboard with accept/override.
- [ ] Override changes subsequent behavior (or is clearly demoed).
- [ ] Propagate produces a real code diff and an actual PR on our repo.
- [ ] iOS + Android views shown side by side (real screenshots).
- [ ] A rehearsed 2-minute demo script exists.
- [ ] Fallback screenshots captured in case live rebuild fails.
