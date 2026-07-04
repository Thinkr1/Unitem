"""Deterministic, cheap signal extraction from source files.

These regex-based extractors are intentionally lightweight. Their purpose is to
(a) improve automatic screen-to-screen mapping and (b) give analysis agents
concrete anchors (routes, string keys, color/spacing tokens) so they spend
budget reasoning rather than re-discovering constants.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import List

# Route / navigation destination identifiers.
_ROUTE_PATTERNS = [
    re.compile(r'NavigationLink\s*\(\s*destination:\s*(\w+)'),  # SwiftUI
    re.compile(r'\.navigationDestination\([^)]*\)\s*\{\s*(\w+)'),  # SwiftUI
    re.compile(r'composable\(\s*"([^"]+)"'),  # Jetpack Compose Navigation
    re.compile(r'route\s*=\s*"([^"]+)"'),  # Compose route constants
    re.compile(r'Navigator\.push[^;]*=>\s*(?:const\s+)?(\w+)\s*\('),  # Flutter
    re.compile(r'MaterialPageRoute[^;]*=>\s*(?:const\s+)?(\w+)\s*\('),  # Flutter
]

# Localized string keys.
_STRING_KEY_PATTERNS = [
    re.compile(r'NSLocalizedString\(\s*"([^"]+)"'),  # iOS
    re.compile(r'Text\(\s*"([^"]+)"\s*\)'),  # SwiftUI / Compose literal text
    re.compile(r'\bR\.string\.(\w+)'),  # Android resources
    re.compile(r'stringResource\(\s*R\.string\.(\w+)'),  # Compose
    re.compile(r'@string/(\w+)'),  # Android XML
]

# Color tokens.
_COLOR_PATTERNS = [
    re.compile(r'#[0-9A-Fa-f]{6,8}\b'),
    re.compile(r'Color\(\s*red:\s*[^)]+\)'),  # SwiftUI Color(red:...)
    re.compile(r'Color\.(\w+)'),  # SwiftUI/Compose named colors
    re.compile(r'@color/(\w+)'),  # Android XML
    re.compile(r'colorResource\(\s*R\.color\.(\w+)'),  # Compose
]

# Spacing / dimension values.
_SPACING_PATTERNS = [
    re.compile(r'\.padding\(\s*([0-9]+(?:\.[0-9]+)?)\s*\)'),  # SwiftUI
    re.compile(r'\bspacing:\s*([0-9]+(?:\.[0-9]+)?)'),  # SwiftUI stacks
    re.compile(r'\bpadding\(\s*([0-9]+(?:\.[0-9]+)?)\.dp'),  # Compose
    re.compile(r'\b([0-9]+(?:\.[0-9]+)?)\.dp\b'),  # Compose dp
    re.compile(r'android:(?:layout_)?(?:padding|margin)\w*="([0-9]+)dp"'),  # XML
    re.compile(r'EdgeInsets\(\s*top:\s*([0-9]+(?:\.[0-9]+)?)'),  # SwiftUI insets
]


@dataclass
class ExtractedSignals:
    routes: List[str] = field(default_factory=list)
    string_keys: List[str] = field(default_factory=list)
    colors: List[str] = field(default_factory=list)
    spacings: List[str] = field(default_factory=list)

    def merge(self, other: "ExtractedSignals") -> None:
        self.routes = _dedup(self.routes + other.routes)
        self.string_keys = _dedup(self.string_keys + other.string_keys)
        self.colors = _dedup(self.colors + other.colors)
        self.spacings = _dedup(self.spacings + other.spacings)


def _dedup(items: List[str]) -> List[str]:
    seen = set()
    out: List[str] = []
    for item in items:
        if item not in seen:
            seen.add(item)
            out.append(item)
    return out


def _find_all(patterns: List[re.Pattern], text: str) -> List[str]:
    out: List[str] = []
    for pat in patterns:
        for m in pat.finditer(text):
            out.append(m.group(1) if m.groups() else m.group(0))
    return _dedup(out)


def extract_signals(text: str) -> ExtractedSignals:
    return ExtractedSignals(
        routes=_find_all(_ROUTE_PATTERNS, text),
        string_keys=_find_all(_STRING_KEY_PATTERNS, text),
        colors=_find_all(_COLOR_PATTERNS, text),
        spacings=_find_all(_SPACING_PATTERNS, text),
    )
