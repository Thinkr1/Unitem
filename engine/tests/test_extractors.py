from unitem.extractors import extract_file

from conftest import EXAMPLES


def test_swift_theme_extraction():
    facts = extract_file(EXAMPLES / "ios" / "Theme.swift", "ios")
    defs = {f.name: (f.value, f.line) for f in facts if f.kind == "token_def"}
    assert defs["brandPrimary"] == ("#6366F1", 15)
    assert defs["textSecondary"] == ("#8A8BB3", 17)
    assert defs["inputHeight"] == ("52", 19)


def test_swift_login_extraction():
    facts = extract_file(EXAMPLES / "ios" / "LoginView.swift", "ios")
    components = {(f.value, f.line) for f in facts if f.kind == "component"}
    assert ("Toggle", 20) in components
    copy = {f.value for f in facts if f.kind == "copy"}
    assert "Welcome back" in copy
    assert "Forgot password?" in copy


def test_kotlin_extraction():
    color_facts = extract_file(EXAMPLES / "android" / "Color.kt", "android")
    defs = {f.name: (f.value, f.line) for f in color_facts if f.kind == "token_def"}
    assert defs["BrandPrimary"] == ("#4F46E5", 5)

    screen_facts = extract_file(EXAMPLES / "android" / "LoginScreen.kt", "android")
    inline = [f for f in screen_facts if f.kind == "color"]
    assert [(f.value, f.line) for f in inline] == [("#5A55F2", 58)]
    components = {f.value for f in screen_facts if f.kind == "component"}
    assert "Switch" in components
    font_sizes = {f.value for f in screen_facts if f.kind == "font_size"}
    assert {"28", "17", "13"} <= font_sizes
