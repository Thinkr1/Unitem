from pathlib import Path

from unitem.analyze import analyze_pair, detect_android_language
from unitem.extractors import extract_file

from conftest import REPO_ROOT

PASTE = REPO_ROOT / "examples" / "paste"


DART_SNIPPET = """\
import 'package:flutter/material.dart';

class LoginScreen extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Column(children: [
      Switch(value: true, onChanged: null),
      Text('Forgot password?',
          style: TextStyle(fontSize: 13, color: Color(0xFF22C55E))),
    ]);
  }
}
"""

THEME_SNIPPET = """\
class AppTheme {
  static const Color brandPrimary = Color(0xFF4F46E5);
  static const double radiusButton = 12;
}
"""


def test_dart_extraction(tmp_path):
    # inline fixtures: sample-flutter/lib is live demo state that the transfer
    # stage rewrites, so the extractor is tested on stable snippets instead
    theme_path = tmp_path / "theme.dart"
    theme_path.write_text(THEME_SNIPPET)
    facts = extract_file(theme_path, "android")
    defs = {f.name: f.value for f in facts if f.kind == "token_def"}
    assert defs["brandPrimary"] == "#4F46E5"
    assert defs["radiusButton"] == "12"

    screen_path = tmp_path / "login_screen.dart"
    screen_path.write_text(DART_SNIPPET)
    screen = extract_file(screen_path, "android")
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
