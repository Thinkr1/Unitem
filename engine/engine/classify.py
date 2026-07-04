"""LLM-backed classifier — uses convention KB. Call via API or Cursor classifier subagent."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import yaml

REPO_ROOT = Path(__file__).resolve().parents[2]
CONVENTIONS_PATH = REPO_ROOT / "knowledge-base" / "conventions.yaml"


def load_conventions() -> list[dict[str, Any]]:
    data = yaml.safe_load(CONVENTIONS_PATH.read_text())
    return data.get("rules", [])


def match_rules(change: dict[str, Any], rules: list[dict[str, Any]]) -> list[dict[str, Any]]:
    kind = change.get("kind", "")
    matched = [r for r in rules if kind in r.get("applies_to", []) or "token" in r.get("applies_to", [])]
    return matched or rules


def classify_stub(change: dict[str, Any]) -> dict[str, Any]:
    """Deterministic stub for demo when no LLM key — real path uses Claude via API."""
    rules = load_conventions()
    matched = match_rules(change, rules)
    name = change.get("name", "")

    if "color.primary" in name or "brand" in name.lower():
        rule = next((r for r in matched if r["id"] == "propagate/brand-color"), matched[0] if matched else None)
        if rule:
            return {
                "verdict": rule["verdict"],
                "confidence": 0.92,
                "reason": rule["why"],
                "convention_refs": [rule["id"]],
            }

    if change.get("kind") == "component" and "switch" in str(change.get("name", "")).lower():
        rule = next((r for r in rules if r["id"] == "hold/native-switch"), None)
        if rule:
            return {
                "verdict": "hold",
                "confidence": 0.95,
                "reason": rule["why"],
                "convention_refs": [rule["id"]],
            }

    return {
        "verdict": "flag",
        "confidence": 0.6,
        "reason": "Could not match confidently; defaulting to flag for human review.",
        "convention_refs": [],
    }


def build_ticket(change: dict[str, Any], classification: dict[str, Any]) -> dict[str, Any]:
    ticket: dict[str, Any] = {
        "id": f"ticket_{change['id'].split('_')[-1]}",
        "change": change,
        "verdict": classification["verdict"],
        "confidence": classification["confidence"],
        "reason": classification["reason"],
        "convention_refs": classification["convention_refs"],
        "status": "pending",
    }
    if classification["verdict"] == "propagate" and "color.primary" in change.get("name", ""):
        ticket["proposed_fix"] = {
            "target_platform": "android",
            "file": "sample-android/app/src/main/java/com/unitem/settings/Color.kt",
            "diff": f"- val Primary = Color(0xFF{change['before'].lstrip('#')})\n+ val Primary = Color(0xFF{change['after'].lstrip('#')})",
        }
    return ticket
