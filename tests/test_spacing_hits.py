from pathlib import Path

from unitem.spacing_hits import build_spacing_finding, extract_spacing_hits

EXAMPLES = Path(__file__).resolve().parents[1] / "examples"


def test_extract_spacing_hits_finds_line_numbers():
    ios = EXAMPLES / "ios/Settings/SettingsView.swift"
    hits = extract_spacing_hits(ios)
    assert hits
    padding = next(h for h in hits if h.kind == "edge padding")
    assert padding.line == 21
    assert padding.value == "16"
    assert ".padding(16)" in padding.snippet


def test_build_spacing_finding_includes_locations():
    finding = build_spacing_finding(
        "Settings",
        [str(EXAMPLES / "ios/Settings/SettingsView.swift")],
        [str(EXAMPLES / "android/settings/SettingsScreen.kt")],
    )
    assert finding is not None
    assert finding["locations"]
    assert len(finding["locations"]) >= 2
    assert any(l["platform"] == "ios" and l["line"] for l in finding["locations"])
    assert any(l["platform"] == "android" and l["snippet"] for l in finding["locations"])
    assert "SettingsView.swift:21" in finding["description"]
    assert "SettingsScreen.kt:18" in finding["description"]
