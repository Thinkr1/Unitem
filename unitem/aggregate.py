"""Aggregate raw findings into deduplicated tickets.

Only ``inconsistency`` findings become tickets; ``expected-native`` findings are
counted but suppressed (they are correct divergences). Near-duplicate findings
(same feature + category + similar title) are merged, keeping the highest
severity and merging locations.
"""

from __future__ import annotations

import difflib
from datetime import datetime, timezone
from typing import List

from . import __version__
from .config import UnitemConfig
from .schema import (
    Finding,
    FindingKind,
    Location,
    Severity,
    Ticket,
    TicketReport,
)

_SEVERITY_ORDER = {
    Severity.CRITICAL: 4,
    Severity.HIGH: 3,
    Severity.MEDIUM: 2,
    Severity.LOW: 1,
    Severity.INFO: 0,
}


def _more_severe(a: Severity, b: Severity) -> Severity:
    return a if _SEVERITY_ORDER[a] >= _SEVERITY_ORDER[b] else b


def _merge_locations(a: List[Location], b: List[Location]) -> List[Location]:
    seen = {(loc.platform, loc.file, loc.line) for loc in a}
    out = list(a)
    for loc in b:
        key = (loc.platform, loc.file, loc.line)
        if key not in seen:
            seen.add(key)
            out.append(loc)
    return out


def _similar(a: str, b: str, threshold: float = 0.85) -> bool:
    return difflib.SequenceMatcher(None, a.lower(), b.lower()).ratio() >= threshold


def aggregate(findings: List[Finding], cfg: UnitemConfig) -> TicketReport:
    inconsistencies = [f for f in findings if f.kind == FindingKind.INCONSISTENCY]
    expected_native = sum(1 for f in findings if f.kind == FindingKind.EXPECTED_NATIVE)

    tickets: List[Ticket] = []
    for f in inconsistencies:
        merged = False
        for t in tickets:
            if t.feature == f.feature and t.category == f.category and _similar(t.title, f.title):
                t.severity = _more_severe(t.severity, f.severity)
                t.locations = _merge_locations(t.locations, f.locations)
                t.confidence = max(t.confidence, f.confidence)
                t.source_count += 1
                for p in f.platforms:
                    if p not in t.platforms:
                        t.platforms.append(p)
                merged = True
                break
        if merged:
            continue
        tickets.append(
            Ticket(
                id=Ticket.make_id(f.feature, f.category, f.title),
                feature=f.feature,
                category=f.category,
                severity=f.severity,
                title=f.title,
                description=f.description,
                rationale=f.rationale,
                suggested_fix=f.suggested_fix,
                platforms=list(f.platforms),
                locations=list(f.locations),
                confidence=f.confidence,
            )
        )

    tickets.sort(key=lambda t: (-_SEVERITY_ORDER[t.severity], t.feature.lower(), t.title.lower()))

    by_category: dict[str, int] = {}
    by_severity: dict[str, int] = {}
    for t in tickets:
        by_category[t.category.value] = by_category.get(t.category.value, 0) + 1
        by_severity[t.severity.value] = by_severity.get(t.severity.value, 0) + 1

    return TicketReport(
        tool_version=__version__,
        ios_path=str(cfg.ios_path),
        android_path=str(cfg.android_path),
        agent_md_path=str(cfg.agent_md_path),
        generated_at=datetime.now(timezone.utc).isoformat(),
        tickets=tickets,
        expected_native_count=expected_native,
        stats={
            "total_findings": len(findings),
            "tickets": len(tickets),
            "expected_native": expected_native,
            "by_category": by_category,
            "by_severity": by_severity,
        },
    )
