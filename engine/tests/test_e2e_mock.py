"""The CI gate: full diff pipeline offline on /examples with the mock runner,
then the FastAPI round-trip the /UI app depends on."""
from fastapi.testclient import TestClient

from unitem.aggregate import assign_ids, dedupe, sort_tickets
from unitem.api import create_app
from unitem.config import load_config
from unitem.judge import JudgeContext, build_prompt, judge_all, load_overrides, load_rules
from unitem.report import write_tickets
from unitem.runner import MockRunner
from unitem.schema import TicketFile

from conftest import REPO_ROOT

UI_REQUIRED_FIELDS = {"id", "property", "severity", "rule", "ios", "android", "status"}
UI_ADDITIVE_FIELDS = {"verdict", "confidence", "reason", "conventionRefs", "originPlatform"}


def _pipeline(tmp_path, seeded_changes):
    cfg = load_config(REPO_ROOT / "unitem.yaml").model_copy(
        update={"out_dir": tmp_path, "overrides_file": tmp_path / "overrides.jsonl"}
    )
    ctx = JudgeContext(rules=load_rules(cfg.conventions), agent_md=cfg.read_agent_md())
    runner = MockRunner(cfg.fixtures_dir)
    tickets = assign_ids(sort_tickets(dedupe(judge_all(seeded_changes, ctx, runner))))
    write_tickets(tmp_path / "tickets.json", TicketFile(
        run_id="test", mode="diff", screen="login", tickets=tickets
    ))
    return cfg, tickets


def test_full_mock_pipeline_and_api(tmp_path, seeded_changes):
    cfg, tickets = _pipeline(tmp_path, seeded_changes)

    verdicts = {t.change.id: t.verdict for t in tickets}
    assert verdicts["chg-brand-primary"] == "propagate"
    assert verdicts["chg-toggle-native"] == "hold"
    assert verdicts["chg-hardcoded-secondary"] == "flag"
    assert all(t.convention_refs for t in tickets)

    client = TestClient(create_app(cfg))

    body = client.get("/comparison?screen=login").json()
    assert set(body) == {"screen", "ios", "android", "inconsistencies", "rulebook"}
    assert len(body["inconsistencies"]) == 3
    for item in body["inconsistencies"]:
        assert UI_REQUIRED_FIELDS <= set(item)
        assert UI_ADDITIVE_FIELDS <= set(item)
        assert item["severity"] in ("error", "warning", "info")
        assert item["status"] == "open"

    hold_id = next(t.id for t in tickets if t.verdict == "hold")
    flag_id = next(t.id for t in tickets if t.verdict == "flag")

    overridden = client.post(
        f"/findings/{flag_id}/override",
        json={"verdict": "hold", "note": "our team allows this literal"},
    ).json()
    assert overridden["status"] == "ignored"
    records = load_overrides(cfg.overrides_file)
    assert len(records) == 1 and records[0].human_verdict == "hold"

    accepted = client.post(f"/findings/{hold_id}/accept").json()
    assert accepted["status"] == "resolved"


def test_override_becomes_precedent_in_next_prompt(tmp_path, seeded_changes, changes_by_id):
    cfg, tickets = _pipeline(tmp_path, seeded_changes)
    client = TestClient(create_app(cfg))
    flag_id = next(t.id for t in tickets if t.verdict == "flag")
    client.post(
        f"/findings/{flag_id}/override",
        json={"verdict": "hold", "note": "approved exception"},
    )

    ctx = JudgeContext(
        rules=load_rules(cfg.conventions),
        overrides=load_overrides(cfg.overrides_file),
    )
    prompt = build_prompt(changes_by_id["chg-hardcoded-secondary"], ctx)
    assert "corrected it to **hold**" in prompt
    assert "approved exception" in prompt
