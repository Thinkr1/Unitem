"""Regression coverage for generate.generate_fix() (see /rescan 500 bug)."""
from __future__ import annotations

from unitem.config import Config
from unitem.generate import generate_fix
from unitem.schema import AtomicChange, Location, Ticket


def _cfg(tmp_path, ios_root, android_root) -> Config:
    return Config(
        root=tmp_path,
        ios_root=ios_root,
        android_root=android_root,
        tokens_file=tmp_path / "design-tokens" / "tokens.json",
        conventions=tmp_path / "conventions.yaml",
        agent_md=tmp_path / "agent.md",
        overrides_file=tmp_path / "overrides.jsonl",
        out_dir=tmp_path / "out",
        fixtures_dir=tmp_path / "fixtures",
    )


def test_generate_fix_ignores_non_utf8_files_in_platform_roots(tmp_path):
    """A stray non-UTF-8 file under ios_root/android_root (e.g. an Xcode
    xcuserdata binary plist) must not crash the fix-preview snapshot step
    with a UnicodeDecodeError."""
    ios_root = tmp_path / "sample-ios" / "Sources"
    android_root = tmp_path / "sample-android"
    ios_root.mkdir(parents=True)
    android_root.mkdir(parents=True)

    (ios_root / "Theme.swift").write_text(
        'enum Theme {\n    static let brandPrimary = Color(hex: "#123456")\n}\n',
        encoding="utf-8",
    )
    login_view = ios_root / "LoginView.swift"
    original_source = 'let bg = Color(hex: "#123456")\n'
    login_view.write_text(original_source, encoding="utf-8")

    # Same extension unitem cares about, but not valid UTF-8 — reproduces the
    # UnicodeDecodeError from the bug report without depending on real Xcode
    # project artifacts.
    (ios_root / "Corrupted.swift").write_bytes(b"bplist00\xbc\x01\x02\x03")

    cfg = _cfg(tmp_path, ios_root, android_root)

    change = AtomicChange(
        kind="style",
        category="color",
        name="color.hardcoded",
        after="#123456",
        origin_platform="ios",
        location=Location(file=str(login_view.relative_to(tmp_path)), line=1),
    )
    ticket = Ticket(
        id="UNI-001",
        mode="diff",
        category="color",
        change=change,
        verdict="flag",
        severity="medium",
        confidence=0.9,
        reason="hardcoded literal should use the design token",
        convention_refs=[],
        expected="#123456",
    )

    fix = generate_fix(ticket, cfg)

    assert fix is not None
    assert fix.file == str(login_view.relative_to(tmp_path))
    assert "Theme.brandPrimary" in fix.diff
    # generate_fix() only previews — the source file must be restored.
    assert login_view.read_text(encoding="utf-8") == original_source


def test_generate_fix_reverts_a_drifted_token_definition(tmp_path):
    """verdict=flag on a kind="token" change (e.g. Android's generated
    theme.dart hardcodes a stale brand color) must revert that literal to the
    rulebook's expected value — not fall through to the substitution
    strategy, which has no token reference to point at here."""
    android_root = tmp_path / "sample-flutter"
    android_root.mkdir(parents=True)
    theme_file = android_root / "lib" / "theme.dart"
    theme_file.parent.mkdir(parents=True)
    original_source = (
        "class AppTheme {\n"
        "  static const Color brandPrimary = Color(0xFF4F46E5);\n"
        "}\n"
    )
    theme_file.write_text(original_source, encoding="utf-8")

    cfg = _cfg(tmp_path, tmp_path / "sample-ios", android_root)

    change = AtomicChange(
        kind="token",
        category="color",
        name="color.brandPrimary",
        after="#4F46E5",
        origin_platform="android",
        location=Location(file=str(theme_file.relative_to(tmp_path)), line=2),
    )
    ticket = Ticket(
        id="UNI-003",
        mode="diff",
        category="color",
        change=change,
        verdict="flag",
        severity="high",
        confidence=0.95,
        reason="Android drifted from the shared brand color; iOS already matches spec.",
        convention_refs=["flag/stale-token"],
        expected="#E11D48",
    )

    fix = generate_fix(ticket, cfg)

    assert fix is not None
    assert fix.target_platform == "android"
    assert "0xFFE11D48" in fix.diff
    assert "0xFF4F46E5" not in fix.diff.splitlines()[-1]  # old value only on the removed line
    # generate_fix() only previews — the source file must be restored.
    assert theme_file.read_text(encoding="utf-8") == original_source
