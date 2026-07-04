"""Command-line interface for unitem.

Subcommands:
  index     Discover files and build the UI-screen inventory.
  map       Generate (or refresh) the iOS<->Android screen mapping.
  analyze   Launch Cursor agents per section and collect findings.
  report    Aggregate findings into tickets.json + report.html/md.
  run       index -> map -> analyze -> report in one shot.
  dispatch  Show (dry-run) the PR-dispatch payloads for a report.
"""

from __future__ import annotations

import json
import logging
import sys
from pathlib import Path
from typing import Optional

import click

from . import __version__
from .aggregate import aggregate
from .analyze import analyze_mapping
from .config import UnitemConfig, load_config, validate_inputs
from .cursor_runner import CliCursorRunner, CursorRunner, MockCursorRunner
from .discovery import build_inventory
from .dispatch import dry_run as dispatch_dry_run
from .dispatch import load_report
from .mapping import apply_overrides, generate_mapping, load_mapping, save_mapping
from .report import write_html, write_json, write_markdown
from .schema import Inventory

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
logger = logging.getLogger("unitem")


def _mock_responder(prompt: str, cwd: Path) -> str:
    """Offline demo analyzer used by ``--mock``.

    Real analysis uses the Cursor CLI. This deterministic stand-in compares the
    spacing signals already extracted into the prompt so ``unitem run --mock``
    produces tangible tickets on the example without an API key. It is a demo,
    not a substitute for the LLM review (tests inject their own responders).
    """

    import json as _json
    import re as _re

    def _nums(label: str) -> set[float]:
        m = _re.search(rf"{label}:\s*(.+)", prompt)
        if not m:
            return set()
        out: set[float] = set()
        for tok in m.group(1).split(","):
            tok = tok.strip()
            try:
                out.add(float(tok))
            except ValueError:
                continue
        return out

    fm = _re.search(r"Feature name:\s*(.+)", prompt)
    feature = fm.group(1).strip() if fm else "Unknown"

    findings = []
    ios_sp, and_sp = _nums("iOS spacing values"), _nums("Android spacing values")
    if ios_sp and and_sp and ios_sp != and_sp:
        findings.append(
            {
                "category": "spacing",
                "severity": "medium",
                "kind": "inconsistency",
                "title": "Spacing values differ between platforms",
                "description": (
                    f"iOS uses spacing {sorted(ios_sp)} while Android uses "
                    f"{sorted(and_sp)}."
                ),
                "rationale": "agent.md requires a shared spacing scale (8pt grid).",
                "suggested_fix": "Align the platforms to the same spacing constants.",
                "platforms": ["ios", "android"],
                "confidence": 0.7,
            }
        )
    return _json.dumps({"findings": findings})


def _make_runner(cfg: UnitemConfig, mock: bool, stream: bool = False) -> CursorRunner:
    if mock:
        return MockCursorRunner(_mock_responder)
    return CliCursorRunner(
        command=cfg.cursor_command,
        model=cfg.model,
        timeout_seconds=cfg.timeout_seconds,
        max_retries=cfg.max_retries,
        stream=stream,
    )


def _summarize_event(event: dict) -> str:
    """Turn a stream-json event into a short one-line description."""

    etype = event.get("type", "event")
    subtype = event.get("subtype")
    if etype == "tool_call" or "tool" in etype:
        name = event.get("name") or event.get("tool") or subtype or "tool"
        status = event.get("status") or subtype or ""
        return f"tool {name} {status}".strip()
    if etype == "assistant":
        from .cursor_runner import _event_text

        text = _event_text(event).strip().replace("\n", " ")
        return f"message: {text[:120]}" if text else "message"
    if etype == "result":
        return "result received"
    return f"{etype}{('/' + subtype) if subtype else ''}"


def _make_event_printer():
    def _printer(entry, event) -> None:
        click.echo(f"    [{entry.feature}] {_summarize_event(event)}")

    return _printer


def _load(config: str) -> UnitemConfig:
    cfg = load_config(config)
    problems = validate_inputs(cfg)
    if problems:
        for p in problems:
            logger.error(p)
        raise click.ClickException("Invalid inputs; fix unitem.yaml paths.")
    return cfg


