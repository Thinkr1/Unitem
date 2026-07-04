# 05 — Team & Setup

## The key insight: the hardware split *is* the division of labor

The tool reconciles two platforms; the team naturally splits along the same line.

- **Android Studio + emulator run on Windows.** → The Windows machine owns the **entire Android side**.
- **iOS simulator needs Xcode (Mac-only).** → The Mac owns the **iOS side**.

**No physical phones are required.** "On the phone" for the demo means the free emulator/simulator. A Windows laptop is not a limitation — it holds down half the product plus the core engine.

---

## Roles (5 people)

| # | Owner | Machine | Responsibility |
|---|-------|---------|----------------|
| 1 | You | Windows | **Core engine** (tree-sitter parse + LLM classifier + code/token generation) **+ Android side** (emulator, apply patch, capture before/after). Highest-value seat. |
| 2 | Friend A | Mac | **iOS side** (Xcode simulator, apply patch, capture before/after) **+ co-architecture** with you. The Mac does the one thing only a Mac can. |
| 3 | Friend B | Any | **Review dashboard** — the iOS-view · verdicts · Android-view UI. (See note below — his original design survives.) |
| 4 | Friend C | Any | **Convention knowledge base + classifier prompt engineering** (`06`). This is the "taste" — the thing we're selling. Pairs closely with #1. |
| 5 | Friend D | Any | **Demo, pitch & integration** — build/curate the sample screen + the 3 rehearsed changes, wire the pieces end-to-end, own the 2-minute demo script and fallback screenshots. Underrated; often decides hackathons. |

*(Adjust names to your actual team. If you're only 3–4, merge #4 into #1 and #5 into #3.)*

---

## Note for the UI person (resolves the "website vs plugin" confusion)

His original layout — **iOS on the left, Android on the right, chatbot/console in the middle** — is exactly right and is **kept**. It only gets *upgraded*:

- Left panel = a **real iOS simulator screenshot** (from the Mac build).
- Right panel = a **real Android emulator screenshot** (from the Windows build).
- Middle = the **verdict console**: propagate/hold/flag cards, plain-language reasons, confidence, and the accept/override button.

So he's not building two fake phone apps — he's building the **operator console** that displays real results. This maps directly onto the track's "chat interface" example project. Nothing he's designed is wasted.

**Keep the whole dashboard browser-based** so the mixed Windows/Mac team is a non-issue. The only OS-specific work is the two simulator builds (owned by #1 Android / #2 iOS).

---

## Tooling checklist

**Everyone:**
- Git + the shared GitHub repo.
- LLM API key (confirm sponsor credits first — Claude/OpenAI).
- Node.js and/or Python.

**Engine (#1, #4):**
- Python (recommended for LLM orchestration + reporting) **or** Node — pick one backend language.
- tree-sitter + Swift and Kotlin grammars.
- The convention KB file (`06`).

**Dashboard (#3):**
- Web framework (Next.js/React is the safe default).
- Talks to the engine via a small API.

**Android side (#1):**
- Android Studio + an emulator image (runs on Windows).
- The sample Android app (one screen).

**iOS side (#2):**
- Xcode + iOS simulator (Mac).
- The sample iOS app (one screen, mirroring the Android one).

---

## Environment setup (suggested)

1. Create the repo structure: `/engine`, `/dashboard`, `/sample-ios`, `/sample-android`, `/docs` (drop these files here), `/knowledge-base`.
2. Author the **sample design system**: a small token set + one screen ("Settings" is a good pick) implemented on both platforms. You control the "before" state so you can trigger the three scenarios on demand.
3. Add the **screen-mapping manifest** (see `03`).
4. Stand up the token-level skeleton first (see build order in `04`).
5. Confirm API credits and wire the LLM call.

> Reminder: keep the core browser-/API-based. The moment the core depends on Xcode, half the team is locked out. Native builds stay as the two owned simulator tasks.
