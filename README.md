# Unitem

Unitem checks **UI consistency between the iOS and Android versions of an app**.

Translating features between platforms is easy; keeping spacing, layout, and
typography visually consistent *while still adopting native OS conventions* is
the hard part. Unitem reads both source trees plus a shared `agent.md` of design
principles, launches Cursor agents to review each screen pair, and produces a
list of **tickets** for every unintended inconsistency — deliberately ignoring
differences that exist to feel native on each platform.

> Scope of this tool: analysis + ticket generation. Turning a ticket into a pull
> request is a separate, downstream phase (see [Handoff](#handoff-pr-dispatch)).

## How it works

```
unitem.yaml + agent.md
        │
        ▼
   index      discover files, classify stack (SwiftUI/UIKit/ObjC,
              Compose/XML, Flutter), build a UI-screen inventory
        │
        ▼
   map        auto-generate iOS<->Android screen mapping
              (name/route/string-key similarity), overridable
        │
        ▼
   analyze    launch one Cursor agent per mapped section;
              classify each difference as inconsistency vs expected-native
        │
        ▼
   report     dedupe -> tickets.json + report.html + report.md
```

The distinction between "must be consistent" and "expected native" is driven by
`agent.md`. Only `inconsistency` findings become tickets; `expected-native`
differences (native nav chrome, system pickers, San Francisco vs Roboto, etc.)
are counted but never ticketed.

## Install

```bash
pip install -e .
```

## Configure

Create a `unitem.yaml` (see [`examples/unitem.yaml`](examples/unitem.yaml)):

```yaml
ios_path: ios
android_path: android
agent_md_path: agent.md
output_dir: .unitem
concurrency: 4
# model: composer-2
# mapping_overrides_path: mapping.overrides.yaml
```

The two codebases and `agent.md` are the only inputs.

## Run

Real analysis uses the Cursor headless CLI and needs an API key:

```bash
export CURSOR_API_KEY=...      # from Cursor Dashboard -> API Keys
unitem run -c examples/unitem.yaml
```

Or run stages individually:

```bash
unitem index    -c examples/unitem.yaml
unitem map      -c examples/unitem.yaml
unitem analyze  -c examples/unitem.yaml
unitem report   -c examples/unitem.yaml
```

### Offline / no API key

Every stage runs offline with a mock analyzer so you can exercise discovery,
mapping, aggregation, and reporting without calling Cursor:

```bash
unitem run -c examples/unitem.yaml --mock
```

## Outputs

Written to `output_dir` (default `.unitem/`):

- `inventory.json` — discovered files and screens
- `mapping.json` — iOS<->Android screen correspondence
- `findings.json` — raw per-section findings
- `tickets.json` — deduplicated tickets (the handoff contract)
- `report.html` / `report.md` — human-readable report

### Ticket schema

Each ticket: `id, feature, category, severity, title, description, rationale,
suggested_fix, platforms, locations, confidence, status`. Categories: `spacing,
layout, typography, color, component, navigation, content, accessibility,
missing-screen, other`.

## Mapping overrides

Auto-mapping is a starting point. Override or ignore features with a YAML file
referenced by `mapping_overrides_path`:

```yaml
ignore_features: [Debug]
entries:
  - feature: Settings
    ios: [ios/Settings/SettingsView.swift]
    android: [android/settings/SettingsScreen.kt]
```

## Handoff: PR dispatch

This tool stops at `tickets.json`. The downstream phase (owned separately)
consumes it and opens one PR per ticket via the Cursor Cloud Agents API. Preview
the exact payloads without sending anything:

```bash
unitem dispatch -c examples/unitem.yaml --repo-url https://github.com/org/repo
```

## Development

```bash
pip install -e ".[dev]"
pytest
```