def _inventory_path(cfg: UnitemConfig) -> Path:
    return cfg.output_dir / "inventory.json"


def _mapping_path(cfg: UnitemConfig) -> Path:
    return cfg.output_dir / "mapping.json"


def _findings_path(cfg: UnitemConfig) -> Path:
    return cfg.output_dir / "findings.json"


@click.group()
@click.version_option(__version__, prog_name="unitem")
def main() -> None:
    """Cross-platform (iOS/Android) UI consistency analyzer."""


@main.command()
@click.option("-c", "--config", default="unitem.yaml", help="Path to unitem.yaml")
def index(config: str) -> None:
    """Discover files and build the UI-screen inventory."""

    cfg = _load(config)
    inventory = build_inventory(cfg)
    _inventory_path(cfg).parent.mkdir(parents=True, exist_ok=True)
    _inventory_path(cfg).write_text(json.dumps(inventory.model_dump(mode="json"), indent=2))
    click.echo(
        f"Indexed {len(inventory.files)} files; "
        f"{len(inventory.ios_screens)} iOS screens, "
        f"{len(inventory.android_screens)} Android screens -> {_inventory_path(cfg)}"
    )


@main.command()
@click.option("-c", "--config", default="unitem.yaml", help="Path to unitem.yaml")
def map(config: str) -> None:
    """Generate the iOS<->Android screen mapping."""

    cfg = _load(config)
    inv_path = _inventory_path(cfg)
    if inv_path.exists():
        inventory = Inventory(**json.loads(inv_path.read_text()))
    else:
        inventory = build_inventory(cfg)
    mapping = generate_mapping(inventory, cfg)
    mapping = apply_overrides(mapping, cfg.mapping_overrides_path)
    save_mapping(mapping, _mapping_path(cfg))
    click.echo(
        f"Mapped {len(mapping.entries)} features; "
        f"unmatched iOS: {len(mapping.unmatched_ios)}, "
        f"unmatched Android: {len(mapping.unmatched_android)} -> {_mapping_path(cfg)}"
    )


@main.command()
@click.option("-c", "--config", default="unitem.yaml", help="Path to unitem.yaml")
@click.option("--mock", is_flag=True, help="Use the offline mock runner (no API key).")
@click.option("-v", "--verbose", is_flag=True, help="Stream each agent's steps live.")
def analyze(config: str, mock: bool, verbose: bool) -> None:
    """Launch Cursor agents per section and collect findings."""

    cfg = _load(config)
    mapping_path = _mapping_path(cfg)
    if not mapping_path.exists():
        raise click.ClickException("No mapping.json found. Run `unitem map` first.")
    mapping = load_mapping(mapping_path)
    agent_md = cfg.agent_md_path.read_text()
    runner = _make_runner(cfg, mock, stream=verbose)
    click.echo(f"Launching {len(mapping.entries)} agent(s) (concurrency={cfg.concurrency})...")

    def _progress(entry, findings):
        click.echo(f"  {entry.feature}: {len(findings)} finding(s)")

    on_event = _make_event_printer() if verbose else None
    findings = analyze_mapping(
        mapping, agent_md, cfg, runner, progress=_progress, on_event=on_event
    )
    _findings_path(cfg).parent.mkdir(parents=True, exist_ok=True)
    _findings_path(cfg).write_text(
        json.dumps([f.model_dump(mode="json") for f in findings], indent=2)
    )
    click.echo(f"Collected {len(findings)} finding(s) -> {_findings_path(cfg)}")


@main.command()
@click.option("-c", "--config", default="unitem.yaml", help="Path to unitem.yaml")
def report(config: str) -> None:
    """Aggregate findings into tickets.json + report.html/md."""

    cfg = _load(config)
    findings_path = _findings_path(cfg)
    if not findings_path.exists():
        raise click.ClickException("No findings.json found. Run `unitem analyze` first.")
    from .schema import Finding

    raw = json.loads(findings_path.read_text())
    findings = [Finding(**f) for f in raw]
    report_obj = aggregate(findings, cfg)
    write_json(report_obj, cfg.output_dir / "tickets.json")
    write_markdown(report_obj, cfg.output_dir / "report.md")
    write_html(report_obj, cfg.output_dir / "report.html")
    click.echo(
        f"{len(report_obj.tickets)} ticket(s), "
        f"{report_obj.expected_native_count} expected-native -> {cfg.output_dir}"
    )


