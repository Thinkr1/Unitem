"""Mapping generation: correspond iOS screens to Android screens automatically.

Manual mapping across large apps is infeasible, so we generate ``mapping.json``
automatically. Correspondence uses a blend of deterministic signals:

* normalized feature-name similarity (SettingsView ~ SettingsScreen)
* shared localized string keys
* shared route identifiers

An optional Cursor agent reconciliation pass can refine low-confidence or
leftover screens. Results are always overridable via ``mapping.overrides.yaml``.
"""

from __future__ import annotations

import difflib
import json
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import yaml

from .config import UnitemConfig
from .schema import Inventory, Mapping, MappingEntry, ScreenDescriptor


def _name_similarity(a: str, b: str) -> float:
    return difflib.SequenceMatcher(None, a.lower(), b.lower()).ratio()


def _set_overlap(a: List[str], b: List[str]) -> float:
    sa, sb = set(a), set(b)
    if not sa or not sb:
        return 0.0
    return len(sa & sb) / len(sa | sb)


def score_pair(ios: ScreenDescriptor, android: ScreenDescriptor) -> float:
    """Weighted confidence that two screens are the same feature."""

    name = _name_similarity(ios.name, android.name)
    keys = _set_overlap(ios.string_keys, android.string_keys)
    routes = _set_overlap(ios.routes, android.routes)
    # Name dominates; shared keys/routes provide corroboration.
    score = 0.6 * name + 0.3 * keys + 0.1 * routes
    return round(score, 4)


def generate_mapping(inventory: Inventory, cfg: UnitemConfig) -> Mapping:
    ios = inventory.ios_screens
    android = inventory.android_screens

    # Greedy best-match assignment over the full score matrix.
    pairs: List[Tuple[float, int, int]] = []
    for i, s_ios in enumerate(ios):
        for j, s_and in enumerate(android):
            pairs.append((score_pair(s_ios, s_and), i, j))
    pairs.sort(reverse=True)

    used_ios: set[int] = set()
    used_android: set[int] = set()
    entries: List[MappingEntry] = []

    for score, i, j in pairs:
        if i in used_ios or j in used_android:
            continue
        if score < cfg.min_mapping_confidence:
            continue
        used_ios.add(i)
        used_android.add(j)
        entries.append(
            MappingEntry(
                feature=ios[i].name or android[j].name,
                ios=list(ios[i].files),
                android=list(android[j].files),
                confidence=score,
                status="auto",
            )
        )

    unmatched_ios = [ios[i].name for i in range(len(ios)) if i not in used_ios]
    unmatched_android = [android[j].name for j in range(len(android)) if j not in used_android]

    entries.sort(key=lambda e: (-e.confidence, e.feature.lower()))
    return Mapping(
        entries=entries,
        unmatched_ios=unmatched_ios,
        unmatched_android=unmatched_android,
    )


def apply_overrides(mapping: Mapping, overrides_path: Optional[Path]) -> Mapping:
    """Merge human overrides on top of the auto-generated mapping.

    Override file format (YAML)::

        entries:
          - feature: Settings
            ios: [ios/Settings/SettingsView.swift]
            android: [android/settings/SettingsScreen.kt]
        ignore_features: [Debug]
    """

    if not overrides_path or not overrides_path.exists():
        return mapping

    data = yaml.safe_load(overrides_path.read_text()) or {}
    ignore = {f.lower() for f in data.get("ignore_features", [])}
    override_entries = data.get("entries", []) or []

    by_feature: Dict[str, MappingEntry] = {e.feature.lower(): e for e in mapping.entries}

    for raw in override_entries:
        entry = MappingEntry(
            feature=raw["feature"],
            ios=raw.get("ios", []),
            android=raw.get("android", []),
            confidence=raw.get("confidence", 1.0),
            status="override",
            note=raw.get("note"),
        )
        by_feature[entry.feature.lower()] = entry

    entries = [e for k, e in by_feature.items() if k not in ignore]
    entries.sort(key=lambda e: (-e.confidence, e.feature.lower()))
    return Mapping(
        entries=entries,
        unmatched_ios=[f for f in mapping.unmatched_ios if f.lower() not in ignore],
        unmatched_android=[f for f in mapping.unmatched_android if f.lower() not in ignore],
    )


def save_mapping(mapping: Mapping, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(mapping.model_dump(), indent=2))


def load_mapping(path: Path) -> Mapping:
    return Mapping(**json.loads(path.read_text()))
