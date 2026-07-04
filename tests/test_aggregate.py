from pathlib import Path

from unitem.aggregate import aggregate
from unitem.config import UnitemConfig
from unitem.schema import (
    Category,
    Finding,
    FindingKind,
    Location,
    Platform,
    Severity,
)

EXAMPLES = Path(__file__).resolve().parents[1] / "examples"


def _cfg() -> UnitemConfig:
    return UnitemConfig(
        ios_path=EXAMPLES / "ios",
        android_path=EXAMPLES / "android",
        agent_md_path=EXAMPLES / "agent.md",
    )


def _finding(kind=FindingKind.INCONSISTENCY, title="Padding mismatch", sev=Severity.MEDIUM):
    return Finding(
        feature="Settings",
        category=Category.SPACING,
        severity=sev,
        kind=kind,
        title=title,
        description="edge padding differs",
        platforms=[Platform.IOS, Platform.ANDROID],
        locations=[Location(platform=Platform.ANDROID, file="a.kt")],
        confidence=0.8,
    )


def test_expected_native_not_ticketed():
    findings = [
        _finding(kind=FindingKind.EXPECTED_NATIVE, title="Native back gesture"),
        _finding(kind=FindingKind.INCONSISTENCY),
    ]
    report = aggregate(findings, _cfg())
    assert len(report.tickets) == 1
    assert report.expected_native_count == 1


def test_duplicate_findings_merged_and_severity_escalated():
    findings = [
        _finding(sev=Severity.LOW, title="Edge padding mismatch"),
        _finding(sev=Severity.HIGH, title="Edge padding mismatched"),
    ]
    report = aggregate(findings, _cfg())
    assert len(report.tickets) == 1
    ticket = report.tickets[0]
    assert ticket.severity == Severity.HIGH
    assert ticket.source_count == 2


def test_stable_ids():
    a = _finding()
    b = _finding()
    report = aggregate([a, b], _cfg())
    assert report.tickets[0].id.startswith("UNI-")
