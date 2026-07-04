# Project design spec — sample app ("Unitem sample")

Brand and shared-semantic decisions for this product. These override the
generic convention rules; team overrides (overrides.jsonl) override both.

## Tokens in force

| Token | Value | Notes |
|---|---|---|
| color.brandPrimary | #6366F1 | brand indigo — must match on both platforms |
| color.brandInk | #1A1B4B | headings |
| color.textSecondary | #8A8BB3 | secondary text, links like "Forgot password?" |
| color.surface | #FFFFFF | default background |
| size.inputHeight | 52 | text inputs, both platforms |
| size.radiusButton | 12 | brand roundness — a brand expression, not a platform default |
| size.spacingUnit | 8 | spacing scale is multiples of 8 (4 allowed as half-step) |
| font.headingSize | 28 | Space Grotesk headings |
| copy.signIn.label | "Sign In" | primary auth action wording |

## Project principles

- The brand font is Space Grotesk on both platforms (a brand choice — propagate).
  System-font fallbacks stay native (SF Pro / Roboto — hold).
- Button corner radius (12) is a deliberate brand expression: propagate changes to it.
- Never hardcode hex values; always reference a token.
