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
    if name == "claude":
        from .claude import ClaudeRunner

        model = cfg.runner.model
        if model.startswith("claude-opus-4-8"):
            model = "opus"  # claude CLI uses aliases (opus|sonnet|haiku) or full API ids
        return ClaudeRunner(model=model, timeout_s=cfg.runner.timeout_s)
    raise RunnerError(
        f"Unknown runner '{name}'. Available: mock, cursor, claude "
        "(cursor = Cursor subscription; claude = Claude subscription; mock = offline replay)"
    )


__all__ = ["Runner", "RunnerError", "run_json", "MockRunner", "get_runner"]
