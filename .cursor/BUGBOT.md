# Design Diplomat — Bugbot Review Rules

## Scope

These rules apply to PRs touching `sample-ios/`, `sample-android/`, `engine/`, or `knowledge-base/`.

## Must pass

- Any change to `sample-ios/**` or `sample-android/**` must compile.
- Propagate fixes must only touch files listed in `engine/screen-map.json`.
- Generated diffs must be minimal — one atomic change per ticket, no drive-by refactors.
- Ticket JSON must include `verdict`, `reason`, `confidence`, and `convention_refs`.

## Reject or flag

- Diffs that change platform-native controls during a **hold** scenario (e.g. replacing Material Switch with iOS-style toggle on Android).
- Hardcoded hex colors not using the shared design token.
- Changes outside the mapped Settings screen files during the hackathon demo scope.
- Missing `convention_refs` on classifier output.
- Auto-propagating changes with confidence below 0.7 without human accept.

## Security

- No API keys, tokens, or secrets in sample apps or generated code.
- No `eval`, `exec`, or unsafe deserialization in `engine/`.

## Tests

- When `engine/**` changes, verify the ticket schema in `docs/03-architecture.md` is still valid.
- When propagate scenario runs, confirm Android receives the equivalent token value (not a different shade).
