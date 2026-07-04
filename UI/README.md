# Unitem

A macOS desktop app that compares an iOS (Swift) codebase and an Android (Flutter/Dart) codebase against a shared design rulebook and flags inconsistencies between them.

This repository contains the **frontend UI only**. A separate backend produces the comparison data and performs the actual fixes.

## Stack

- React 19 + Vite + TypeScript
- Tailwind CSS v4
- Electron (macOS desktop window)
- `react-resizable-panels` for the three-panel layout
- No routing, no state library — `useState` only

## Run it

```bash
npm install
npm run dev
```

`npm run dev` starts the Vite dev server and opens the Electron window once it is ready.

## Backend integration

The integration seam is deliberately small:

- **`src/types.ts`** — the data contract (`ComparisonResult`, `Inconsistency`, `CodePanel`, `Severity`, `Status`). The UI renders exactly this shape.
- **`src/mockData.ts`** — one hardcoded `ComparisonResult` the whole app reads from. Swap this module for a real fetch.
- **`src/App.tsx`** — the three action callbacks, each marked `// BACKEND: replace`:
  - `onResolve(id)`
  - `onIgnore(id)`
  - `onResolveAll()`

  They currently flip local status only; replace their bodies with real handlers without touching the components.

## Layout

Three vertical panels with draggable dividers:

1. **iOS · Swift** — syntax-highlighted source with line numbers; flagged lines are tinted by severity.
2. **Android · Dart** — same, for the Flutter side.
3. **Inconsistencies** — open counts, "Resolve all", filter chips (All / Errors / Warnings / Info / Ignored), and one card per inconsistency showing the rulebook expectation vs. both platform values. Clicking a card scrolls both code panels to the relevant lines and pulses them.
