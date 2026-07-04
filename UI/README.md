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

The **Simulator** tab's job is to put a **real, separate, fully-interactive** Simulator.app / Android Emulator window on your screen — not a picture of one — by shelling out to the real platform tooling from the Electron **main** process (`electron/deviceBridge.cjs`), via a narrow `contextBridge` API (`electron/preload.cjs`, `window.deviceBridge`). This only works inside the Electron shell:

```bash
npm run dev        # not `npm run dev:vite` — the browser has no child_process access
```

**iOS Simulator (macOS only):**
- Requires Xcode + the Command Line Tools (`xcode-select --install`) and at least one Simulator runtime installed via Xcode ▸ Settings ▸ Platforms.
- The Simulator tab lists available simulators (`xcrun simctl list devices available --json`). **"Open Simulator"** runs `xcrun simctl boot <udid>` then `open -a Simulator` (with a couple of fallback strategies) — this is what actually raises the native Simulator.app window. The panel reports plainly whether that succeeded; if it didn't, there's a retry button and the exact error (e.g. Xcode not installed).
- **"Run Sample Login App"** is the one-click path: it boots the simulator if needed, builds `../sample-ios/` if it hasn't been built yet (slow — a real Xcode build, shown as an explicit "building…" status — subsequent runs skip straight to install+launch), then installs and launches it. This is the same project `sample-ios/run.sh` builds standalone; use **Rebuild** after changing `sample-ios/Sources/*.swift`.
- "Install .app…" + a bundle ID + "Launch" are the manual, lower-level equivalent — point them at any built `.app` (not just the sample one) and its bundle ID.
- An optional **"Mirror this device's screen in-panel"** checkbox polls `xcrun simctl io <udid> screenshot` (~1 fps) into a read-only `<img>` inside the app — off by default, since it's a convenience preview, not the real thing. Use the actual Simulator.app window for anything interactive.

**Android emulator (Linux / macOS / Windows):**
- Requires the Android SDK (`emulator`, `platform-tools`) — auto-detected from `$ANDROID_HOME`/`$ANDROID_SDK_ROOT`, or the default install locations (`~/Library/Android/sdk` on macOS, `~/Android/Sdk` on Linux), or `PATH`. Create at least one AVD in Android Studio's Device Manager (or `avdmanager create avd ...`).
- Hardware virtualization (KVM on Linux, HAXM/HVF elsewhere) is required for a usable boot time — it will technically boot without it, just very slowly.
- **"Launch Emulator"** spawns the real `emulator -avd <name>` process with its normal GUI (never `-no-window`), so a real emulator window opens on your desktop; a status banner confirms the launch (first boot takes 30–90s). If the `emulator` binary genuinely can't be found or the AVD is invalid, that now surfaces as a real error instead of silently doing nothing.
- "Install .apk…" + a package name + "Launch" drive `adb install` / `adb shell monkey -p <pkg> ...`.
- Same optional, off-by-default **screen mirror** as iOS, via `adb exec-out screencap -p` (~1 fps).

**What this does *not* do:** it doesn't compile the pasted Swift/Dart snippet into a real app — that needs an actual Xcode/Gradle project (see `sample-ios/`, `sample-android/` at the repo root) built via `xcodebuild`/`./gradlew`, which is the engine's job per `docs/03-architecture.md`. This tab is the reusable "control a real device" plumbing that a future build step can install its output into; today it launches the real simulator/emulator and lets you manually install/launch an app you've built yourself.
