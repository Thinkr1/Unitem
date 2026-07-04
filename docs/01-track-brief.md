# 01 — Track Brief (Cursor)

## Context

- **Event:** RAISE Summit hackathon
- **Track:** Cursor — "Statement One"
- **Team:** 5 people
- **Note:** "Cursor" is the *sponsor*. The task is **not** about the Cursor editor and does **not** require building anything inside Cursor. You may build in any tool. (Using Cursor's agent tooling can earn sponsor goodwill, but it's optional.)

---

## The statement (verbatim)

> Static design tokens and component libraries are brittle contracts: the moment a brand evolves, a new team ships a component, or an interaction grows past its fortieth branching state, the system quietly fractures. Build an AI-native design system that reasons about consistency across a product's visual and interactive surface — detecting drift, proposing reconciliation, and keeping designers and engineers aligned without a synchronization meeting. The question isn't whether the model can read your tokens or trace a state graph; it's whether the system has enough taste to know when something is wrong.

**Example projects given by the track:**

1. A CLI that diffs your Figma token file against your deployed CSS and surfaces semantic mismatches with proposed fixes.
2. A visual regression tool that classifies diffs as intentional redesigns, accidental regressions, or platform-imposed constraints — explaining its reasoning and drafting a fix for anything flagged as a regression.
3. A chat interface where a designer describes an intent and the system shows which existing tokens and components satisfy it versus which ones conflict.

---

## Plain-English explanation

A **design system** is the rulebook + parts kit that keeps a product's UI consistent: defined colors, spacing, fonts (**tokens**) and reusable pieces (**components** like buttons and cards). This is a technical term — it has nothing to do with drawing or making art.

Over time the UI **drifts** out of sync with its own rulebook: someone tweaks a color, a new team ships a slightly different button, the design and the live code stop matching. Normally a human catches this by eye. Tedious and error-prone.

The track asks: build an AI that catches drift automatically, **reasons** about it, and proposes a fix — so teams stay aligned without a sync meeting.

---

## What actually wins this track: **taste**

A dumb script can say "these two hex codes differ." That's useless, because **not every difference is a bug.** The intelligence is telling three cases apart:

- **Intentional redesign** — someone meant to do this. Leave it.
- **Accidental regression** — a bug slipped in. Flag it + fix it.
- **Platform-imposed constraint** — e.g. iOS forces a native style. Not a bug. Leave it.

A tool that flags all 100 differences is noise. A tool that flags the 3 that matter — and explains *why* — is trustworthy. **That is the whole game.**

---

## How our project maps to the track

We take the **"platform-imposed constraint"** case — which most teams treat as an edge case — and make it the **center** of the product, applied to **iOS vs. Android**. Our project combines example projects **#2 (classify diffs)** and **#3 (chat/dashboard interface)**, on a **real codebase**.

Track language → our feature:

- "detecting drift" → catching where iOS and Android silently diverged
- "proposing reconciliation" → generating the matching change on the other platform
- "without a synchronization meeting" → the two platform teams stay aligned automatically
- "taste to know when something is wrong" → deciding propagate vs. hold vs. flag

---

## Sibling tracks (context only — not what we're doing)

- **Vultr** — enterprise document-grounded agent (plan, retrieve repeatedly, cite sources).
- **Crusoe** — live situational-awareness agent for physical/operational environments, with operator override.
- **Google DeepMind** — state-holding multimodal agent using load-bearing Gemini primitives.

A recurring motif across all of them worth borrowing: **a human can override, and the override feeds back into the next recommendation.**
