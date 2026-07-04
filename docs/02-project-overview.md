# 02 — Project Overview: Design Diplomat

## What we're building

An AI reasoning layer that keeps a product's **iOS** and **Android** designs in sync. For each change, it judges whether to:

- **Propagate** — it's a brand/semantic change → apply the equivalent change on the other platform.
- **Hold** — it's a platform idiom → the platforms *should* differ here → do nothing.
- **Flag** — it's drift/regression → a real bug → propose the fix.

The intelligence is **not** "make iOS and Android identical." That would be *bad* design — the platforms are supposed to differ in places. The intelligence is knowing **which changes should cross and which should stay different.**

---

## The problem we're solving

**Cross-platform design drift.** A product ships on both iOS and Android and shares a brand. When a change lands on one platform but silently diverges on the other, the apps fall out of sync. This is especially painful during a **brand refresh**, where dozens of values change at once and someone has to manually reconcile two codebases in a "sync meeting."

Concrete drift examples (running "ShopFast" scenario):

1. **Brand evolves.** Primary blue updated `#2563EB → #1D4ED8` in the design, but 40 spots in code still hardcode the old blue. Now the app shows two blues.
2. **New team ships a component.** The payments team builds its own button (6px corners, slightly different blue) instead of reusing the shared one. Two near-identical buttons.
3. **Interaction past its 40th state.** In a deep checkout flow, an error message uses 14px red text instead of the standard 16px. No human tracks all 41 states, so it slips through.

Each change was small and reasonable alone. Together, the product drifted from its own rulebook.

---

## The three verdicts, defined

### Propagate (sync across platforms)
The change expresses **brand or shared semantics** — it belongs everywhere.
- Brand/primary color change → both platforms.
- Brand typography (brand font, body text scale) → both.
- Spacing scale / grid unit change → both.
- Semantic color roles (error/success/warning) → both.
- Copy/content changes → both.
- **Direction is symmetric:** a change can start on *either* platform. Don't hardcode "iOS is the source." Treat it as "platform A changed → decide what happens to platform B."

### Hold (keep them different — on purpose)
The change is a **platform idiom** that should stay native.
- Toggle/switch (iOS `UISwitch` vs. Material `Switch`).
- Navigation (iOS back-swipe + top-left chevron vs. Android up/back).
- Date/time pickers (iOS wheel vs. Material date picker).
- **System** font (SF Pro on iOS vs. Roboto on Android) — but a **brand** font is Propagate.
- Elevation/shadows (Material elevation vs. iOS subtle/flat), ripple vs. highlight.
- Default touch targets (44pt iOS vs. 48dp Android).

### Flag (fix real drift)
The platforms have **silently diverged from the shared standard**, or a rule is broken.
- One platform still on the old brand color after an update.
- Hardcoded hex instead of a token.
- Spacing off the defined scale (e.g. 7px when the scale is multiples of 8).
- A component reimplemented instead of reusing the shared one.
- Text below the minimum body-text size, or contrast below the accessibility threshold.

---

## Why this is differentiated (not "already there")

Existing tools solve adjacent problems but **none reason about whether a difference should exist:**

- **Style Dictionary** — mechanically translates one token source into iOS/Android outputs. No judgment.
- **Visual-regression tools** — flag pixel diffs. No idea if a diff is intentional, idiomatic, or a bug.

**Our unique layer = the judgment + the convention knowledge base + cross-platform reconciliation.** Everything else is glue on existing tools (see `03-architecture.md`).

---

## End users

Design-systems teams, mobile engineers, and design leads at companies shipping on **both** iOS and Android. Sweet spot: mid-to-large product orgs and design-tooling teams. They already pay for Figma, Chromatic, and CI/linting tools, so this fits an existing budget line.
