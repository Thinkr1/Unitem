from unitem.config import load_config
from unitem.discovery import discover
from unitem.extractors import DesignFact
from unitem.mapping import build_mapping, counterpart_file, normalize_stem

from conftest import REPO_ROOT


def test_normalize_stem():
    assert normalize_stem("Sources/LoginView.swift") == "login"
    assert normalize_stem("login/LoginScreen.kt") == "login"
    assert normalize_stem("PaymentSheetView.swift") == "paymentsheet"


def test_sample_apps_map_login_pair():
    cfg = load_config(REPO_ROOT / "unitem.yaml")
    facts = discover(cfg)
    mapping = build_mapping(cfg, facts["ios"], facts["android"])
    login = next(s for s in mapping.screens if s.feature == "login")
    assert not login.one_sided
    assert login.ios and login.android
    assert counterpart_file(mapping, login.ios[0]) == login.android[0]


def test_maps_screen_recognized_by_copy_without_components():
    """A regenerated screen may use widgets outside the component list (e.g.
    a transfer emitting TextFormField/FilledButton). It must still map by its
    UI copy so the panel keeps resolving to the real file, while theme files
    (copy-less) stay excluded."""
    cfg = load_config(REPO_ROOT / "unitem.yaml")
    ios = [
        DesignFact(kind="component", name="Button", value="Button",
                   file="Sources/LoginView.swift", line=1, platform="ios"),
        DesignFact(kind="copy", value="Sign In",
                   file="Sources/LoginView.swift", line=2, platform="ios"),
    ]
    android = [
        # no component fact — only copy — mirrors an agent-regenerated screen
        DesignFact(kind="copy", value="Sign In",
                   file="lib/login_screen.dart", line=1, platform="android"),
        # theme file: token defs but no copy — must NOT be treated as a screen
        DesignFact(kind="token_def", name="brandPrimary", value="#E11D48",
                   file="lib/theme.dart", line=1, platform="android"),
    ]
    mapping = build_mapping(cfg, ios, android)
    login = next(s for s in mapping.screens if s.feature == "login")
    assert login.android == ["lib/login_screen.dart"]
    assert all("theme.dart" not in f for s in mapping.screens for f in s.android)
