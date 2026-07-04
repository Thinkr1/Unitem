# Design Diplomat — Project Handoff & Build Docs

> Cross-platform design-consistency agent for the **Cursor track** at the RAISE Summit hackathon.
> Team of 5 · mixed Windows/Mac · handoff to Claude Code for the build.

---

## One-liner

An AI tool that watches a product's **iOS** and **Android** design, and for every change decides whether to **propagate** it (sync across platforms), **hold** it (keep a correct platform difference), or **flag** it (fix real drift) — explaining each decision so designers and engineers stay in sync without a meeting.

The hard, winnable part is **taste**: knowing when something is *actually wrong* vs. just *different*.

---

## How to use these docs in Claude Code

Read them in order. They are self-contained — you should not need the original chat.

| File | What's in it |
|------|--------------|
| `01-track-brief.md` | The hackathon track (Cursor Statement One), plain-English explanation, what wins it |
| `02-project-overview.md` | The product: problem, the propagate/hold/flag model, examples, end users |
| `03-architecture.md` | Pipeline, chosen approach (real-codebase), tech stack, agentic loop, data contracts |
| `04-scope-plan-risks.md` | Core vs stretch, exact demo scope, build order, risks + fallback |
| `05-team-setup.md` | Roles, the Windows/Mac hardware split, tooling, environment setup |
| `06-convention-knowledge-base.md` | The "secret sauce" — seed rules for propagate/hold/flag (start here for engine work) |
| `07-venture-brief.md` | Business framing + validation questions (for the pitch) |
| `09-live-flow-side-doc.md` | Live Mermaid side doc for pipeline flow, agent handoffs, lag watch points, and focus prompts |
| `10-git-agent-control-room.md` | Git-linked control room for past/now/next agent workflow, lag, proof, and steering prompts |

---

## Current status

Planning is complete. Approach is locked:

- **Build the code-level version** (works on real repos), scoped to **one real screen on both platforms**.
- **Deterministic parsing + LLM judgment** hybrid.
- **No physical devices needed** — Android emulator (Windows) + iOS simulator (Mac).
- **Output = a PR** on the team's own GitHub repo + a review dashboard.

Next concrete step: build the **convention knowledge base** (`06`) and the **classifier prompt**, since the engine is only as smart as those rules.

---

## The 30-second pitch

> Ship a brand refresh on iOS and Android and things silently drift apart — one platform gets the new blue, the other doesn't; a team reinvents a button; a spacing value goes off-scale. Today a human catches this by eye in painful sync meetings. Design Diplomat reads both platforms' code, and for each change decides — with taste — whether it should cross to the other platform, stay deliberately different, or get fixed. It opens a PR and shows you the change live in the simulator.
