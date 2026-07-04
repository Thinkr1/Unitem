"""The judgment stage: rule retrieval, prompt building, and the classifier fan-out.

Deterministic front-end, LLM brain: everything here except the runner call is
plain code. A failed/invalid LLM call degrades to a low-confidence flag ticket
— the pipeline never crashes on a bad model response.
"""
from __future__ import annotations

import difflib
import json
import re
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field
from pathlib import Path

import yaml

from .runner.base import Runner, RunnerError, run_json
from .schema import (
    AtomicChange,
    JudgeResponse,
    OverrideRecord,
    Rule,
    Ticket,
)

_PROMPT_TEMPLATE = Path(__file__).parent / "prompts" / "classifier.md"

# Fallback archetypes: when retrieval scores nothing, show one rule per verdict
# so the model always sees all three options grounded.
_ARCHETYPE_IDS = ["propagate/brand-color", "hold/native-switch", "flag/hardcoded-color"]


@dataclass
class JudgeContext:
    rules: list[Rule]
    agent_md: str = ""
    overrides: list[OverrideRecord] = field(default_factory=list)
    mode: str = "diff"
    counterpart_slices: dict[str, str] = field(default_factory=dict)  # change.id -> code
    dump_dir: Path | None = None
    record_dir: Path | None = None
    timeout_s: int = 120


# ── knowledge loading ────────────────────────────────────────────────────────


def load_rules(path: Path) -> list[Rule]:
    if not Path(path).is_file():
        return []
    data = yaml.safe_load(Path(path).read_text(encoding="utf-8")) or {}
    return [Rule.model_validate(r) for r in data.get("rules", [])]


def load_overrides(path: Path) -> list[OverrideRecord]:
    path = Path(path)
    if not path.is_file():
        return []
    records = []
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line:
            records.append(OverrideRecord.model_validate_json(line))
    return records


# ── retrieval (no vector DB: category match + keyword overlap) ──────────────


def _tokens(text: str) -> set[str]:
    return {t for t in re.split(r"[^a-zA-Z]+", text.lower()) if len(t) > 2}


def retrieve_rules(change: AtomicChange, rules: list[Rule], k: int = 4) -> list[Rule]:
    change_tokens = _tokens(f"{change.name} {change.kind} {change.snippet}")
    scored = []
    for rule in rules:
        score = 3 if change.category in rule.applies_to else 0
        score += len(change_tokens & _tokens(f"{rule.id} {rule.when}"))
        if score >= 3:
            scored.append((score, rule))
    scored.sort(key=lambda pair: -pair[0])
    top = [rule for _, rule in scored[:k]]
    if top:
        return top
    return [r for r in rules if r.id in _ARCHETYPE_IDS]


def retrieve_precedents(
    change: AtomicChange, overrides: list[OverrideRecord], k: int = 3
) -> list[OverrideRecord]:
    same_category = [o for o in overrides if o.category == change.category]
    same_category.sort(
        key=lambda o: difflib.SequenceMatcher(None, o.change_name, change.name).ratio(),
        reverse=True,
    )
    return same_category[:k]


# ── deterministic checks (cheap rigor that grounds verdicts in numbers) ─────


def _luminance(hex_color: str) -> float:
    hex_color = hex_color.lstrip("#")
    channels = []
    for i in (0, 2, 4):
        c = int(hex_color[i : i + 2], 16) / 255
        channels.append(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4)
    r, g, b = channels
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def contrast_ratio(fg_hex: str, bg_hex: str) -> float:
    l1, l2 = sorted((_luminance(fg_hex), _luminance(bg_hex)), reverse=True)
    return (l1 + 0.05) / (l2 + 0.05)


def on_scale(value: float, scale: list[float]) -> bool:
    return any(abs(value - s) < 1e-6 for s in scale)


_HEX_RE = re.compile(r"^#[0-9A-Fa-f]{6}$")


def checks_for(change: AtomicChange, surface_hex: str = "#FFFFFF") -> list[str]:
    results = []
    if change.category == "color" and _HEX_RE.match(change.after or ""):
        ratio = contrast_ratio(change.after, surface_hex)
        verdict = "AA pass" if ratio >= 4.5 else "AA FAIL"
        results.append(
            f"WCAG contrast of {change.after} on surface {surface_hex} = {ratio:.2f} ({verdict} for body text)"
        )
    if change.category == "spacing":
        try:
            value = float(change.after)
            scale = [4, 8, 12, 16, 24, 32, 48]
            state = "ON" if on_scale(value, scale) else "NOT on"
            results.append(f"value {change.after} is {state} the spacing scale {scale}")
        except ValueError:
            pass
    return results


