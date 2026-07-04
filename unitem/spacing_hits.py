"""Line-level spacing/padding extraction for actionable ticket locations."""

from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path
from typing import List, Optional

# (regex, human-readable kind label)
_LINE_PATTERNS: list[tuple[re.Pattern[str], str]] = [
    (re.compile(r"\.padding\(\s*([0-9]+(?:\.[0-9]+)?)\s*\)"), "edge padding"),
    (re.compile(r"\.padding\(\.([a-zA-Z]+)\s*,\s*([0-9]+(?:\.[0-9]+)?)\s*\)"), "directional padding"),
    (re.compile(r"\bspacing:\s*([0-9]+(?:\.[0-9]+)?)"), "stack spacing"),
    (re.compile(r"\bpadding\(\s*([0-9]+(?:\.[0-9]+)?)\.dp"), "edge padding"),
    (re.compile(r"Modifier\.padding\(\s*([0-9]+(?:\.[0-9]+)?)\.dp"), "edge padding"),
    (re.compile(r'\b([0-9]+(?:\.[0-9]+)?)\.dp\b'), "dimension (dp)"),
    (re.compile(r'android:(?:layout_)?padding\w*="([0-9]+)dp"'), "XML padding"),
    (re.compile(r'android:(?:layout_)?margin\w*="([0-9]+)dp"'), "XML margin"),
]


@dataclass
class SpacingHit:
    file: str
    line: int
    snippet: str
    value: str
    kind: str


def extract_spacing_hits(path: Path, *, max_hits: int = 8) -> List[SpacingHit]:
    """Return spacing/padding occurrences in ``path`` with line numbers."""

    try:
        text = path.read_text(encoding="utf-8", errors="ignore")
    except OSError:
        return []

    hits: List[SpacingHit] = []
    for line_no, line in enumerate(text.splitlines(), start=1):
        stripped = line.strip()
        if not stripped or stripped.startswith("//") or stripped.startswith("*"):
            continue
        for pattern, kind in _LINE_PATTERNS:
            m = pattern.search(line)
            if not m:
                continue
            value = m.group(1)
            if len(m.groups()) >= 2 and m.group(2):
                value = f"{m.group(1)}={m.group(2)}"
            hits.append(
                SpacingHit(
                    file=str(path),
                    line=line_no,
                    snippet=stripped[:160],
                    value=value,
                    kind=kind,
                )
            )
            break  # one hit per source line
        if len(hits) >= max_hits:
            break
    return hits


def _hits_by_kind(hits: List[SpacingHit]) -> dict[str, List[SpacingHit]]:
    grouped: dict[str, List[SpacingHit]] = {}
    for hit in hits:
        grouped.setdefault(hit.kind, []).append(hit)
    return grouped


def _values_for_kind(hits: List[SpacingHit], kind: str) -> set[str]:
    return {h.value for h in hits if h.kind == kind}


def _first_hit(hits: List[SpacingHit], kind: str) -> Optional[SpacingHit]:
    for hit in hits:
        if hit.kind == kind:
            return hit
    return None


def format_hit(hit: SpacingHit) -> str:
    rel = Path(hit.file).name
    return f"{rel}:{hit.line} — `{hit.snippet}` ({hit.kind}, value={hit.value})"


def _find_differing_kind(ios_hits: List[SpacingHit], android_hits: List[SpacingHit]) -> Optional[str]:
    """Return the spacing kind that differs first (edge padding, then stack spacing)."""

    priority = ["edge padding", "stack spacing", "directional padding", "XML padding", "dimension (dp)"]
    kinds = set(_hits_by_kind(ios_hits)) | set(_hits_by_kind(android_hits))
    ordered = [k for k in priority if k in kinds] + [k for k in sorted(kinds) if k not in priority]
    for kind in ordered:
        ios_vals = _values_for_kind(ios_hits, kind)
        and_vals = _values_for_kind(android_hits, kind)
        if ios_vals != and_vals:
            return kind
    return None


def build_spacing_finding(
    feature: str,
    ios_files: List[str],
    android_files: List[str],
) -> Optional[dict]:
    """Build a spacing inconsistency finding with concrete locations, or None."""

    ios_hits: List[SpacingHit] = []
    android_hits: List[SpacingHit] = []
    for f in ios_files:
        ios_hits.extend(extract_spacing_hits(Path(f)))
    for f in android_files:
        android_hits.extend(extract_spacing_hits(Path(f)))

    if not ios_hits and not android_hits:
        return None

    kind = _find_differing_kind(ios_hits, android_hits)
    if kind is None:
        return None

    ios_primary = _first_hit(ios_hits, kind)
    and_primary = _first_hit(android_hits, kind)

    ios_val = ios_primary.value if ios_primary else "(missing)"
    and_val = and_primary.value if and_primary else "(missing)"

    title = f"{feature}: {kind} differs ({ios_val} vs {and_val})"

    ios_detail = format_hit(ios_primary) if ios_primary else f"no {kind} on iOS"
    and_detail = format_hit(and_primary) if and_primary else f"no {kind} on Android"

    description = (
        f"On the {feature} screen, {kind} differs between platforms.\n"
        f"- iOS: {ios_detail}\n"
        f"- Android: {and_detail}"
    )

    suggested_fix = None
    if and_primary and ios_primary:
        suggested_fix = (
            f"In `{Path(and_primary.file).name}:{and_primary.line}`, change "
            f"`{and_primary.snippet}` to match iOS "
            f"`{Path(ios_primary.file).name}:{ios_primary.line}` (value {ios_val})."
        )
    elif ios_primary and not and_primary:
        suggested_fix = (
            f"Add {kind} ({ios_val}) to the Android {feature} screen to match iOS "
            f"`{Path(ios_primary.file).name}:{ios_primary.line}`."
        )

    locations = []
    for hit in ios_hits[:3]:
        locations.append(
            {
                "platform": "ios",
                "file": hit.file,
                "line": hit.line,
                "snippet": hit.snippet,
            }
        )
    for hit in android_hits[:3]:
        locations.append(
            {
                "platform": "android",
                "file": hit.file,
                "line": hit.line,
                "snippet": hit.snippet,
            }
        )

    return {
        "category": "spacing",
        "severity": "medium",
        "kind": "inconsistency",
        "title": title,
        "description": description,
        "rationale": "agent.md requires a shared spacing scale (8pt grid, 16pt screen edge padding).",
        "suggested_fix": suggested_fix,
        "platforms": ["ios", "android"],
        "locations": locations,
        "confidence": 0.85,
    }
