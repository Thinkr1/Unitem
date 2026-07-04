# sample-ios

A minimal, real, buildable iOS app wrapping the Unitem demo's Login screen
(`Sources/Theme.swift` + `Sources/LoginView.swift`, the actual source shown
in the UI's iOS panel), so you can see it running for real in the iOS
Simulator instead of just staring at the simulator's home screen.

`project.yml` is an [XcodeGen](https://github.com/yonaskolb/XcodeGen) spec —
the generated `.xcodeproj` isn't checked in; it's produced fresh each run.

## Prerequisites (macOS only)

```bash
xcode-select --install   # Xcode Command Line Tools, if missing
brew install xcodegen
```

Also make sure at least one Simulator runtime is installed (Xcode ▸ Settings
▸ Platforms), and that it shows up here:

```bash
xcrun simctl list devices available
```

## Run it — one command

```bash
cd sample-ios
./run.sh                # defaults to "iPhone 15"
./run.sh "iPhone 15 Pro" # or pick any available simulator name
```

This generates the Xcode project, boots the real Simulator.app window, builds
the app, installs it, and launches it — so the actual Welcome-back Login
screen ends up running live in the Simulator.

## Manual / step-by-step equivalent

If you'd rather run each step yourself (e.g. to use Xcode's GUI instead):

```bash
xcodegen generate                     # → SampleLogin.xcodeproj
open SampleLogin.xcodeproj            # then hit ⌘R in Xcode, pick a simulator
```

Or drive it entirely from the command line:

```bash
xcodegen generate
xcodebuild -project SampleLogin.xcodeproj -scheme SampleLogin \
  -sdk iphonesimulator -destination 'platform=iOS Simulator,name=iPhone 15' \
  -derivedDataPath build build

xcrun simctl boot "iPhone 15"                       # ignore "already booted"
open -a Simulator
xcrun simctl install booted \
  build/Build/Products/Debug-iphonesimulator/SampleLogin.app
xcrun simctl launch booted com.unitem.sample.login
```

## Using the Unitem app's "Simulator" tab instead

The `UI/` app's Simulator tab (see `UI/README.md`) has **Install .app…** +
**Launch** controls that do exactly the last two commands above through the
UI: after building once (`xcodegen generate && xcodebuild ...` or `./run.sh`
once to produce the `.app`), pick
`sample-ios/build/Build/Products/Debug-iphonesimulator/SampleLogin.app` in
the file picker, enter bundle ID `com.unitem.sample.login`, and click Launch.

## What this is / isn't

This is a **hand-wired sample app**, not the output of Unitem's (not-yet-built)
code-gen engine — it exists so there's something real to install and launch
in the Simulator today. `docs/03-architecture.md`'s "rebuild the screen in a
simulator" step is the future automation that would produce a `.app` like
this one automatically from a real diff.