@main.command()
@click.option("-c", "--config", default="unitem.yaml", help="Path to unitem.yaml")
@click.option("--mock", is_flag=True, help="Use the offline mock runner (no API key).")
@click.option("-v", "--verbose", is_flag=True, help="Stream each agent's steps live.")
def run(config: str, mock: bool, verbose: bool) -> None:
    """Run the full pipeline: index -> map -> analyze -> report."""

    cfg = _load(config)

    click.echo("[1/4] index: discovering files and screens...")
    inventory = build_inventory(cfg)
    _inventory_path(cfg).parent.mkdir(parents=True, exist_ok=True)
    _inventory_path(cfg).write_text(json.dumps(inventory.model_dump(mode="json"), indent=2))
    click.echo(
        f"      {len(inventory.files)} files; "
        f"{len(inventory.ios_screens)} iOS / {len(inventory.android_screens)} Android screens "
        f"-> {_inventory_path(cfg)}"
    )

    click.echo("[2/4] map: correlating iOS <-> Android screens...")
    mapping = generate_mapping(inventory, cfg)
    mapping = apply_overrides(mapping, cfg.mapping_overrides_path)
    save_mapping(mapping, _mapping_path(cfg))
    click.echo(
        f"      {len(mapping.entries)} feature(s) mapped; "
        f"{len(mapping.unmatched_ios)} iOS / {len(mapping.unmatched_android)} Android unmatched "
        f"-> {_mapping_path(cfg)}"
    )

    click.echo(
        f"[3/4] analyze: launching {len(mapping.entries)} agent(s) "
        f"(concurrency={cfg.concurrency})..."
    )
    agent_md = cfg.agent_md_path.read_text()
    runner = _make_runner(cfg, mock, stream=verbose)

    def _progress(entry, findings):
        click.echo(f"      {entry.feature}: {len(findings)} finding(s)")

    on_event = _make_event_printer() if verbose else None
    findings = analyze_mapping(
        mapping, agent_md, cfg, runner, progress=_progress, on_event=on_event
    )
    _findings_path(cfg).write_text(
        json.dumps([f.model_dump(mode="json") for f in findings], indent=2)
    )

    click.echo("[4/4] report: aggregating findings into tickets...")
    report_obj = aggregate(findings, cfg)
    write_json(report_obj, cfg.output_dir / "tickets.json")
    write_markdown(report_obj, cfg.output_dir / "report.md")
    write_html(report_obj, cfg.output_dir / "report.html")
    click.echo(
        f"Done: {len(report_obj.tickets)} ticket(s), "
        f"{report_obj.expected_native_count} expected-native -> {cfg.output_dir}"
    )


@main.command()
@click.option("-c", "--config", default="unitem.yaml", help="Path to unitem.yaml")
@click.option("--repo-url", required=True, help="Repo URL the PR-dispatch agent would target.")
@click.option("--starting-ref", default="main", help="Base ref for dispatched agents.")
def dispatch(config: str, repo_url: str, starting_ref: str) -> None:
    """Dry-run: show the Cloud Agents API payloads for each ticket (no PRs)."""

    cfg = _load(config)
    tickets_path = cfg.output_dir / "tickets.json"
    if not tickets_path.exists():
        raise click.ClickException("No tickets.json found. Run `unitem report` first.")
    report_obj = load_report(tickets_path)
    payloads = dispatch_dry_run(report_obj, repo_url, starting_ref)
    click.echo(json.dumps(payloads, indent=2))
    click.echo(
        f"\n[dry-run] Would POST {len(payloads)} agent run(s) to "
        f"https://api.cursor.com/v1/agents. No requests were sent.",
        err=True,
    )


if __name__ == "__main__":
    sys.exit(main())
