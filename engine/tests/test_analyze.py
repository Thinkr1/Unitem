from pathlib import Path

from unitem.analyze import analyze_pair, detect_android_language
from unitem.extractors import extract_file

from conftest import REPO_ROOT

PASTE = REPO_ROOT / "examples" / "paste"


def test_dart_extraction_on_flutter_sample():
    facts = extract_file(REPO_ROOT / "sample-flutter/lib/theme.dart", "android")
    defs = {f.name: f.value for f in facts if f.kind == "token_def"}
    assert defs["brandPrimary"] == "#4F46E5"
    assert defs["radiusButton"] == "12"

    screen = extract_file(REPO_ROOT / "sample-flutter/lib/login_screen.dart", "android")
    assert [f.value for f in screen if f.kind == "color"] == ["#22C55E"]
    assert "Switch" in {f.value for f in screen if f.kind == "component"}
    assert "Forgot password?" in {f.value for f in screen if f.kind == "copy"}


def test_detect_android_language():
    assert detect_android_language("import 'package:flutter/material.dart';") == "dart"
    assert detect_android_language("val x = Color(0xFF000000)") == "kotlin"


def test_analyze_pair_on_ui_mock_code():
    ios = (PASTE / "ios.swift").read_text()
    android = (PASTE / "android.dart").read_text()
    changes = analyze_pair(ios, android)
    names = {c.name for c in changes}
    assert "color.primary-button" in names
    assert "typography.welcome-back" in names
    assert "copy.primary-button-label" in names
    # every change carries both sides for the UI's line-linking
    assert all(c.counterpart_location for c in changes)
    # deterministic ids: same input, same ids (fixtures depend on this)
    assert {c.id for c in analyze_pair(ios, android)} == {c.id for c in changes}
