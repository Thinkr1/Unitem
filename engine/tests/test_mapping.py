from unitem.config import load_config
from unitem.discovery import discover
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
