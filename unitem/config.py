"""Configuration loading for unitem.

The tool is driven by a small ``unitem.yaml`` that points at the two codebases
and the shared ``agent.md`` design spec. All paths are resolved relative to the
config file's directory unless absolute.
"""

from __future__ import annotations

from pathlib import Path
from typing import Optional

import yaml
from pydantic import BaseModel, Field


class UnitemConfig(BaseModel):
    ios_path: Path
    android_path: Path
    agent_md_path: Path
    output_dir: Path = Path(".unitem")

    # Cursor agent execution.
    model: Optional[str] = None
    concurrency: int = 4
    timeout_seconds: int = 900
    max_retries: int = 2
    cursor_command: str = "cursor-agent"

    # Mapping.
    mapping_overrides_path: Optional[Path] = None
    min_mapping_confidence: float = 0.35

    # Analysis budget guards.
    max_files_per_section: int = 12
    max_bytes_per_file: int = 60_000

    def resolve(self, base: Path) -> "UnitemConfig":
        """Return a copy with all paths resolved against ``base``."""

        def _resolve(p: Optional[Path]) -> Optional[Path]:
            if p is None:
                return None
            p = Path(p)
            return p if p.is_absolute() else (base / p).resolve()

        return self.model_copy(
            update={
                "ios_path": _resolve(self.ios_path),
                "android_path": _resolve(self.android_path),
                "agent_md_path": _resolve(self.agent_md_path),
                "output_dir": _resolve(self.output_dir),
                "mapping_overrides_path": _resolve(self.mapping_overrides_path),
            }
        )


DEFAULT_CONFIG_NAME = "unitem.yaml"


def load_config(path: str | Path) -> UnitemConfig:
    path = Path(path)
    if path.is_dir():
        path = path / DEFAULT_CONFIG_NAME
    if not path.exists():
        raise FileNotFoundError(f"Config file not found: {path}")
    data = yaml.safe_load(path.read_text()) or {}
    cfg = UnitemConfig(**data)
    return cfg.resolve(path.parent)


def validate_inputs(cfg: UnitemConfig) -> list[str]:
    """Return a list of human-readable problems with the configured inputs."""

    problems: list[str] = []
    if not cfg.ios_path.exists():
        problems.append(f"iOS path does not exist: {cfg.ios_path}")
    if not cfg.android_path.exists():
        problems.append(f"Android path does not exist: {cfg.android_path}")
    if not cfg.agent_md_path.exists():
        problems.append(f"agent.md path does not exist: {cfg.agent_md_path}")
    return problems
