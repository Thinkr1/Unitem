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
    """Offline responder: emits an empty finding set.

    Real analysis uses the Cursor CLI. The mock keeps the pipeline runnable
    without an API key (tests inject their own richer responders).
    """

    return '{"findings": []}'


def _make_runner(cfg: UnitemConfig, mock: bool) -> CursorRunner:
    if mock:
        return MockCursorRunner(_mock_responder)
    return CliCursorRunner(
        command=cfg.cursor_command,
        model=cfg.model,
        timeout_seconds=cfg.timeout_seconds,
        max_retries=cfg.max_retries,
    )


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
def analyze(config: str, mock: bool) -> None:
    """Launch Cursor agents per section and collect findings."""

    cfg = _load(config)
    mapping_path = _mapping_path(cfg)
    if not mapping_path.exists():
        raise click.ClickException("No mapping.json found. Run `unitem map` first.")
    mapping = load_mapping(mapping_path)
    agent_md = cfg.agent_md_path.read_text()
    runner = _make_runner(cfg, mock)

    def _progress(entry, findings):
        click.echo(f"  {entry.feature}: {len(findings)} finding(s)")

    findings = analyze_mapping(mapping, agent_md, cfg, runner, progress=_progress)
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
def run(config: str, mock: bool) -> None:
    """Run the full pipeline: index -> map -> analyze -> report."""

    cfg = _load(config)
    inventory = build_inventory(cfg)
    _inventory_path(cfg).parent.mkdir(parents=True, exist_ok=True)
    _inventory_path(cfg).write_text(json.dumps(inventory.model_dump(mode="json"), indent=2))
    click.echo(
        f"Indexed {len(inventory.files)} files; "
        f"{len(inventory.ios_screens)} iOS / {len(inventory.android_screens)} Android screens."
    )

    mapping = generate_mapping(inventory, cfg)
    mapping = apply_overrides(mapping, cfg.mapping_overrides_path)
    save_mapping(mapping, _mapping_path(cfg))
    click.echo(f"Mapped {len(mapping.entries)} features.")

    agent_md = cfg.agent_md_path.read_text()
    runner = _make_runner(cfg, mock)

    def _progress(entry, findings):
        click.echo(f"  {entry.feature}: {len(findings)} finding(s)")

    findings = analyze_mapping(mapping, agent_md, cfg, runner, progress=_progress)

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
