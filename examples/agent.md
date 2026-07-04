# Unitem — project design spec (demo)

## Principles

- Brand and semantic tokens **propagate** across iOS and Android.
- Platform-native controls and navigation **hold** — never force visual parity.
- Hardcoded values, stale tokens, off-scale spacing **flag**.

## Token rulebook (Login demo)

| Token | Value |
|-------|-------|
| color.primary | #4F46E5 |
| button.padding.vertical | 16 |
| button.cornerRadius | 12 |
| typography.heading.size | 28 |
| input.height | 52 |
| motion.duration.press | 200ms |
| copy.signIn.label | Sign In |

## Stack

- iOS: SwiftUI (`sample-ios/`)
- Android: Kotlin + Jetpack Compose (`sample-android/`) — **not Flutter/Dart**

## Demo scope

One screen: **Login**. Only files listed in `examples/mapping.json`.
