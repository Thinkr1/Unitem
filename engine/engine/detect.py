"""Deterministic diff detection for tokens and mapped screen files."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parents[2]
KB_DIR = REPO_ROOT / "knowledge-base"
SCREEN_MAP_PATH = REPO_ROOT / "engine" / "screen-map.json"


def _flatten_tokens(obj: dict[str, Any], prefix: str = "") -> dict[str, str]:
    out: dict[str, str] = {}
    for key, value in obj.items():
        path = f"{prefix}.{key}" if prefix else key
        if isinstance(value, dict):
            out.update(_flatten_tokens(value, path))
        else:
            out[path] = str(value)
    return out


def diff_token_files(before_path: Path, after_path: Path) -> list[dict[str, Any]]:
    before = _flatten_tokens(json.loads(before_path.read_text()))
    after = _flatten_tokens(json.loads(after_path.read_text()))
    changes: list[dict[str, Any]] = []
    keys = sorted(set(before) | set(after))
    for idx, key in enumerate(keys, start=1):
        b, a = before.get(key), after.get(key)
        if b != a:
            changes.append(
                {
                    "id": f"change_{idx:03d}",
                    "kind": "color" if "color" in key else "spacing" if "spacing" in key or "radius" in key else "token",
                    "name": key,
                    "before": b,
                    "after": a,
                    "origin_platform": "ios",
                    "location": {"file": str(before_path.relative_to(REPO_ROOT)), "line": 0},
                }
            )
    return changes


def load_screen_map() -> dict[str, Any]:
    return json.loads(SCREEN_MAP_PATH.read_text())


def detect(screen: str = "Settings", mode: str = "token") -> list[dict[str, Any]]:
    if mode == "token":
        return diff_token_files(KB_DIR / "tokens-before.json", KB_DIR / "tokens-after.json")
    # Code-level: tree-sitter integration placeholder for Phase 3
    return []
