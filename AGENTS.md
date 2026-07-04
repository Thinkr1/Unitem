# Unitem

## Cursor Cloud specific instructions

- The only runnable code lives in `UI/` (React 19 + Vite + TypeScript + Electron). The repo root and `docs/` are documentation only. Run all commands from `UI/`.
- Standard commands are in `UI/package.json`: `npm run lint` (oxlint), `npm run build` (`tsc -b && vite build`), `npm run dev`.
- `npm run dev` runs Vite **and** Electron via `concurrently`. Electron is a macOS-oriented desktop shell (`titleBarStyle: 'hiddenInset'`, macOS traffic-light positioning) and needs a display; in a headless Linux VM it will not open a window. To develop/verify the UI, run `npm run dev:vite` and open `http://127.0.0.1:5173/` in a browser — this serves the full app (Electron just wraps that same URL).
- This is a frontend-only project: all data comes from `src/mockData.ts` (a single hardcoded `ComparisonResult`); there is no backend to run. Action callbacks in `src/App.tsx` (`onResolve`, `onIgnore`, `onResolveAll`) only mutate local state.
