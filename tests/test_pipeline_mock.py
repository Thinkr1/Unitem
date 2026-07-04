import json
from pathlib import Path

from unitem.analyze import analyze_mapping
from unitem.aggregate import aggregate
from unitem.config import UnitemConfig
from unitem.cursor_runner import MockCursorRunner
from unitem.discovery import build_inventory
from unitem.mapping import generate_mapping
from unitem.report import render_html, render_markdown

EXAMPLES = Path(__file__).resolve().parents[1] / "examples"


def _cfg() -> UnitemConfig:
    return UnitemConfig(
        ios_path=EXAMPLES / "ios",
        android_path=EXAMPLES / "android",
        agent_md_path=EXAMPLES / "agent.md",
    )


def _responder(prompt: str, cwd: Path) -> str:
    """Simulate an agent: flag a spacing issue only for the Settings feature."""

    if "Feature name: Settings" in prompt:
        return json.dumps(
            {
                "findings": [
                    {
                        "category": "spacing",
                        "severity": "high",
                        "kind": "inconsistency",
                        "title": "Edge padding differs (16 vs 8)",
                        "description": "iOS uses 16pt edge padding, Android uses 8dp.",
                        "rationale": "agent.md requires 16 edge padding on an 8pt grid.",
                        "suggested_fix": "Set Android Column padding to 16.dp.",
                        "platforms": ["ios", "android"],
                        "locations": [
                            {"platform": "android", "file": "SettingsScreen.kt"}
                        ],
                        "confidence": 0.9,
                    },
                    {
                        "category": "navigation",
                        "severity": "info",
                        "kind": "expected-native",
                        "title": "Native nav chrome differs",
                        "description": "iOS NavigationView vs Android app bar.",
                        "platforms": ["ios", "android"],
                        "confidence": 0.9,
                    },
                ]
            }
        )
    return '{"findings": []}'


def test_full_mock_pipeline_produces_expected_ticket():
    cfg = _cfg()
    inv = build_inventory(cfg)
    mapping = generate_mapping(inv, cfg)
    agent_md = cfg.agent_md_path.read_text()

    runner = MockCursorRunner(_responder)
    findings = analyze_mapping(mapping, agent_md, cfg, runner, cwd=EXAMPLES)

    report = aggregate(findings, cfg)
    assert len(report.tickets) == 1
    ticket = report.tickets[0]
    assert ticket.feature == "Settings"
    assert ticket.category.value == "spacing"
    assert report.expected_native_count == 1

    # Renderers should not raise and should include the ticket.
    md = render_markdown(report)
    assert ticket.id in md
    html = render_html(report)
    assert "Unitem Consistency Report" in html
