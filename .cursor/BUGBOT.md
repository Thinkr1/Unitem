# Unitem — Bugbot Review Rules

## Scope

Applies to PRs touching `engine/`, `sample-ios/`, `sample-android/`,
`conventions/`, or `UI/`.

## Must pass

- Any change to `sample-ios/**` or `sample-android/**` must compile.
- Propagate/flag fixes must only touch files in the mapped screen pair (`mapping.json`).
- Generated diffs must be minimal — one atomic change per ticket, no drive-by refactors.
- `tickets.json` output must validate against the schema in `ARCHITECTURE.md` §7
  (`verdict`, `reason`, `confidence`, `convention_refs` required; `proposed_fix` null for hold).
- Agent responses must pass strict JSON schema validation (pydantic); invalid → flag/low-confidence.

## Reject or flag

- Diffs that change platform-native controls during a **hold** scenario
  (e.g. replacing Material Switch with an iOS-style toggle on Android).
- Hardcoded hex colors not using the shared design token.
- Changes outside the mapped Login screen files during the hackathon demo scope.
- Missing `convention_refs` on classifier output.
- Auto-propagating changes with confidence below 0.7 without human accept.

## UI contract

- Do not break the `UI/src/types.ts` seam. New fields must be **optional/additive**
  (a finding without `verdict` renders as today's card).

## Security

- No API keys, tokens, or secrets in sample apps or generated code.
- No `eval`, `exec`, or unsafe deserialization in `engine/`.
