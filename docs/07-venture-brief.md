# 07 — Venture Brief (for the pitch)

## Design Diplomat — one-paragraph brief with points

- **Objective:** Build an AI reasoning layer that keeps a product's iOS and Android designs in sync by judging, for each change, whether to *propagate* it, *hold* it as a correct platform difference, or *flag* it as drift.

- **What we're solving:** Cross-platform design drift — when a brand or component change lands on one platform but silently diverges on the other, forcing painful manual "sync meetings," especially during brand refreshes.

- **End users:** Design-systems teams, mobile engineers, and design leads at companies shipping on both iOS and Android — mid-to-large product orgs and design-tooling teams are the sweet spot.

- **Is it already out there?** Only partly. Mechanical translators like Style Dictionary convert tokens across platforms, and visual-regression tools flag pixel diffs — but none *reason* about whether a difference is intentional, idiomatic, or a bug. That judgment gap is unfilled.

- **What we add:** The "taste" layer — a curated platform-convention knowledge base (Apple HIG vs. Material) grounding an LLM that classifies each change with a plain-language reason, a confidence score, and a learn-from-override loop. Teams get *trustworthy* flags instead of noise.

- **Worth building a company around?** Cautiously yes, as a *wedge* — but design-system sync alone is likely a feature, not a company. It's strongest as the entry point into a broader "design-system intelligence" platform (drift detection, governance, auto-reconciliation across web/iOS/Android). Durability depends on whether Figma, Cursor, or the platform vendors fold this in first.

- **Is it sellable?** Plausibly. The pain is real, expensive, and recurring, and design-tooling teams already pay for Figma, Chromatic, and CI/linting tools — so it fits an existing budget line. The honest test: do teams feel the drift pain often enough to pay for a dedicated tool, or do they just tolerate it?

---

## Validation questions (ask 5–10 real design-system teams)

Whether this is "company-worthy" is best answered by conversations, not reasoning. The pain is real; its *frequency and severity per team* decides whether it's a vitamin or a painkiller.

1. When you last did a brand refresh, how did you keep iOS and Android in sync — and how long did it take / how many meetings?
2. How often do you find the two platforms have silently drifted apart? How do you currently catch it?
3. Who owns cross-platform consistency today, and is it anyone's actual job?
4. Would you trust an automated tool's judgment on "this should stay different vs. this is a bug"? What would earn that trust?
5. What do you already pay for in the design-tooling/CI space, and where would a tool like this sit in that budget?

If several teams describe the pain as recurring and expensive — and would trust a well-explained automated verdict — that's the signal it's more than a hackathon demo.

---

## Pitch framing lines (reusable)

- *"Style Dictionary translates tokens mechanically but has no judgment about whether a change should cross platforms. We built the reasoning layer that decides."*
- *"We don't make iOS and Android identical — that would be bad design. We know which changes should cross and which should stay native."*
- *"A spell-checker for cross-platform UI consistency: it doesn't design for you, it tells you what drifted and how to fix it."*
