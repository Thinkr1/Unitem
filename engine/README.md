# unitem engine

The backend: judges every iOS↔Android design difference as **propagate / hold / flag**.
Spec: [`../ARCHITECTURE.md`](../ARCHITECTURE.md). UI contract: §7 + [`../UI/ARCHITECTURE-ALIGNMENT.md`](../UI/ARCHITECTURE-ALIGNMENT.md).

## Setup

```bash
python3 -m venv ~/.venvs/unitem            # (--without-pip + get-pip.py if pip is missing)
~/.venvs/unitem/bin/pip install -e engine pytest httpx
```

## Run (from the repo root)

```bash
# offline walking skeleton (seeded changes + recorded verdicts):
unitem diff --runner mock --changes-file examples/changes/login-changes.json

# the real thing — detect changes on the sample apps:
python3 scripts/demo_edits.py 1     # propagate: brand color changes on iOS
python3 scripts/demo_edits.py 2     # hold: iOS toggle restyled natively
unitem diff --runner mock           # (scenario 3's drift is pre-seeded, found by cross-check)

# serve the /UI review console API:
unitem serve                        # FastAPI on :8787
#   GET  /comparison?screen=login
#   POST /findings/{id}/accept      -> applies fix; propagate opens PR
#   POST /findings/{id}/override    {verdict, note?} -> overrides.jsonl

python3 scripts/demo_edits.py reset # put the sample apps back

# tests (the e2e mock test is the CI gate):
cd engine && pytest -q
```

## Runners

- `mock` (default) — replays `examples/fixtures/judge/*.json`; fully offline; the stage fallback.
- `cursor` — shells out to `cursor-agent -p --output-format json` (needs `cursor-agent login`
  with the team subscription). Add `--record` to save real responses as fixtures.

## Layout

```
unitem/schema.py      every data shape (pydantic) — single source of truth
unitem/extractors.py  regex Swift/Kotlin design-fact extraction (tree-sitter = future upgrade)
unitem/discovery.py   walk both trees -> facts
unitem/mapping.py     screen pairing (stem + shared copy), mapping.overrides.yaml
unitem/diffing.py     git diff -> atomic changes + cross-platform drift check
unitem/judge.py       rule retrieval, prompt build, classifier fan-out, WCAG checks
unitem/generate.py    fix generation (Style Dictionary token path / substitution), PR flow
unitem/aggregate.py   stable UNI-NNN ids, dedupe, ordering
unitem/api.py         FastAPI for /UI (adapter emits UI/src/types.ts names)
unitem/cli.py         unitem diff | audit | serve
```
