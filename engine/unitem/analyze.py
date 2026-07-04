"""Audit two pasted code snippets (the /UI paste flow — no git, no files).

Deterministic pairing strategies, in order:
1. token-def mismatches       — same token name, different value
2. copy anchors               — same visible text on both sides -> compare the
                                color/font-size/dimension facts on those lines
3. component-pair blocks      — counterpart components (Button<->ElevatedButton,
                                Toggle<->Switch) -> compare facts in their block
4. toggle idiom               — iOS Toggle + Material Switch -> a hold candidate
5. label mismatch             — paired primary controls with different copy

Each difference becomes an AtomicChange; the judge (LLM) decides
propagate / hold / flag exactly as in diff mode.
"""
from __future__ import annotations

import re

from .extractors import DesignFact, extract_text
from .schema import AtomicChange, Category, Location, Platform

_IOS_FILE = "pasted/LoginView.swift"

_FACT_CATEGORY: dict[str, Category] = {
    "color": "color",
    "font_size": "typography",
    "dimension": "spacing",
}

_BUTTON_TYPES = {"ios": ["Button"], "android": ["ElevatedButton", "Button", "TextButton"]}
_TOGGLE_TYPES = {"ios": ["Toggle", "CupertinoSwitch"], "android": ["Switch"]}


def detect_android_language(code: str) -> str:
    if "package:flutter" in code or re.search(r"\bStatelessWidget\b|\bStatefulWidget\b", code):
        return "dart"
    return "kotlin"


def android_file_for(code: str) -> str:
    return f"pasted/login_screen.{'dart' if detect_android_language(code) == 'dart' else 'kt'}"


def _slug(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")[:30]


def _near(facts: list[DesignFact], line: int, kind: str, width: int = 3) -> DesignFact | None:
    candidates = [f for f in facts if f.kind == kind and abs(f.line - line) <= width]
    return min(candidates, key=lambda f: abs(f.line - line)) if candidates else None


def _in_block(facts: list[DesignFact], start: int, kind: str, span: int = 8) -> DesignFact | None:
    return next((f for f in facts if f.kind == kind and start <= f.line <= start + span), None)


def _first_component(facts: list[DesignFact], types: list[str]) -> DesignFact | None:
    return next((f for f in facts if f.kind == "component" and f.value in types), None)


def _change(
    category: Category,
    name: str,
    ios_fact: DesignFact,
    android_fact: DesignFact,
    ios_code: str,
    kind: str = "style",
) -> AtomicChange:
    """A cross-platform difference, framed with iOS as the reference side."""
    return AtomicChange(
        kind=kind,  # type: ignore[arg-type]
        category=category,
        name=name,
        before=android_fact.value,
        after=ios_fact.value,
        origin_platform="ios",
        location=Location(file=ios_fact.file, line=ios_fact.line),
        counterpart_location=Location(file=android_fact.file, line=android_fact.line),
        snippet=_snippet(ios_code, ios_fact.line),
    )


def _snippet(code: str, line: int, width: int = 2) -> str:
    lines = code.splitlines()
    lo, hi = max(0, line - 1 - width), min(len(lines), line + width)
    return "\n".join(lines[lo:hi])


def analyze_pair(ios_code: str, android_code: str) -> list[AtomicChange]:
    android_file = android_file_for(android_code)
    ios = extract_text(ios_code, _IOS_FILE, "ios")
    android = extract_text(android_code, android_file, "android")
    changes: list[AtomicChange] = []

    # 1. token-def mismatches
    ios_defs = {f.name.lower(): f for f in ios if f.kind == "token_def" and f.name}
    for fact in android:
        if fact.kind != "token_def" or not fact.name:
            continue
        ios_def = ios_defs.get(fact.name.lower())
        if ios_def and ios_def.value != fact.value:
            category = "color" if ios_def.value.startswith("#") else "spacing"
            changes.append(
                _change(category, f"token.{fact.name}", ios_def, fact, ios_code, kind="token")
            )

    # 2. copy anchors — same text on both sides
    android_copy = {f.value: f for f in android if f.kind == "copy"}
    for ios_copy in (f for f in ios if f.kind == "copy"):
        anchor = android_copy.get(ios_copy.value)
        if anchor is None:
            continue
        for fact_kind, category in _FACT_CATEGORY.items():
            ios_fact = _near(ios, ios_copy.line, fact_kind)
            android_fact = _near(android, anchor.line, fact_kind)
            if ios_fact and android_fact and ios_fact.value != android_fact.value:
                changes.append(
                    _change(
                        category,
                        f"{category}.{_slug(ios_copy.value)}",
                        ios_fact,
                        android_fact,
                        ios_code,
                    )
                )

    # 3. primary-button block comparison
    ios_button = _first_component(ios, _BUTTON_TYPES["ios"])
    android_button = _first_component(android, _BUTTON_TYPES["android"])
    if ios_button and android_button:
        for fact_kind, category in _FACT_CATEGORY.items():
            ios_fact = _in_block(ios, ios_button.line, fact_kind)
            android_fact = _in_block(android, android_button.line, fact_kind)
            if ios_fact and android_fact and ios_fact.value != android_fact.value:
                name = f"{category}.primary-button"
                if not any(c.name == name for c in changes):
                    changes.append(_change(category, name, ios_fact, android_fact, ios_code))

        # 5. label mismatch on the paired primary control
        ios_label = _in_block(ios, ios_button.line, "copy", span=12)
        android_label = _in_block(android, android_button.line, "copy", span=12)
        if ios_label and android_label and ios_label.value != android_label.value:
            changes.append(
                _change("content", "copy.primary-button-label", ios_label, android_label, ios_code, kind="copy")
            )

    # 4. toggle idiom (iOS native control vs Material Switch)
    ios_toggle = _first_component(ios, _TOGGLE_TYPES["ios"])
    android_toggle = _first_component(android, _TOGGLE_TYPES["android"])
    if ios_toggle and android_toggle:
        changes.append(
            AtomicChange(
                kind="component",
                category="component",
                name="component.toggle-idiom",
                before=f"Android uses Material {android_toggle.value}",
                after=f"iOS uses native {ios_toggle.value}",
                origin_platform="ios",
                location=Location(file=ios_toggle.file, line=ios_toggle.line),
                counterpart_location=Location(
                    file=android_toggle.file, line=android_toggle.line
                ),
                snippet=_snippet(ios_code, ios_toggle.line),
            )
        )

    # dedupe by id
    seen: set[str] = set()
    unique = []
    for change in changes:
        if change.id not in seen:
            seen.add(change.id)
            unique.append(change)
    return unique
