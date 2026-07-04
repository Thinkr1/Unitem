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

Each code panel has three view modes: **Visual** (drawn mockup / live DartPad render), **Simulator** (a real device — see below), and **Code**.

## Live device simulators (real iOS Simulator + Android emulator)

The **Simulator** tab streams an actual device screen — not a drawn mockup — by shelling out to the real platform tooling from the Electron **main** process (`electron/deviceBridge.cjs`), and exposing a narrow API to the renderer via `contextBridge` (`electron/preload.cjs`, `window.deviceBridge`). This only works inside the Electron shell:

```bash
npm run dev        # not `npm run dev:vite` — the browser has no child_process access
```

**iOS Simulator (macOS only):**
- Requires Xcode + the Command Line Tools (`xcode-select --install`) and at least one Simulator runtime installed via Xcode ▸ Settings ▸ Platforms.
- The Simulator tab lists available simulators (`xcrun simctl list devices available --json`), boots the selected one, and polls `xcrun simctl io <udid> screenshot` (~1 fps) to render the live screen.
- "Install .app… " + a bundle ID + "Launch" drive `xcrun simctl install` / `simctl launch`, so once you have a real, built `.app` (e.g. from `xcodebuild -scheme ... -destination 'platform=iOS Simulator,name=...'`), you can push it straight into the booted simulator.

**Android emulator (Linux / macOS / Windows):**
- Requires the Android SDK (`emulator`, `platform-tools`) on `PATH`, or `$ANDROID_HOME`/`$ANDROID_SDK_ROOT` set, plus at least one AVD created in Android Studio's Device Manager (or `avdmanager create avd ...`).
- Hardware virtualization (KVM on Linux, HAXM/HVF elsewhere) is required for a usable boot time — it will technically boot without it, just very slowly.
- The Simulator tab lists AVDs (`emulator -list-avds`), boots the selected one, waits for `sys.boot_completed`, then polls `adb exec-out screencap -p` (~1 fps).
- "Install .apk…" + a package name + "Launch" drive `adb install` / `adb shell monkey -p <pkg> ...`.

**What this does *not* do:** it doesn't compile the pasted Swift/Dart snippet into a real app — that needs an actual Xcode/Gradle project (see `sample-ios/`, `sample-android/` at the repo root) built via `xcodebuild`/`./gradlew`, which is the engine's job per `docs/03-architecture.md`. This tab is the reusable "control a real device" plumbing that a future build step can install its output into; today it's a live window onto whatever's already on the simulator/emulator, plus manual install/launch for an app you've built yourself.
