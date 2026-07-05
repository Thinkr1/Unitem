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

## Launch screen — whole-app analysis

The app always opens on a launch screen (`src/components/LaunchScreen.tsx`) — there's no single-screen "paste and go" alternative competing with it. From there you can:

- **Pick a bundled demo app** (`src/demoApps.ts`) — FitTrack (5 screens: Home, Daily Goals, Habits, Profile, Settings) or ShopEasy (3 screens: Product List, Cart, Checkout). Each is a small but real "whole app": screens share the same design tokens, so the same drift (e.g. a stale brand color) shows up on more than one screen, and the Home/Product List screens visually link out to the others.
- **Point it at your own codebase** — pick an iOS folder and an Android folder (native folder pickers via `webkitdirectory`). Files are matched into screens by name (`LoginView.swift` ↔ `login_screen.dart`, see `src/lib/codebaseScan.ts`), filtering out non-screen files (themes, models…). Each matched pair is run through the existing `/analyze` engine call; if the engine is offline the screens still load so you can browse the code side by side.

Once a whole-app codebase is loaded, the Compare page shows a file-tree sidebar (`src/components/FileBrowser.tsx`) — one folder per screen, each containing its iOS + Android source file — and Overview/Rulebook aggregate findings across every screen instead of just the one currently open. A "Codebases" button in the nav rail returns to the launch screen at any time. (You can still open a raw two-pane code editor for the *currently active* screen via "Edit code" in the nav rail — that's an in-context editing tool, not a separate entry point.)

The Android "Visual" tab (`FlutterPreview`) is keyed on the file name, so switching screens always tears down and recreates the DartPad iframe from scratch instead of reposting into a possibly-stale one — the compiled output can never lag behind a *different* file's Code tab. Editing/rescanning the same file keeps the iframe warm as before.

Loaded (demo/custom) apps never touch the engine: "Resolve"/"Transfer all" apply each finding's `proposedFix` diff to the in-memory source directly (`src/lib/applyDiff.ts`), "Reset demo" restores the screen's original definition, and "Rescan" is hidden entirely (there's no real re-analysis to run without an engine behind the screen). Engine-backed screens (the paste flow, or a real `unitem serve`) are unchanged.

### Editing with a real editor, inside the desktop app

Folders picked from the **desktop app** (`npm run dev`, not `npm run dev:vite`) go through a native dialog (`window.deviceBridge.pickFile`) and are read via `window.fileEditor.readFolder` (`electron/fileEditor.cjs`) instead of the browser's read-only `<input webkitdirectory>` — that gives every screen a real absolute path (`CodePanel.absolutePath`), which unlocks, per file, in `ScreenPanel`:

- **Open in editor** — launches VS Code if its CLI is on PATH, else the OS's default handler for that file type.
- **Save to disk** — the iOS Code tab (and any external edit) debounced-writes back to the real file.
- **Live external sync** — the file is watched on disk, so a save from VS Code (or any other editor) flows back into the app automatically, no manual reload.

None of this needs the engine running; it's pure filesystem access from the Electron main process. In the plain browser dev server, or for the bundled demo apps (which don't exist on disk), these controls are present but disabled — code stays read-only/in-memory, exactly as before.

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
