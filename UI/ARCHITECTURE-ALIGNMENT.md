# UI ↔ Engine Alignment Brief

> **For the UI owner.** This landed with the backend/architecture changes — read this first.
> Full architecture: [`../ARCHITECTURE.md`](../ARCHITECTURE.md) (§7 has the formal contract).
> **TL;DR: your layout, interaction model, and integration seam all survive as-is. We're adding one dimension to the data — the *verdict* — because it's the thing this hackathon track is judged on.**

---

## Why anything needs to change

The track statement is explicit: *"the question isn't whether the model can read your tokens… it's whether the system has enough **taste** to know when something is wrong."*

A tool where every finding is a rulebook violation with a severity is a linter — that already exists, and judges will say so. Our differentiator is that every cross-platform difference gets one of **three verdicts**:

| Verdict | Meaning | Example (from your own mock data) |
|---|---|---|
| **Flag** | Real drift — one/both platforms broke the rulebook | Your `inc-001` button padding: rulebook says 16, iOS 20, Android 12 → fix both. **This is exactly the card you already built. It doesn't change.** |
| **Propagate** | A *legitimate change* on one platform that should cross to the other | Your `inc-002` reimagined: design updated primary to `#4F46E5`, Android has it, iOS is still on `#5A55F2` → generate the Swift edit, open a PR |
| **Hold** | The platforms *should* differ here — platform idiom (HIG vs Material) | iOS uses a native `Toggle`, Android a Material `Switch` → **do nothing**, but explain *why the difference is correct* |

The Hold card is the demo's money moment — an AI that says "don't touch this, and here's why" is what "taste" looks like on screen. Right now the contract has no way to render it, because a Hold isn't a violation of anything.

---

## Contract changes (`src/types.ts`)

Additive first — everything below is **optional**, so the app keeps compiling and the current mock keeps working while you adopt incrementally. A card with no `verdict` renders exactly as today.

```ts
export type Verdict = 'propagate' | 'hold' | 'flag'

export interface Inconsistency {
  // ── existing fields: all kept ──────────────────────────────
  id: string
  property: string
  severity: Severity                 // stays — secondary ranking within flags
  rule: string
  ios: { value: string; line: number }
  android: { value: string; line: number }
  status: Status

  // ── new, all optional ──────────────────────────────────────
  verdict?: Verdict                  // drives card variant; absent = flag
  confidence?: number                // 0..1, shown as a small % on the card
  reason?: string                    // plain-language explanation (Hold's body text)
  conventionRefs?: string[]          // cited rule ids, e.g. "hold/native-switch"
  originPlatform?: 'ios' | 'android' // propagate: where the change started
  proposedFix?: {                    // propagate/flag: previewable diff
    targetPlatform: 'ios' | 'android'
    file: string
    diff: string
  }

  // ── one breaking change ────────────────────────────────────
  expected?: string                  // now optional: propagate/hold have no
                                     // "rulebook expects" value (guard the two
                                     // places the card renders it)
}
```

**Naming — your call, not ours:** the architecture doc calls these "findings" and uses `status: accepted | overridden`. If renaming `inconsistencies`/`resolved`/`ignored` across your components is churn you don't want, **keep your names** — the engine has an adapter layer and will emit whatever this file declares. The contract is `types.ts`; you own it.

---

## Per-verdict card treatment

- **Flag** → your current card, unchanged (severity border, expected vs both values, Resolve/Ignore).
- **Propagate** → no "Rulebook expects" row. Show `before → after` on the origin platform, then the `proposedFix.diff` in a small mono block (reuse your `bg-well` diff-block styling). Primary action: **Approve** (backend opens a PR; response includes the PR URL — worth rendering as a link).
- **Hold** → visually *not a problem*: neutral/positive accent instead of a severity border, excluded from the open-issues count and from "Resolve all". Body = `reason` (why the difference is correct). No fix button; only an override ("actually, this should match").
- Filter chips: add verdict as the primary filter (All / Propagate / Hold / Flag) — severity can stay as a secondary or fold into Flag.

**One behavioral change we do need:** "Ignore" currently records nothing. The whole learning story ("the tool learns your team's taste") depends on an override carrying the human's *corrected verdict*: `onIgnore(id)` → `onOverride(id, correctedVerdict, note?)`. A tiny popover with three options is plenty.

---

## The Dart → Kotlin question (please read before building more on Dart)

The mock treats Android as **Flutter/Dart**. Strong recommendation to switch to **Kotlin / Jetpack Compose**:

1. Flutter is itself cross-platform — one Dart codebase normally ships *both* iOS and Android. "Swift iOS + Flutter Android" is a customer that barely exists.
2. Our Hold verdicts are grounded in a curated **Apple HIG vs Material Design** knowledge base — native-idiom reasoning that doesn't make sense against a framework whose point is uniform rendering.
3. Cost today: `language: 'swift' | 'kotlin'`, new mock code string, a tweak in `lib/highlight.tsx`. Cost after more Dart-specific work: much higher.

If you have a reason to prefer Dart (e.g. that's the sample app someone's already building), raise it now — this is the one open decision that blocks other work.

---

## How the backend plugs in (your marked seams, unchanged)

| Your seam | Replaced by |
|---|---|
| `mockData.ts` import | `GET http://localhost:8787/comparison?screen=login` → `ComparisonResult` |
| `onResolve(id)` | `POST /findings/{id}/accept` → applies fix; propagate ⇒ opens PR, returns PR URL |
| `onIgnore(id)` | `POST /findings/{id}/override` body `{verdict, note?}` → recorded, feeds future runs |

`ComparisonResult` gains `screen: string`. `onResolveAll` should apply to flags only (each propagate is an individual PR decision). Until the API exists, extend `mockData.ts` with one example per verdict and keep developing against it — the engine ships a `--mock` mode that serves the same fixtures, so the UI never blocks on the backend.

---

## Suggested order (each step leaves the app working)

1. `types.ts`: add the optional fields + `Verdict` type; make `expected` optional and guard its two render sites.
2. `mockData.ts`: add one propagate + one hold example (keep the current flags).
3. Card variants: verdict badge; propagate diff block; hold styling + exclusion from counts.
4. Filter chips → verdicts; `onIgnore` → `onOverride(id, verdict, note?)`.
5. Kotlin swap (types union + mock code + highlighting) — after the Dart/Kotlin decision.
6. Swap `mockData.ts` for the fetch once the engine API is up.

## What NOT to change

Panel layout, resizable groups, line-link + pulse behavior, card expand animation, Electron shell, the `types.ts`-as-contract approach. All of it is right and is now the official front end in `ARCHITECTURE.md`.
