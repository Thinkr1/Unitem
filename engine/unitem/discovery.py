"""Walk both source trees and extract design facts (deterministic, no LLM)."""
from __future__ import annotations

from pathlib import Path

from .config import Config
from .extractors import DesignFact, extract_file
from .schema import Platform

_EXTENSIONS = {"ios": ["*.swift"], "android": ["*.kt", "*.dart"]}


def discover_platform(cfg: Config, platform: Platform) -> list[DesignFact]:
    root = cfg.ios_root if platform == "ios" else cfg.android_root
    if not root.is_dir():
        return []
    facts: list[DesignFact] = []
    for pattern in _EXTENSIONS[platform]:
        for path in sorted(root.rglob(pattern)):
            facts.extend(extract_file(path, platform, rel_to=cfg.root))
    return facts


def discover(cfg: Config) -> dict[Platform, list[DesignFact]]:
    return {"ios": discover_platform(cfg, "ios"), "android": discover_platform(cfg, "android")}


def token_values(facts: list[DesignFact]) -> dict[str, str]:
    """normalized token name -> current value (token_def facts only)."""
    return {f.name.lower(): f.value for f in facts if f.kind == "token_def" and f.name}


def find_token_def(facts: list[DesignFact], name: str) -> DesignFact | None:
    wanted = name.lower()
    for fact in facts:
        if fact.kind == "token_def" and fact.name and fact.name.lower() == wanted:
            return fact
    return None
