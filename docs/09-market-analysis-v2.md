# Market Analysis v2 — AI Migration Playbook Platform
### Wedge: Swift → Flutter | Vision: any-stack → any-stack code migration

*Hackathon project, RAISE Summit Paris, July 2026. Research current as of July 4, 2026.*

> **Note for agents:** This is adjacent GTM / pitch research (migration-playbook wedge). The repo's primary product is **Unitem** — cross-platform design-consistency judgment (propagate / hold / flag). See `ARCHITECTURE.md` and `07-venture-brief.md` for the shipped product story.

---

## 1. Thesis

Code migration is one of the largest, most hated, most procrastinated categories of engineering work on Earth — and the market for solving it is a **barbell**: heavily-funded enterprise platforms on one end, free open-source tools on the other, and **nobody serving the bottom of the market** (solo devs, students, vibe coders, tiny startups).

We enter at the empty bottom with a web app that scans a repo, generates a structured migration playbook, and hands execution to Cursor. Wedge vertical: **Swift iOS apps → Flutter**. Expansion: any framework/language migration where a playbook + LLM beats raw LLM chaos.

---

## 2. Why Now — four converging forces

**Force 1: LLMs crossed the migration-competence threshold.**
Google published results (FSE 2025) from 39 internal migrations over 12 months: ~74% of code changes and ~69% of edits were LLM-generated, with developers estimating ~50% total time reduction. Amazon internally migrated ~1,000 production Java 8 apps to Java 17 in two days with a five-person team using Q Code Transformation — ~10 minutes average per app. The capability is proven at the highest level. What's missing downstream is *packaging* for normal humans.

**Force 2: The EOL treadmill never stops.**
Vue 2 hit end-of-life Dec 31, 2023. Vuetify 2 followed Jan 2025. AngularJS died 2022, Python 2 in 2020, Java LTS churns every 2 years, React major versions force codemod waves. Every EOL event creates a forced-migration cohort with a deadline and compliance pressure (SLAs, CISO requirements, unpatched-XSS liability). This is a *recurring* demand generator, not a one-time market.

**Force 3: The vibe-coder debt wave (the new, unserved cohort).**
AI tools now generate ~41% of all new code written globally. Millions of people are shipping apps they could not have written unaided — which means they *cannot* migrate, upgrade, or port them unaided either. This population is growing faster than any traditional developer segment, has real money at stake (their shipped product), and is invisible to every enterprise migration vendor. **They are our beachhead.**

**Force 4: Distribution rails exist.**
Cursor/Claude Code are already installed on the target user's machine. We don't need to build an execution engine — we build the intelligence layer (repo analysis + playbook) and ride existing rails. This is why a one-day hackathon build is even possible.

---

## 3. Market Sizing

### The layered TAM (defensible in a pitch)

**Layer 1 — Application modernization services (the money that exists today):**
~$26–30B in 2026, growing 15–20% CAGR toward $60–100B by the early 2030s depending on the analyst. This is mostly enterprise services (IBM, Accenture, Cognizant, TCS) — i.e., human labor we partially automate.

**Layer 2 — The technical-debt shadow market (the pain that exists today):**
US accumulated technical debt is estimated at ~$1.5T; annual cost of poor software quality ~$2.4T. Developers spend 33–42% of their week on debt and maintenance (Stripe: 13.4h/week). Migration is the single most concentrated form of debt paydown. Even 0.1% of this converting to tooling spend = $1.5–2.4B/year.

