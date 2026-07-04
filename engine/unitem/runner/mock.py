"""Fixture-replay runner: the offline dev mode, the CI gate, and the stage fallback.

Fixtures live in <fixtures_dir>/judge/<key>.json where <key> is the atomic
change id. With --record (M6), real cursor-agent responses overwrite these
files, so the mock becomes a replay of genuine runs.
"""
from __future__ import annotations

import hashlib
import json
from pathlib import Path

from .base import Runner

DEGRADE_RESPONSE = json.dumps(
    {
        "verdict": "flag",
        "severity": "low",
        "confidence": 0.3,
        "reason": "No recorded judgment for this change; deferring to a human reviewer.",
        "convention_refs": [],
        "expected": None,
    }
)


class MockRunner(Runner):
    name = "mock"

    def __init__(self, fixtures_dir: Path):
        self.fixtures_dir = Path(fixtures_dir)

    def complete(self, prompt: str, *, key: str | None = None, timeout_s: int = 120) -> str:
        candidates = []
        if key:
            candidates.append(self.fixtures_dir / "judge" / f"{key}.json")
        prompt_key = hashlib.sha1(prompt.encode()).hexdigest()[:12]
        candidates.append(self.fixtures_dir / "judge" / f"{prompt_key}.json")
        for path in candidates:
            if path.is_file():
                return path.read_text(encoding="utf-8")
        return DEGRADE_RESPONSE
