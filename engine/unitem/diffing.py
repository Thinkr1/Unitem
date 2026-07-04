"""Change detection: git diff → atomic changes, plus a cross-platform check.

Three deterministic detectors:
1. token deltas   — a token definition's value changed between base_ref and
                    the working tree (scenario 1: propagate).
2. style deltas   — style-modifier lines added around a component
                    (scenario 2: hold).
3. cross-check    — standing drift on mapped screen pairs: inline literals
                    that bypass the token set (scenario 3: flag). Runs every
                    diff, so judging a change also surfaces nearby drift.
"""
from __future__ import annotations

import difflib
import re
import subprocess
from pathlib import Path

from .config import Config
from .discovery import discover, find_token_def, token_values
from .extractors import DesignFact, extract_text
from .mapping import build_mapping, counterpart_file
from .schema import AtomicChange, Category, Location, Mapping, Platform

_STYLE_MODIFIER = re.compile(
    r"\.toggleStyle\(|\.tint\(|\.buttonStyle\(|\.pickerStyle\(|\.listStyle\("
    r"|elevation\s*=|colors\s*=\s*SwitchDefaults|ripple"
)
_COMPONENT_COUNTERPARTS = {
    "Toggle": "Switch",
    "Switch": "Toggle",
    "TextField": "OutlinedTextField",
    "SecureField": "OutlinedTextField",
    "OutlinedTextField": "TextField",
    "Button": "Button",
    "DatePicker": "DatePicker",
    "Picker": "DatePicker",
}


def _git(cfg: Config, *args: str) -> str:
    proc = subprocess.run(
        ["git", "-C", str(cfg.root), *args], capture_output=True, text=True
    )
    return proc.stdout if proc.returncode == 0 else ""


def _snippet(text: str, line: int, width: int = 2) -> str:
    lines = text.splitlines()
    lo, hi = max(0, line - 1 - width), min(len(lines), line + width)
    return "\n".join(lines[lo:hi])


def _platform_of(cfg: Config, file: str) -> Platform | None:
    path = cfg.root / file
    if path.is_relative_to(cfg.ios_root):
        return "ios"
    if path.is_relative_to(cfg.android_root):
        return "android"
    return None


def _category_for_token(name: str, value: str) -> tuple[Category, str]:
    """-> (category, token group prefix)."""
    if value.startswith("#"):
        return "color", "color"
    lowered = name.lower()
    if any(word in lowered for word in ("font", "heading", "body", "text")):
        return "typography", "font"
    return "spacing", "size"


# ── detector 1: token deltas ─────────────────────────────────────────────────


def _token_deltas(
    cfg: Config,
    file: str,
    platform: Platform,
    before: list[DesignFact],
    after: list[DesignFact],
    after_text: str,
    other_facts: list[DesignFact],
) -> list[AtomicChange]:
    before_defs = {f.name: f for f in before if f.kind == "token_def" and f.name}
    changes = []
    for fact in after:
        if fact.kind != "token_def" or not fact.name:
            continue
        old = before_defs.get(fact.name)
        if old is None or old.value == fact.value:
            continue
        category, group = _category_for_token(fact.name, fact.value)
        counterpart = find_token_def(other_facts, fact.name)
        changes.append(
            AtomicChange(
                kind="token",
                category=category,
                name=f"{group}.{fact.name}",
                before=old.value,
                after=fact.value,
                origin_platform=platform,
                location=Location(file=file, line=fact.line),
                counterpart_location=(
                    Location(file=counterpart.file, line=counterpart.line)
                    if counterpart
                    else None
                ),
                snippet=_snippet(after_text, fact.line),
            )
        )
    return changes


# ── detector 2: component style deltas ───────────────────────────────────────