**Layer 3 — The wedge (Swift→Flutter, what we can win first):**
~2.2–2.4M iOS apps, ~1M publishers, of which realistically 150k–300k are solo/small-team, iOS-only, with a live product worth porting. Add the mobile-specific catalysts: iOS is ~57% of the US smartphone market, meaning every US iOS-only founder is locked out of ~43% of domestic users, and Flutter already powers 1M+ live apps (it's the safe target, not a bet).

### SOM (Year 1, honest)
SEO-led, solo founder, freemium: 20k–60k free playbook runs, 500–2,500 paid conversions at $49–99 → **$25k–$250k revenue Year 1**. Ramen-profitable, seed-fundable *only* with the platform story (Layer 1+2), not the wedge alone.

---

## 4. Competitive Landscape — the full map

### Tier 1: Enterprise heavyweights (top of the barbell — not our fight)

| Player | What | Signal |
|---|---|---|
| **AWS Transform / Amazon Q** | Java upgrades, .NET→Linux (claims 4x faster, −40% licensing), VMware, mainframe. Agentic, autonomous analysis→codegen→test | Hyperscalers treat migration as a cloud-onramp loss-leader. Customer quote: 10k LOC Java 8→17 "two weeks of expert work" done "in minutes"; one org reports −60% tech debt |
| **Google Cloud** | Mainframe Assessment Tool (GA), Mainframe Rewrite (preview), Dual Run validation — all Gemini-powered | Same play: migration as GCP funnel |
| **Mechanical Orchard** | Mainframe/COBOL → cloud via behavior-replication ("the running system is a better spec than its code"). $84M+ raised (GV, Emergence), ~100 staff, Thoughtworks partnership, Gartner Cool Vendor 2025 | Proves investors will fund migration at scale — for Global 2000 only |
| **Moderne / OpenRewrite** | Deterministic rule-based refactoring engine; AWS builds on it | The AST-rules incumbent; enterprise sales motion |

**Takeaway:** enormous validation, zero overlap. All of these require enterprise sales cycles, target Fortune 2000, and start at six figures. None will ever build for a 19-year-old with a 8k-LOC SwiftUI app.

### Tier 2: Startups in the middle (cautionary tales + neighbors)

| Player | What | Signal |
|---|---|---|
| **Grit.io** | JS→TS, AngularJS→Angular, class→functional codemods + AI. $7M seed led by Founders Fund (Aug 2023) | **Acquired by Honeycomb, April 2025** — sub-2-year exit. Reading: pure migration tooling for mid-market struggled to become a standalone company; talent+tech got absorbed |
| **Codemod.com** | AI + compiler tech for large-scale migrations (React 19 upgrade, i18n). Community automations used at 10k+ companies. Ex-Meta/Brex founders, seed-funded | Closest philosophical neighbor: community-powered migration recipes. But dev-team-oriented (CLI, codemod authors), not vibe-coder-oriented |
| **LatentForce.ai** | AI workforce for legacy modernization; raised most recently Dec 2025 | The space is still getting funded *right now* |
| **Skip.dev** | Swift→Kotlin transpiler + SwiftUI-on-Android framework. 3 years as paid product → **went fully free & open-source Jan 21, 2026**: "the plain truth is that developers expect to get their tools free of charge" | The most important signal in our space — dissected below |

### Tier 3: The genius validator — **HeroDevs**
HeroDevs sells "Never-Ending Support" — paid security-patched forks of *dead* frameworks (Vue 2 NES, Vuetify 2, AngularJS). Companies literally **pay recurring money to avoid migrating**. That is the strongest possible evidence of how painful migration is: an entire profitable company exists as the "don't do it" option. We are the "actually do it" option for people who can't afford either HeroDevs or an agency.

### Tier 4: Generic AI coding tools (Cursor, Claude Code, Devin, Windsurf)
Not competitors — **rails**. They execute; they don't strategize. No repo-level migration planning, no dependency-ordered port sequence, no framework-pair knowledge encoded. Airbnb-style case studies and Google's paper both show the win comes from *human-structured process + LLM execution*, which is exactly the layer we sell. Risk of them absorbing this layer is addressed in §8.

### The gap (our claim)
Enterprise vendors: $100k+ engagements. Startups: mid-market dev teams. OSS: skilled devs willing to fight toolchains (Skip installation was described by an early adopter as "an exercise in reading logs, finding failures, and downloading more stuff you must implicitly trust"). **Nobody has productized migration for the bottom million: solo devs, students, vibe coders.** That's not because the segment is worthless — it's because until ~2024, this segment couldn't execute a migration at any price. LLMs changed that. The segment just became serviceable, and no incumbent has noticed.

---

## 5. Why Skip.dev going free doesn't kill us (and actually helps)

1. **Different job.** Skip = greenfield framework: write Swift/SwiftUI *inside Skip's system* from day 1, get Android at build time. Retrofitting an existing app into Skip is documented community pain ("a house of cards"). We take **existing** repos as-is.
2. **Different output.** Skip → Kotlin/Compose (two ecosystems to understand). We → Flutter (one codebase, one language, the thing a non-expert can actually maintain).
3. **Different user.** Skip demands real Swift skill (Kotlish quirks, Int32/Int64 footguns, `#if SKIP` blocks, SwiftPM-only). Our user might not know what SwiftPM is.
4. **Their retreat from paid is our pricing lesson, not our doom.** Skip sold *developer tooling* to *skilled developers* — the demographic most hostile to paying for tools (they said so themselves). We sell an *outcome* ("your app, on Android, this weekend") to *outcome-buyers*. Outcome pricing survives where tool pricing dies. Same reason people pay for Canva while Photoshop-skilled designers pirate plugins.
5. Their open-source engine (skipstone) is now **free R&D for us** — a reference implementation of Swift-ecosystem edge cases we can mine for playbook rules.

---

## 6. Positioning

**One-liner (wedge):** "Point us at your Swift repo. Get a step-by-step playbook that turns Cursor into a competent Flutter porting engineer. Ship on Android this weekend."

**One-liner (platform):** "The migration layer for the AI coding era — repo analysis + battle-tested playbooks for any stack-to-stack move."

**Against each alternative:**
- vs. doing nothing: your Android users are 43% of the US market you're ignoring
- vs. agency: $49, not $25,000–$80,000 (mid-tier cross-platform build quotes)
- vs. raw Cursor/Claude: structure. Sequenced port order, dependency mapping, test gates — the difference between a port and a 3-week hallucination spiral
- vs. Skip: no framework adoption, no toolchain hell, works on the app you already have
- vs. HeroDevs-style life support: pay once to escape, not forever to stay

---

## 7. Business model

**Freemium, outcome-priced, per-repo:**
- **Free:** public repos ≤5k LOC — analysis + basic playbook. (SEO magnet, community seed)
- **$49 one-time per repo** (≤15k LOC): full playbook, private repos, architecture-specific Cursor prompt library, dependency-swap map (CoreData→Drift, Combine→Riverpod, etc.)
- **$99–199:** larger repos, priority support, re-runs as the port progresses
- **Later — playbook marketplace:** community-contributed migration pairs (React→Vue, Django→FastAPI, JS→TS...) with **revenue share to authors**. This is the Codemod community model with an actual incentive layer — the only version of "community moat" that works.

Value anchor: a solo dev's port is 40–120 hours of work they can't do. At any self-valuation of time, $49 is noise. Cross-check: agencies charge $25k+; HeroDevs charges recurring fees for *not* solving the problem.

**V1 scope discipline:** ≤15k LOC apps only, stated on the landing page. "Any size adapts" is where credibility dies; small honest scope beats vague large scope.

---

## 8. Risks — brutal version

1. **Foundation models absorb the playbook layer.** Claude/Cursor get so good that unstructured "port my app" just works. *Mitigation:* Google's own data shows structure is what made their 50% savings possible; sequencing and validation gates are process IP, not model IP. Also: if this happens, it happens to Codemod, Moderne, and $84M Mechanical Orchard too — we'll have the smallest sunk cost and the fastest pivot.
2. **The Grit precedent.** Founders Fund money, real product, acquired inside 2 years. Migration tooling may be a feature, not a company. *Mitigation:* Grit sold to dev teams (tool buyers). We sell outcomes to non-experts. Different elasticity. Also, for a 17-year-old solo founder, a Grit-style early acquisition is not exactly a failure mode.
3. **Wedge too small + platform too broad.** Classic barbell trap in reverse. *Mitigation:* wedge first, expansion only after wedge revenue. The platform story is for pitches, not for the July roadmap.
4. **Validation is 2 interviews.** Everything above is architecture on sand until 10–15 more conversations happen. Fastest sources: r/FlutterDev, r/iOSProgramming, r/SwiftUI, Indie Hackers, eLab cohort.
5. **Port quality liability.** A bad port that loses someone's App Store momentum is reputational damage in a small community. *Mitigation:* test-gate-heavy playbooks; "review checkpoints" as a feature, not friction.
6. **Skip could pivot to retrofit-porting.** They have the Swift expertise. *Mitigation:* they just went donation-funded — they have no commercial engine to chase our segment; their architecture (build-time transpilation) is fundamentally not a porting architecture.

---

## 9. GTM

**Phase 0 (hackathon):** working demo — repo in, playbook out, Cursor executes one screen live. The demo *is* the distribution at RAISE.
**Phase 1 (July–Aug):** landing page + free tier. 5 SEO posts: "Swift to Flutter migration guide," "SwiftUI → Flutter widget map," "CoreData → Drift," "port iOS app to Android cost," "Cursor iOS to Android." Reddit launches. Build-in-public thread.
**Phase 2 (Sept–Oct, at NYU):** eLab cohort as user lab; 30-unit-style discipline — 25 completed paid ports as the traction metric. Cursor community/directory presence.
**Phase 3:** second migration pair chosen *by observed search demand*, not by opinion. Marketplace incentive design.

---

## 10. Hackathon pitch (60 seconds)

> Migration is the work every developer procrastinates. Enterprises pay Accenture millions; Amazon and Google built internal AI that does 70%+ of migration edits automatically. But the fastest-growing group of builders — the millions shipping apps with AI assistance — get nothing. They shipped an iOS app they couldn't have written alone, users are asking for Android, and their options are a $30k agency or a hallucination spiral in Cursor.
>
> We built the missing layer: scan the repo, generate the exact playbook — architecture map, dependency swaps, port order, test gates — and let Cursor execute it. Swift→Flutter today. Every migration pair tomorrow, with community playbooks and revenue share.
>
> One company sells eternal life support for dead frameworks. Another raised $84M to migrate mainframes. The bottom of this market — the one growing fastest — is empty. We're taking it for $49 a repo.

---

## 11. Metrics that matter (first 90 days)

Completed ports (not signups) · free→paid conversion · time-to-first-Android-build · playbook step failure rate (which steps Cursor botches → product improvement loop) · SEO impressions on the 5 target queries · interview count (≥15 before any paid launch).
