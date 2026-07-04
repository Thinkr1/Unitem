"""Deterministic design-fact extraction from Swift/Kotlin/Dart source (regex-first).

Language is chosen by file extension, so the Android side can be native
Kotlin/Compose or Flutter/Dart — the judge layer never knows the difference.
tree-sitter is a planned accuracy upgrade behind the same interface.
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path
from typing import Literal, Optional

from pydantic import BaseModel

from .schema import Platform

FactKind = Literal["token_def", "color", "dimension", "font_size", "component", "copy"]
Language = Literal["swift", "kotlin", "dart"]


class DesignFact(BaseModel):
    kind: FactKind
    name: Optional[str] = None  # token name for token_def; component type for component
    value: str
    file: str
    line: int
    platform: Platform


@dataclass
class _Lang:
    token_color: re.Pattern
    inline_color: re.Pattern
    font_size: re.Pattern
    dimension: re.Pattern
    component: re.Pattern
    copy: re.Pattern
    token_number: Optional[re.Pattern] = None


_LANGS: dict[Language, _Lang] = {
    "swift": _Lang(
        token_color=re.compile(r'static let (\w+)\s*=\s*Color\(hex:\s*"(#[0-9A-Fa-f]{6})"\)'),
        token_number=re.compile(r"static let (\w+):\s*CGFloat\s*=\s*([\d.]+)"),
        inline_color=re.compile(r'Color\(hex:\s*"(#[0-9A-Fa-f]{6})"\)'),
        font_size=re.compile(r"\.(?:system|custom)\((?:\"[^\"]+\",\s*)?size:\s*([\d.]+)"),
        dimension=re.compile(
            r"\.padding\((?:\.\w+,\s*)?([\d.]+)\)|frame\(height:\s*([\d.]+)\)|\.cornerRadius\(([\d.]+)\)"
        ),
        component=re.compile(
            r"\b(Toggle|Button|TextField|SecureField|Picker|DatePicker|Slider|TabView|NavigationStack)\("
        ),
        copy=re.compile(r'(?:Text|Button|TextField|SecureField)\("([^"]+)"'),
    ),
    "kotlin": _Lang(
        token_color=re.compile(r"val (\w+)\s*=\s*Color\(0x[Ff]{2}([0-9A-Fa-f]{6})\)"),
        inline_color=re.compile(r"Color\(0x[Ff]{2}([0-9A-Fa-f]{6})\)"),
        font_size=re.compile(r"fontSize\s*=\s*([\d.]+)\.sp"),
        dimension=re.compile(r"([\d.]+)\.dp"),
        component=re.compile(
            r"\b(Switch|Button|OutlinedTextField|TextField|Checkbox|Slider|DatePicker|NavigationBar|Scaffold)\("
        ),
        copy=re.compile(r'Text\(\s*(?:text\s*=\s*)?"([^"]+)"'),
    ),
    "dart": _Lang(
        token_color=re.compile(
            r"(?:static\s+)?const\s+(?:Color\s+)?(\w+)\s*=\s*Color\(0x[Ff]{2}([0-9A-Fa-f]{6})\)"
        ),
        token_number=re.compile(r"static const double (\w+)\s*=\s*([\d.]+)"),
        inline_color=re.compile(r"Color\(0x[Ff]{2}([0-9A-Fa-f]{6})\)"),
        font_size=re.compile(r"fontSize:\s*([\d.]+)"),
        dimension=re.compile(
            r"(?:height|width):\s*([\d.]+)"
            r"|BorderRadius\.circular\(([\d.]+)\)"
            r"|EdgeInsets\.symmetric\(\s*(?:horizontal|vertical):\s*([\d.]+)"
        ),
        component=re.compile(
            r"\b(Switch|CupertinoSwitch|ElevatedButton|OutlinedButton|TextButton|TextField"
            r"|CupertinoTextField|Checkbox|Slider|Scaffold|AppBar|BottomNavigationBar)\("
        ),
        # Text('...') inline, or a lone quoted string line inside a multi-line Text(
        copy=re.compile(r"Text\(\s*['\"]([^'\"]+)['\"]|^\s*['\"]([^'\"]+)['\"],\s*$"),
    ),
}

_SUFFIX_TO_LANG: dict[str, Language] = {".swift": "swift", ".kt": "kotlin", ".dart": "dart"}


def language_of(file: str, platform: Platform) -> Language:
    lang = _SUFFIX_TO_LANG.get(Path(file).suffix)
    if lang:
        return lang
    return "swift" if platform == "ios" else "kotlin"


def _num(*groups: str | None) -> str:
    value = next(g for g in groups if g)
    return value.rstrip("0").rstrip(".") if "." in value else value


def extract_text(text: str, file: str, platform: Platform) -> list[DesignFact]:
    lang = _LANGS[language_of(file, platform)]
    facts: list[DesignFact] = []

    def add(kind: FactKind, value: str, line: int, name: str | None = None) -> None:
        facts.append(
            DesignFact(kind=kind, name=name, value=value, file=file, line=line, platform=platform)
        )

    for line_no, line in enumerate(text.splitlines(), start=1):
        token = lang.token_color.search(line)
        if token:
            add("token_def", "#" + token.group(2).lstrip("#").upper(), line_no, token.group(1))
            continue  # a token def line is not also an inline color
        if lang.token_number:
            num_token = lang.token_number.search(line)
            if num_token:
                add("token_def", _num(num_token.group(2)), line_no, num_token.group(1))
                continue
        for match in lang.inline_color.finditer(line):
            add("color", "#" + match.group(1).lstrip("#").upper(), line_no)
        for match in lang.font_size.finditer(line):
            add("font_size", _num(match.group(1)), line_no)
        for match in lang.dimension.finditer(line):
            add("dimension", _num(*match.groups()), line_no)
        for match in lang.component.finditer(line):
            add("component", match.group(1), line_no, match.group(1))
        for match in lang.copy.finditer(line):
            add("copy", next(g for g in match.groups() if g), line_no)
    return facts


def extract_file(path: Path, platform: Platform, rel_to: Path | None = None) -> list[DesignFact]:
    file = str(path.relative_to(rel_to)) if rel_to else str(path)
    return extract_text(path.read_text(encoding="utf-8"), file, platform)