# ── prompt building ──────────────────────────────────────────────────────────


def build_prompt(change: AtomicChange, ctx: JudgeContext) -> str:
    template = _PROMPT_TEMPLATE.read_text(encoding="utf-8")
    rules = retrieve_rules(change, ctx.rules)
    precedents = retrieve_precedents(change, ctx.overrides)
    rules_yaml = yaml.safe_dump(
        [r.model_dump() for r in rules], sort_keys=False, allow_unicode=True
    )
    precedent_lines = [
        f"- On \"{p.change_name}\" ({p.category}), the engine said {p.engine_verdict} "
        f"but the team corrected it to **{p.human_verdict}**"
        + (f" — note: {p.note}" if p.note else "")
        for p in precedents
    ]
    other = "android" if change.origin_platform == "ios" else "ios"
    counterpart_file = (
        change.counterpart_location.file if change.counterpart_location else "(unknown)"
    )
    checks = checks_for(change)
    return (
        template.replace("{change_json}", change.model_dump_json(indent=2))
        .replace("{snippet}", change.snippet or "(no snippet)")
        .replace("{other_platform}", other)
        .replace("{counterpart_file}", counterpart_file)
        .replace("{counterpart_slice}", ctx.counterpart_slices.get(change.id, "(not available)"))
        .replace("{checks}", "\n".join(checks) if checks else "(none applicable)")
        .replace("{rules_yaml}", rules_yaml if rules else "(no rules matched)")
        .replace("{agent_md}", ctx.agent_md or "(no project spec provided)")
        .replace("{precedents}", "\n".join(precedent_lines) if precedent_lines else "(none)")
    )


# ── the judge itself ─────────────────────────────────────────────────────────


def _degrade_ticket(change: AtomicChange, ctx: JudgeContext, why: str) -> Ticket:
    return Ticket(
        id=change.id,  # temporary; aggregate.assign_ids gives the final UNI-NNN
        mode=ctx.mode,  # type: ignore[arg-type]
        category=change.category,
        change=change,
        verdict="flag",
        severity="low",
        confidence=0.3,
        reason=f"Automatic judgment unavailable ({why}); deferring to a human reviewer.",
        convention_refs=[],
    )


def judge_change(change: AtomicChange, ctx: JudgeContext, runner: Runner) -> Ticket:
    prompt = build_prompt(change, ctx)
    if ctx.dump_dir:
        ctx.dump_dir.mkdir(parents=True, exist_ok=True)
        (ctx.dump_dir / f"{change.id}.md").write_text(prompt, encoding="utf-8")
    try:
        response = run_json(
            runner, prompt, JudgeResponse, key=change.id, timeout_s=ctx.timeout_s
        )
    except RunnerError as err:
        return _degrade_ticket(change, ctx, str(err)[:200])
    if ctx.record_dir and runner.name != "mock":
        ctx.record_dir.mkdir(parents=True, exist_ok=True)
        (ctx.record_dir / f"{change.id}.json").write_text(
            response.model_dump_json(indent=2), encoding="utf-8"
        )
    return Ticket(
        id=change.id,
        mode=ctx.mode,  # type: ignore[arg-type]
        category=change.category,
        change=change,
        verdict=response.verdict,
        severity=response.severity,
        confidence=response.confidence,
        reason=response.reason,
        convention_refs=response.convention_refs,
        expected=response.expected,
        required_dependencies=response.required_dependencies,
    )


def judge_all(
    changes: list[AtomicChange],
    ctx: JudgeContext,
    runner: Runner,
    concurrency: int = 4,
    on_result=None,
) -> list[Ticket]:
    if not changes:
        return []

    def _one(change: AtomicChange) -> Ticket:
        ticket = judge_change(change, ctx, runner)
        if on_result:
            on_result(ticket)
        return ticket

    with ThreadPoolExecutor(max_workers=max(1, concurrency)) as pool:
        return list(pool.map(_one, changes))
