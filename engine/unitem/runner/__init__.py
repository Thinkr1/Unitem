from __future__ import annotations

from ..config import Config
from .base import Runner, RunnerError, run_json
from .mock import MockRunner


def get_runner(cfg: Config, name: str | None = None) -> Runner:
    name = name or cfg.runner.name
    if name == "mock":
        return MockRunner(cfg.fixtures_dir)
    if name == "cursor":
        from .cursor import CursorRunner

        return CursorRunner(model=cfg.runner.model, timeout_s=cfg.runner.timeout_s)
    raise RunnerError(
        f"Unknown runner '{name}'. Available: mock, cursor. "
        "(anthropic is intentionally unimplemented — no API key in this setup)"
    )


__all__ = ["Runner", "RunnerError", "run_json", "MockRunner", "get_runner"]
