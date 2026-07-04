"""Deterministic design-fact extraction from Swift/Kotlin source (regex-first).

tree-sitter is a planned accuracy upgrade behind the same interface; regex
covers everything the demo screen contains (token defs, inline colors,
dimensions, font sizes, components, copy) and can never block on a build.
"""
from __future__ import annotations

import re
from pathlib import Path
from typing import Literal, Optional

from pydantic import BaseModel

from .schema import Platform

FactKind = Literal["token_def", "color", "dimension", "font_size", "component", "copy"]


class DesignFact(BaseModel):
    kind: FactKind
    name: Optional[str] = None  # token name for token_def; component type for component
    value: str
    file: str
    line: int
    platform: Platform


# ── Swift (SwiftUI) ──────────────────────────────────────────────────────────

_SWIFT_TOKEN_COLOR = re.compile(r'static let (\w+)\s*=\s*Color\(hex:\s*"(#[0-9A-Fa-f]{6})"\)')
_SWIFT_TOKEN_NUM = re.compile(r"static let (\w+):\s*CGFloat\s*=\s*([\d.]+)")
_SWIFT_INLINE_COLOR = re.compile(r'Color\(hex:\s*"(#[0-9A-Fa-f]{6})"\)')
_SWIFT_FONT_SIZE = re.compile(r"\.(?:system|custom)\((?:\"[^\"]+\",\s*)?size:\s*([\d.]+)")
_SWIFT_DIMENSION = re.compile(
    r"\.padding\((?:\.\w+,\s*)?([\d.]+)\)|frame\(height:\s*([\d.]+)\)|\.cornerRadius\(([\d.]+)\)"
)
_SWIFT_COMPONENT = re.compile(
    r"\b(Toggle|Button|TextField|SecureField|Picker|DatePicker|Slider|TabView|NavigationStack)\("
)
_SWIFT_COPY = re.compile(r'(?:Text|Button|TextField|SecureField)\("([^"]+)"')

# ── Kotlin (Compose) ─────────────────────────────────────────────────────────

_KT_TOKEN_COLOR = re.compile(r"val (\w+)\s*=\s*Color\(0x[Ff]{2}([0-9A-Fa-f]{6})\)")
_KT_INLINE_COLOR = re.compile(r"Color\(0x[Ff]{2}([0-9A-Fa-f]{6})\)")
_KT_FONT_SIZE = re.compile(r"fontSize\s*=\s*([\d.]+)\.sp")
_KT_DIMENSION = re.compile(r"([\d.]+)\.dp")
_KT_COMPONENT = re.compile(
    r"\b(Switch|Button|OutlinedTextField|TextField|Checkbox|Slider|DatePicker|NavigationBar|Scaffold)\("
)
_KT_COPY = re.compile(r'Text\(\s*(?:text\s*=\s*)?"([^"]+)"')


def _num(*groups: str | None) -> str:
    value = next(g for g in groups if g)
    return value.rstrip("0").rstrip(".") if "." in value else value


def extract_text(text: str, file: str, platform: Platform) -> list[DesignFact]:
    facts: list[DesignFact] = []
    swift = platform == "ios"

    def add(kind: FactKind, value: str, line: int, name: str | None = None) -> None:
        facts.append(
            DesignFact(kind=kind, name=name, value=value, file=file, line=line, platform=platform)
        )

    for line_no, line in enumerate(text.splitlines(), start=1):
        token = (_SWIFT_TOKEN_COLOR if swift else _KT_TOKEN_COLOR).search(line)
        if token:
            add("token_def", "#" + token.group(2).lstrip("#").upper(), line_no, token.group(1))
            continue  # a token def line is not also an inline color
        if swift:
            num_token = _SWIFT_TOKEN_NUM.search(line)
            if num_token:
                add("token_def", _num(num_token.group(2)), line_no, num_token.group(1))
                continue
        for match in (_SWIFT_INLINE_COLOR if swift else _KT_INLINE_COLOR).finditer(line):
            add("color", "#" + match.group(1).lstrip("#").upper(), line_no)
        for match in (_SWIFT_FONT_SIZE if swift else _KT_FONT_SIZE).finditer(line):
            add("font_size", _num(match.group(1)), line_no)
        for match in (_SWIFT_DIMENSION if swift else _KT_DIMENSION).finditer(line):
            add("dimension", _num(*match.groups()), line_no)
        for match in (_SWIFT_COMPONENT if swift else _KT_COMPONENT).finditer(line):
            add("component", match.group(1), line_no, match.group(1))
        for match in (_SWIFT_COPY if swift else _KT_COPY).finditer(line):
            add("copy", match.group(1), line_no)
    return facts


def extract_file(path: Path, platform: Platform, rel_to: Path | None = None) -> list[DesignFact]:
    file = str(path.relative_to(rel_to)) if rel_to else str(path)
    return extract_text(path.read_text(encoding="utf-8"), file, platform)
