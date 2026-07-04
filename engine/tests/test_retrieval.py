from unitem.judge import load_rules, retrieve_rules

from conftest import CONVENTIONS


def test_kb_loads_and_covers_all_verdicts():
    rules = load_rules(CONVENTIONS)
    assert len(rules) >= 20
    verdicts = {r.verdict for r in rules}
    assert verdicts == {"propagate", "hold", "flag"}


def test_brand_color_change_retrieves_brand_rule(changes_by_id):
    rules = load_rules(CONVENTIONS)
    top = retrieve_rules(changes_by_id["chg-brand-primary"], rules)
    ids = [r.id for r in top]
    assert "propagate/brand-color" in ids


def test_toggle_change_retrieves_native_switch_rule(changes_by_id):
    rules = load_rules(CONVENTIONS)
    top = retrieve_rules(changes_by_id["chg-toggle-native"], rules)
    ids = [r.id for r in top]
    assert "hold/native-switch" in ids


def test_hardcoded_hex_retrieves_flag_rules(changes_by_id):
    rules = load_rules(CONVENTIONS)
    top = retrieve_rules(changes_by_id["chg-hardcoded-secondary"], rules)
    ids = [r.id for r in top]
    assert "flag/hardcoded-color" in ids
