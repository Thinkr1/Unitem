"""Screen mapping: pair iOS and Android screen files by stem + shared copy.

Human corrections in mapping.overrides.yaml always win. An LLM reconciliation
pass for ambiguous pairs is future work — the heuristics settle small apps.
"""
from __future__ import annotations

import re
from collections import defaultdict
from pathlib import Path

import yaml

from .config import Config
from .extractors import DesignFact
from .schema import Mapping, ScreenMapping

_STEM_SUFFIXES = re.compile(r"(view|screen|fragment|activity|page|composable)$", re.IGNORECASE)


def normalize_stem(file: str) -> str:
    stem = Path(file).stem
    stem = re.sub(r"[_\-]", "", stem).lower()
    return _STEM_SUFFIXES.sub("", stem)


def _screen_files(facts: list[DesignFact]) -> dict[str, list[DesignFact]]:
    """Screen files carry UI, not just design constants.

    A file is a screen if it defines at least one component OR renders any UI
    copy (Text/Button labels). Keying off components alone was too brittle: an
    agent-regenerated screen (e.g. after a transfer) may use widgets outside the
    extractor's component list (TextFormField, FilledButton, …) and would then
    be silently dropped from the mapping. Theme/token files have neither
    components nor copy, so they stay excluded.
    """
    by_file: dict[str, list[DesignFact]] = defaultdict(list)
    for fact in facts:
        by_file[fact.file].append(fact)
    return {
        file: file_facts
        for file, file_facts in by_file.items()
        if any(f.kind in ("component", "copy") for f in file_facts)
    }


def _copy_set(facts: list[DesignFact]) -> set[str]:
    return {f.value for f in facts if f.kind == "copy"}


def build_mapping(
    cfg: Config,
    ios_facts: list[DesignFact],
    android_facts: list[DesignFact],
) -> Mapping:
    ios_screens = _screen_files(ios_facts)
    android_screens = _screen_files(android_facts)

    screens: list[ScreenMapping] = []
    matched_android: set[str] = set()

    for ios_file, ios_file_facts in sorted(ios_screens.items()):
        stem = normalize_stem(ios_file)
        best: tuple[float, str] | None = None
        for android_file, android_file_facts in android_screens.items():
            if android_file in matched_android:
                continue
            score = 0.0
            if normalize_stem(android_file) == stem:
                score += 0.7
            shared = _copy_set(ios_file_facts) & _copy_set(android_file_facts)
            score += min(0.3, 0.1 * len(shared))
            if score > 0.3 and (best is None or score > best[0]):
                best = (score, android_file)
        if best:
            matched_android.add(best[1])
            screens.append(
                ScreenMapping(
                    feature=stem,
                    ios=[ios_file],
                    android=[best[1]],
                    confidence=round(min(1.0, best[0]), 2),
                )
            )
        else:
            screens.append(
                ScreenMapping(feature=stem, ios=[ios_file], android=[], one_sided=True)
            )

    for android_file in sorted(set(android_screens) - matched_android):
        screens.append(
            ScreenMapping(
                feature=normalize_stem(android_file),
                ios=[],
                android=[android_file],
                one_sided=True,
            )
        )

    return _apply_overrides(cfg, Mapping(screens=screens))


def _apply_overrides(cfg: Config, mapping: Mapping) -> Mapping:
    overrides_path = cfg.root / "mapping.overrides.yaml"
    if not overrides_path.is_file():
        return mapping
    data = yaml.safe_load(overrides_path.read_text(encoding="utf-8")) or {}
    by_feature = {s.feature: s for s in mapping.screens}
    for entry in data.get("screens", []):
        screen = ScreenMapping.model_validate({**entry, "status": "overridden"})
        by_feature[screen.feature] = screen
    return Mapping(screens=list(by_feature.values()))


def counterpart_file(mapping: Mapping, file: str) -> str | None:
    for screen in mapping.screens:
        if file in screen.ios and screen.android:
            return screen.android[0]
        if file in screen.android and screen.ios:
            return screen.ios[0]
    return None
