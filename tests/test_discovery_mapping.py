from pathlib import Path

from unitem.config import UnitemConfig
from unitem.discovery import build_inventory
from unitem.mapping import apply_overrides, generate_mapping
from unitem.schema import Platform, Stack

EXAMPLES = Path(__file__).resolve().parents[1] / "examples"


def _cfg() -> UnitemConfig:
    return UnitemConfig(
        ios_path=EXAMPLES / "ios",
        android_path=EXAMPLES / "android",
        agent_md_path=EXAMPLES / "agent.md",
        output_dir=EXAMPLES / ".unitem",
    )


def test_discovery_finds_screens_and_stacks():
    inv = build_inventory(_cfg())
    ios_names = {s.name for s in inv.ios_screens}
    android_names = {s.name for s in inv.android_screens}
    assert "Settings" in ios_names
    assert "Profile" in ios_names
    assert "Settings" in android_names
    assert "Profile" in android_names

    stacks = {s for f in inv.files for s in [f.stack]}
    assert Stack.SWIFTUI in stacks
    assert Stack.COMPOSE in stacks

    for s in inv.ios_screens:
        assert s.platform == Platform.IOS
    for s in inv.android_screens:
        assert s.platform == Platform.ANDROID


def test_mapping_matches_settings_and_profile():
    cfg = _cfg()
    inv = build_inventory(cfg)
    mapping = generate_mapping(inv, cfg)
    features = {e.feature for e in mapping.entries}
    assert "Settings" in features
    assert "Profile" in features
    for e in mapping.entries:
        assert e.ios and e.android
        assert e.confidence >= cfg.min_mapping_confidence


def test_mapping_overrides(tmp_path):
    cfg = _cfg()
    inv = build_inventory(cfg)
    mapping = generate_mapping(inv, cfg)

    overrides = tmp_path / "mapping.overrides.yaml"
    overrides.write_text(
        "ignore_features: [Profile]\n"
        "entries:\n"
        "  - feature: Settings\n"
        "    ios: [custom/ios/Settings.swift]\n"
        "    android: [custom/android/Settings.kt]\n"
    )
    merged = apply_overrides(mapping, overrides)
    features = {e.feature for e in merged.entries}
    assert "Profile" not in features
    settings = next(e for e in merged.entries if e.feature == "Settings")
    assert settings.status == "override"
    assert settings.ios == ["custom/ios/Settings.swift"]
