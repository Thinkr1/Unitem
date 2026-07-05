# 10 — Liquid Glass Transfer: Feasibility Analysis

> Judge feedback: *"replicate iOS's Liquid Glass visual style on Android as a demo feature."*
> This document analyzes whether the current Unitem architecture can do it, what has to
> change, and how to stage the work. **Analysis only — no code changes; the existing
> transfer path stays as backup.**

---

## 1. Verdict up front

**Yes — feasible, with a tiered-fidelity plan.** The architecture (reader → DesignSpec →
writer → deterministic verify → repair loop) is the *right shape* for this; nothing needs
to be thrown away. What's missing is vocabulary and recipes, not structure:

| Tier | What it shows | Where it renders | Feasibility |
|---|---|---|---|
| **1. Glass approximation** | Blur + saturation + specular border + tint ("frosted glass") | DartPad preview in the console (today's pipeline) | **High — build this** |
| **2. Real Liquid Glass** | Shader-based refraction/lensing, jelly physics | Real Android device/emulator (`sample-flutter` built locally) | **Medium — stretch, with recorded fallback** |
| **3. Pixel-identical Apple glass** | Apple's private system shaders | Nowhere outside iOS | Not possible — and not needed for the demo |

Tier 1 is ~85% of the visual "wow" and runs entirely inside the existing console demo.
Tier 2 is the "on a real Android phone" money shot.

---

## 2. What Liquid Glass actually is (technically)

iOS 26's system material (WWDC 2025, now the shipping iOS design language). Composed of:

1. **Backdrop sampling** — live blur + saturation boost of whatever is behind the surface
2. **Refraction / lensing** — the backdrop is *displaced* near edges, like light through curved glass (this is the part that needs a fragment shader)
3. **Specular highlight** — a bright rim that responds to shape and (on device) motion
4. **Adaptive tint** — the surface tints from backdrop luminance, flips light/dark automatically
5. **Morphing** — nearby glass shapes blend/merge (`GlassEffectContainer`)

### The SwiftUI API surface (what our reader must recognize)

```swift
.glassEffect()                                    // default: .regular in a capsule
.glassEffect(.regular.tint(.blue).interactive(), in: .rect(cornerRadius: 16))
GlassEffectContainer(spacing: 20) { ... }         // morphing group
.glassEffectID("lens", in: namespace)             // morph transitions
.buttonStyle(.glass) / .buttonStyle(.glassProminent)
```

**Key insight for us: Liquid Glass is *declarative*.** It's a handful of modifiers, not
custom drawing code. That makes it exactly as readable by our reader agent as
`.cornerRadius(12)` is today. The hard part is entirely on the **write/render** side.

---

## 3. Where the current pipeline breaks (gap analysis)

The transfer pipeline is: reader agent → `DesignSpec` → writer agent → deterministic
verify (+ DartPad compile gate) → repair round → files land in `sample-flutter`.
Four surfaces touch a glass transfer, and each has a specific gap:

### 3.1 `DesignSpec` has no concept of *material* (engine/unitem/schema.py:144)

The spec is flat: `colors` (hex map), `fonts`, `elements[].style` (string→string).
A hex color can't describe "blur the backdrop and refract it." There is no vocabulary
for effects, layering, or backdrop-dependence.

- **Change:** add an `effects` vocabulary to the spec — per element:
  `{ effect: "glass", variant: "regular|clear|tinted", shape, tint, interactive, container_group }`.
  `DesignSpec` already has `extra="allow"`, so this is additive, not breaking.
- **Reader prompt** (`prompts/transfer_reader.md`) gets a section teaching the
  `glassEffect` family and requiring effects to be captured per element.

### 3.2 The writer free-styles Dart — glass needs a *recipe*, not improvisation

An LLM asked to "make it glassy" will produce a random `BackdropFilter` of random
quality every run. Non-deterministic beauty is a stage risk.

- **Change:** ship a curated, pre-tested pure-Dart glass widget (e.g. `lib/glass.dart`:
  `BackdropFilter(ImageFilter.blur)` + saturation `ColorFilter` matrix + gradient
  specular border + tint overlay, parameterized by shape/tint/intensity). The writer's
  instructions become mechanical: *"where the spec says glass, wrap in `LiquidGlassPanel(...)`,
  emit `lib/glass.dart` verbatim from this template."*
- This mirrors how the pipeline already handles `LOGO_PLACEHOLDER_DART` — a known-good
  snippet substituted deterministically, not trusted to the model.

### 3.3 The DartPad preview cannot run shader packages — the hard constraint

`transfer.py` enforces `_DARTPAD_PACKAGES` (a fixed bundle) and DartPad has **no asset
bundle**, so `FragmentProgram.fromAsset(*.frag)` is impossible there. The Flutter
ecosystem's real Liquid Glass packages confirm the ceiling:

| Package | Refraction | Web/DartPad |
|---|---|---|
| `liquid_glass_renderer` (the well-known one) | Yes (shaders) | **Impeller-only — no web at all** |
| `liquid_glass_widgets`, `liquid_glass_easy` | Yes on device, lightweight fallback on web | Web yes, **but not in DartPad's bundle** |
| Pure-Dart `BackdropFilter` recipe (§3.2) | No (blur/saturate/highlight only) | **Works — DartPad renders CanvasKit, `BackdropFilter` is core `material.dart`** |

Consequences:
- **Tier 1 in the console:** the pure-Dart recipe is the only DartPad-safe option — and it's
  genuinely good-looking (this is how every web "liquid glass" recreation works).
  Bonus: `preview_compile_source()` already inlines local imports, so a generated
  `lib/glass.dart` flows into the preview with **zero harness changes**.
- **Tier 2 on device:** `sample-flutter` built locally can use `liquid_glass_renderer`
  (Impeller is default on modern Flutter Android) for true refraction. Two write targets,
  one spec: recipe for preview, package for device. The compile gate stays DartPad-only.

### 3.4 The iOS panel is our own renderer — it must show glass too (UI/src/lib/swiftRender.ts)

The console's iOS preview parses SwiftUI source and renders it as HTML/CSS. It supports
~15 modifiers (`padding`, `frame`, `background`, `cornerRadius`, `font`, …) — no
`glassEffect`. If the iOS panel can't show glass, the side-by-side demo collapses.

- **Change:** add a `glassEffect` case mapping to CSS
  `backdrop-filter: blur(Npx) saturate(180%)` + translucent fill + border highlight.
  CSS backdrop-filter is well supported in Chromium/Electron. Small, contained change.
- Also parse `.buttonStyle(.glass)` and treat `GlassEffectContainer` as a pass-through
  group (morphing not needed for a static preview).

### 3.5 Verification is substring-based — and that still works

Today's checks: hex-in-output, font-in-output, copy-verbatim, DartPad compile. Glass
extends the same way, cheaply and deterministically:

- Spec says `effect: glass` on element X → generated screen **must** reference
  `LiquidGlassPanel` (hard failure feeds the existing repair round).
- Tint/intensity values checkable as substrings like colors are today.
- **Stretch (strong agentic-demo story):** a visual verifier — Playwright screenshots of
  both panels → LLM-vision "do these read as the same design?" → repair round. Optional;
  the substring gate alone is demo-safe.

### 3.6 One demo-design prerequisite: glass needs something behind it

The current `LoginView` sits on flat white — glass over white is invisible. The demo
screen must have a vibrant backdrop (gradient mesh / image), which is itself
demo-positive: restyle `sample-ios` Login as an iOS-26-style screen (gradient background,
glass card holding the fields, `.buttonStyle(.glass)`). Both previews then have real
content to blur, and the before/after is dramatic.

---

## 4. Why this fits the product thesis (pitch ammunition)

This is not a gimmick bolted on — it *strengthens* the three-verdict story:

- **Material 3 has no Liquid Glass.** So "should glass cross to Android?" is a genuine
  judgment call — exactly Unitem's thesis. Brand-expressive glass card → **Propagate**
  (via the recipe). System-chrome glass (tab bars, nav bars) → **Hold** (Android's
  Material idiom differs; forcing it would be wrong). The convention KB gets a
  `materials/liquid-glass` rule family saying precisely that.
- **The generalization claim the judge is really testing:** "if it can do Liquid Glass,
  it can copy any design." The honest version: every iOS visual construct crosses the
  bridge through the same three artifacts — (1) reader vocabulary, (2) a curated Flutter
  recipe, (3) a deterministic check. Liquid Glass is the *hardest current entry* in that
  table, which is what makes it the right demo. The architecture is a registry that
  grows; it is not a per-effect rewrite.
- **"Real iOS apps, not toy code":** the reader is an LLM, so unknown modifiers don't
  crash it — the gap generalizing beyond one screen is multi-file view resolution
  (following custom `View` structs across files), UIKit, and interaction states. That's
  future work regardless of glass, and glass doesn't make it worse.

---

## 5. Proposed build order (transfer v2 — "new shift code", old path kept as backup)

Keep `transfer_reader.md`/`transfer_writer.md` untouched; add v2 prompts + a spec
`effects` field behind a flag (or just new prompt files) so the current demo never breaks.

| # | Step | Size | Risk |
|---|---|---|---|
| 1 | Restyle `sample-ios` Login: gradient backdrop + `.glassEffect` card + `.buttonStyle(.glass)` | 0.5 d | none |
| 2 | `swiftRender.ts`: `glassEffect` → CSS backdrop-filter (+ glass button style) | 0.5 d | low |
| 3 | Reader prompt v2 + `effects` field in `DesignSpec` | 0.5 d | low |
| 4 | `lib/glass.dart` recipe widget (pre-tested in DartPad by hand) + writer prompt v2 + verify rule | 1 d | low — recipe is pre-validated |
| 5 | End-to-end console run; confirm DartPad renders `BackdropFilter` in the harness | 0.5 d | low |
| 6 | **Stretch:** `sample-flutter` on emulator with `liquid_glass_renderer` (true refraction) | 1–2 d | medium — Impeller/perf; fallback = pre-recorded capture |
| 7 | **Stretch:** convention-KB `materials/*` rules so a Hold verdict appears in the same demo | 0.5 d | low |

Total for the safe demo (1–5): **~3 days**. The demo beat: *"iOS just adopted Liquid
Glass. Watch Unitem read the SwiftUI, decide what should cross, and re-express Apple's
newest material on Android — live."*

## 6. Honest risk register

| Risk | Reality check |
|---|---|
| DartPad won't render blur | `BackdropFilter` is core Flutter, DartPad renders via CanvasKit — verify in step 5 before anything else |
| Approximation looks "cheap" next to real iOS | The specular border + saturation matrix is what sells it; pre-tune the recipe by hand, never live-generate its internals |
| Judge asks "is that *real* refraction?" | Tier answer ready: refraction runs on device (Tier 2 / recording); web preview is the approximation, and we say so |
| Shader packages flake on emulator | Fallback recording is captured *before* demo day, or Tier 2 is cut without touching Tiers 0–1 |
| Old demo regresses | v2 is additive (new prompts, additive spec field, new UI modifier case); the existing transfer path is untouched backup |
