import json
from pathlib import Path

import pytest

from unitem.schema import AtomicChange

REPO_ROOT = Path(__file__).resolve().parents[2]
EXAMPLES = REPO_ROOT / "examples"
CONVENTIONS = REPO_ROOT / "conventions" / "conventions.yaml"


@pytest.fixture(scope="session")
def seeded_changes() -> list[AtomicChange]:
    data = json.loads((EXAMPLES / "changes" / "login-changes.json").read_text())
    return [AtomicChange.model_validate(c) for c in data["changes"]]


@pytest.fixture(scope="session")
def changes_by_id(seeded_changes) -> dict[str, AtomicChange]:
    return {c.id: c for c in seeded_changes}
