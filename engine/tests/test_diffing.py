"""Change detection for the rehearsed demo scenarios."""
from __future__ import annotations

import subprocess

from unitem.config import load_config
from unitem.diffing import _token_pair_drift, detect_changes
from unitem.discovery import discover

from conftest import REPO_ROOT


def test_token_pair_drift_skips_tokens_already_in_git_delta():
    cfg = load_config(REPO_ROOT / "unitem.yaml")
    all_facts = discover(cfg)
    drift = _token_pair_drift(cfg, all_facts, skip_tokens={"brandprimary"})
    assert drift == []


def test_detect_changes_after_demo_scenario_1():
    """reset + scenario 1 should surface one iOS propagate token change."""
    cfg = load_config(REPO_ROOT / "unitem.yaml")

    subprocess.run(
        ["python3", str(REPO_ROOT / "scripts/demo_edits.py"), "reset"],
        cwd=REPO_ROOT,
        check=True,
    )
    subprocess.run(
        ["python3", str(REPO_ROOT / "scripts/demo_edits.py"), "1"],
        cwd=REPO_ROOT,
        check=True,
    )

    changes = detect_changes(cfg)
    token_changes = [c for c in changes if c.kind == "token" and c.name == "color.brandPrimary"]

    assert len(token_changes) == 1
    change = token_changes[0]
    assert change.origin_platform == "ios"
    assert change.before == "#4F46E5"
    assert change.after == "#E11D48"
    assert change.location.file.endswith("Theme.swift")

    # Restore working tree for other tests.
    subprocess.run(
        ["git", "checkout", "--", "sample-ios", "sample-flutter"],
        cwd=REPO_ROOT,
        check=True,
    )