def _style_deltas(
    cfg: Config,
    file: str,
    platform: Platform,
    before_text: str,
    after_text: str,
    after_facts: list[DesignFact],
    mapping: Mapping,
    all_facts: dict[Platform, list[DesignFact]],
) -> list[AtomicChange]:
    added_lines: list[tuple[int, str]] = []
    line_no = 0
    for token in difflib.ndiff(before_text.splitlines(), after_text.splitlines()):
        if token.startswith(("+", " ")):
            line_no += 1
        if token.startswith("+") and _STYLE_MODIFIER.search(token):
            added_lines.append((line_no, token[2:].strip()))
    if not added_lines:
        return []

    components = [f for f in after_facts if f.kind == "component"]
    by_component: dict[int, list[str]] = {}
    for added_line, text in added_lines:
        candidates = [c for c in components if 0 <= added_line - c.line <= 4]
        if not candidates:
            continue
        nearest = max(candidates, key=lambda c: c.line)
        by_component.setdefault(nearest.line, []).append(text)

    other: Platform = "android" if platform == "ios" else "ios"
    counter_file = counterpart_file(mapping, file)
    changes = []
    for comp_line, modifiers in sorted(by_component.items()):
        component = next(c for c in components if c.line == comp_line)
        counter_loc = None
        if counter_file:
            wanted = _COMPONENT_COUNTERPARTS.get(component.value)
            match = next(
                (
                    f
                    for f in all_facts[other]
                    if f.file == counter_file and f.kind == "component" and f.value == wanted
                ),
                None,
            )
            if match:
                counter_loc = Location(file=match.file, line=match.line)
        feature = next(
            (s.feature for s in mapping.screens if file in s.ios or file in s.android),
            "screen",
        )
        changes.append(
            AtomicChange(
                kind="component",
                category="component",
                name=f"component.{feature}.{component.value.lower()}",
                before=f"{component.value} (default style)",
                after=f"{component.value} with {'; '.join(modifiers)}",
                origin_platform=platform,
                location=Location(file=file, line=component.line),
                counterpart_location=counter_loc,
                snippet=_snippet(after_text, component.line, width=3),
            )
        )
    return changes


# ── detector 3: cross-platform hardcoded/stale literals ─────────────────────


def _copy_near(facts: list[DesignFact], file: str, line: int) -> str | None:
    """Nearest copy string in the same file (Dart styles span multiple lines)."""
    best: tuple[int, str] | None = None
    for fact in facts:
        if fact.kind == "copy" and fact.file == file:
            distance = abs(fact.line - line)
            if distance <= 3 and (best is None or distance < best[0]):
                best = (distance, fact.value)
    return best[1] if best else None


def _cross_check(
    cfg: Config, mapping: Mapping, all_facts: dict[Platform, list[DesignFact]]
) -> list[AtomicChange]:
    changes = []
    for platform in ("ios", "android"):
        platform_facts = all_facts[platform]  # type: ignore[index]
        known_values = set(token_values(platform_facts).values())
        other: Platform = "android" if platform == "ios" else "ios"
        for fact in platform_facts:
            if fact.kind != "color" or fact.value in known_values:
                continue
            if counterpart_file(mapping, fact.file) is None:
                continue  # only mapped screens are in scope
            copy_text = _copy_near(platform_facts, fact.file, fact.line)
            counter_loc = None
            if copy_text:
                match = next(
                    (
                        f
                        for f in all_facts[other]
                        if f.kind == "copy" and f.value == copy_text
                    ),
                    None,
                )
                if match:
                    counter_loc = Location(file=match.file, line=match.line)
            element = f" on \"{copy_text}\"" if copy_text else ""
            source_text = (cfg.root / fact.file).read_text(encoding="utf-8")
            changes.append(
                AtomicChange(
                    kind="style",
                    category="color",
                    name=f"color.hardcoded{element}",
                    before=None,
                    after=fact.value,
                    origin_platform=platform,  # type: ignore[arg-type]
                    location=Location(file=fact.file, line=fact.line),
                    counterpart_location=counter_loc,
                    snippet=_snippet(source_text, fact.line),
                )
            )
    return changes


# ── entry point ──────────────────────────────────────────────────────────────


def detect_changes(cfg: Config, base_ref: str = "HEAD") -> list[AtomicChange]:
    all_facts = discover(cfg)
    mapping = build_mapping(cfg, all_facts["ios"], all_facts["android"])

    changed_files = [
        f
        for f in _git(
            cfg,
            "diff",
            "--name-only",
            base_ref,
            "--",
            str(cfg.ios_root.relative_to(cfg.root)),
            str(cfg.android_root.relative_to(cfg.root)),
        ).splitlines()
        if f.strip()
    ]

    changes: list[AtomicChange] = []
    for file in changed_files:
        platform = _platform_of(cfg, file)
        if platform is None:
            continue
        path = cfg.root / file
        after_text = path.read_text(encoding="utf-8") if path.is_file() else ""
        before_text = _git(cfg, "show", f"{base_ref}:{file}")
        before = extract_text(before_text, file, platform)
        after = extract_text(after_text, file, platform)
        other: Platform = "android" if platform == "ios" else "ios"
        changes.extend(
            _token_deltas(cfg, file, platform, before, after, after_text, all_facts[other])
        )
        changes.extend(
            _style_deltas(
                cfg, file, platform, before_text, after_text, after, mapping, all_facts
            )
        )

    changes.extend(_cross_check(cfg, mapping, all_facts))

    seen: set[str] = set()
    unique = []
    for change in changes:
        if change.id not in seen:
            seen.add(change.id)
            unique.append(change)
    return unique
