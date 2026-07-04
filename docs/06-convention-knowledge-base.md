# 06 — Convention Knowledge Base (the secret sauce)

This is the file that gives the classifier its **taste**. Without it, the LLM guesses and hallucinates. With it, the LLM is *grounded* in real Apple HIG vs. Material Design conventions. **This is the highest-value artifact in the project — start here for engine work.**

The classifier's job for each atomic change: match it against these rules → return `propagate | hold | flag` + a reason that cites the rule.

---

## How the classifier uses it

1. Deterministic parse produces an atomic change (e.g. `component: toggle style changed on iOS`).
2. Retrieve the most relevant convention rule(s).
3. LLM decides the verdict, grounded by the rule, and cites it in `convention_refs`.
4. If no rule matches confidently → default to **Flag with low confidence** and ask the human (safer than a wrong auto-propagate).

---

## Rule structure (machine-readable seed)

```yaml
# knowledge-base/conventions.yaml
rules:
  - id: propagate/brand-color
    verdict: propagate
    applies_to: [color]
    when: "the changed value is a brand or semantic color token (primary, accent, error, success, warning)"
    why: "Brand and semantic colors express identity and meaning; they must be identical across platforms."
    examples:
      - "primary #2563EB -> #1D4ED8 on iOS should apply to Android"

  - id: hold/native-switch
    verdict: hold
    applies_to: [component]
    when: "a toggle/switch is changed to the platform-native control style"
    why: "iOS uses UISwitch; Android uses the Material Switch. Each platform should keep its native control. This is correct divergence, not drift."
    examples:
      - "iOS switch restyled to native iOS switch -> Android keeps Material Switch"

  - id: flag/hardcoded-color
    verdict: flag
    applies_to: [color]
    when: "a raw hex value is used instead of a defined token, OR one platform still uses the old value of a token that changed elsewhere"
    why: "Hardcoded values and stale values are drift; they break the single source of truth."
    examples:
      - "Android still Color(0xFF2563EB) after brand updated to #1D4ED8"
```

Extend this file with the rules below.

---

## PROPAGATE rules (should cross platforms)

Brand and shared-semantic changes belong everywhere.

- **Brand / primary / accent colors** — identity; must match.
- **Semantic color roles** — error, success, warning, info; meaning must match.
- **Brand typography** — the brand font family and the type scale (body, heading sizes).
- **Spacing scale / grid unit** — if the base unit or scale changes, both platforms follow.
- **Corner-radius token** *when it's a brand expression* (a global brand roundness), not a control-specific platform default.
- **Iconography / logo** — brand assets.
- **Copy / content / labels** — wording should match.
- **Component behavior/logic** that isn't platform-specific (e.g. validation rules, states).

## HOLD rules (keep different on purpose — platform idioms)

These are where naive "make them match" tools get it wrong.

- **Toggle / switch** — iOS `UISwitch` vs. Material `Switch`.
- **Navigation** — iOS back-swipe + top-left chevron + large titles vs. Android up/back + top app bar.
- **Tab / bottom navigation** — iOS tab bar vs. Android bottom navigation (similar role, different idiom).
- **Pickers** — iOS wheel date/time picker vs. Material date/time picker.
- **System font** — SF Pro (iOS) vs. Roboto (Android) *when using the platform system font*. (Brand font = Propagate.)
- **Elevation / shadow** — Material elevation vs. iOS's flatter, subtler shadowing.
- **Touch feedback** — Android Material ripple vs. iOS highlight/opacity.
- **Dialogs / action sheets** — iOS action sheet vs. Material dialog/bottom sheet styling.
- **Default touch targets** — 44pt (iOS) vs. 48dp (Android).
- **Safe areas / status bar / notch handling** — platform layout rules.
- **Haptics patterns** — platform-specific.
- **Back-button presence** — Android has a system back; iOS relies on in-app navigation.

## FLAG rules (real drift / regressions — fix them)

- **Stale token value** — one platform still on the old value after the other updated.
- **Hardcoded value** — raw hex/number instead of a token.
- **Off-scale value** — spacing/size not on the defined scale (e.g. 7px when scale is multiples of 8).
- **Reimplemented component** — a bespoke version instead of the shared component.
- **Below-minimum text size** — smaller than the body-text minimum.
- **Contrast failure** — text/background contrast below the accessibility threshold (WCAG AA).
- **Naming mismatch** — token/screen names that break the mapping between platforms.

---

## Guardrails for the classifier prompt

- Never conclude "make them identical." The default question is *"should this specific change cross?"*, not *"are they the same?"*.
- If a change is a **platform idiom (Hold)**, say so explicitly and explain *why the difference is correct* — that explanation is the demo's money moment.
- When unsure, **Flag with low confidence and defer to the human** rather than auto-propagating.
- Always output a **reason** a designer would find reasonable, and cite the matched rule id(s).
- A change can originate on **either** platform — do not assume iOS is always the source of truth.

---

## Suggested starter check to include (cheap, looks rigorous)

Add a deterministic **contrast check** (WCAG contrast ratio) as one of the engine's tool calls. When a color change lands, verify text/background contrast still passes AA. It's a few lines of math, grounds a Flag verdict in a hard number, and makes the tool feel like it has real engineering behind the "taste."
