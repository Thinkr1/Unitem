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
