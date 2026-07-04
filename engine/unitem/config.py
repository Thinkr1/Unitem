"""Load unitem.yaml. All relative paths resolve against the config file's directory."""
from __future__ import annotations

from pathlib import Path

import yaml
from pydantic import BaseModel


class RunnerConfig(BaseModel):
    name: str = "mock"  # mock | cursor
    model: str = "auto"
    concurrency: int = 4
    timeout_s: int = 120


class RepoConfig(BaseModel):
    remote: str = "origin"
    pr_base_branch: str = "main"
    github_repo: str = "Thinkr1/Unitem"
    open_prs: bool = False  # demo: agents apply changes live; PRs are a later feature


class Config(BaseModel):
    root: Path  # directory the config file lives in
    ios_root: Path
    android_root: Path
    tokens_file: Path
    conventions: Path
    agent_md: Path
    overrides_file: Path
    out_dir: Path
    fixtures_dir: Path
    screen: str = "login"
    runner: RunnerConfig = RunnerConfig()
    repo: RepoConfig = RepoConfig()

    def read_agent_md(self) -> str:
        if self.agent_md.is_file():
            return self.agent_md.read_text(encoding="utf-8")
        return ""


_PATH_FIELDS = [
    "ios_root",
    "android_root",
    "tokens_file",
    "conventions",
    "agent_md",
    "overrides_file",
    "out_dir",
    "fixtures_dir",
]

_DEFAULTS = {
    "ios_root": "sample-ios",
    "android_root": "sample-android",
    "tokens_file": "design-tokens/tokens.json",
    "conventions": "conventions/conventions.yaml",
    "agent_md": "agent.md",
    "overrides_file": "out/overrides.jsonl",
    "out_dir": "out",
    "fixtures_dir": "examples/fixtures",
}


def load_config(path: str | Path) -> Config:
    path = Path(path).resolve()
    data = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    root = path.parent
    for field in _PATH_FIELDS:
        raw = data.get(field, _DEFAULTS[field])
        p = Path(raw)
        data[field] = p if p.is_absolute() else root / p
    data["root"] = root
    return Config.model_validate(data)
