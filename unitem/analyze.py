"""Analysis fan-out: one Cursor agent per mapped section.

For each mapping entry we build a scoped prompt (iOS files + Android files +
agent.md + strict schema), run a Cursor agent, parse the returned findings, and
validate them. Sections run concurrently with a bounded thread pool.
"""

from __future__ import annotations

import logging
from concurrent.futures import ThreadPoolExecutor, as_completed
from importlib import resources
from pathlib import Path
from typing import List, Optional

from .config import UnitemConfig
from .cursor_runner import CursorError, CursorRunner, extract_json
from .extractors import extract_signals
from .mapping import Mapping
from .schema import Finding, MappingEntry

logger = logging.getLogger("unitem.analyze")

_PROMPT_TEMPLATE = resources.files("unitem.prompts").joinpath("analyze_section.md").read_text()


def _read_files_block(paths: List[str], cfg: UnitemConfig) -> tuple[str, list[str], list[str]]:
    """Render a file block for the prompt and collect colors/spacings signals."""

    blocks: List[str] = []
    colors: list[str] = []
    spacings: list[str] = []
    for path_str in paths[: cfg.max_files_per_section]:
        path = Path(path_str)
        try:
            content = path.read_bytes()[: cfg.max_bytes_per_file].decode("utf-8", errors="ignore")
        except OSError:
            content = "<unreadable>"
        sig = extract_signals(content)
        colors += sig.colors
        spacings += sig.spacings
        blocks.append(f"### {path_str}\n```\n{content}\n```")
    return "\n\n".join(blocks) if blocks else "(none)", colors, spacings


def build_prompt(entry: MappingEntry, agent_md: str, cfg: UnitemConfig) -> str:
    ios_block, ios_colors, ios_spacings = _read_files_block(entry.ios, cfg)
    android_block, and_colors, and_spacings = _read_files_block(entry.android, cfg)
    return (
        _PROMPT_TEMPLATE.replace("<<AGENT_MD>>", agent_md)
        .replace("<<FEATURE>>", entry.feature)
        .replace("<<IOS_FILES>>", ios_block)
        .replace("<<ANDROID_FILES>>", android_block)
        .replace("<<IOS_COLORS>>", ", ".join(ios_colors) or "(none)")
        .replace("<<ANDROID_COLORS>>", ", ".join(and_colors) or "(none)")
        .replace("<<IOS_SPACINGS>>", ", ".join(ios_spacings) or "(none)")
        .replace("<<ANDROID_SPACINGS>>", ", ".join(and_spacings) or "(none)")
    )


def _parse_findings(entry: MappingEntry, text: str) -> List[Finding]:
    data = extract_json(text)
    if isinstance(data, dict):
        raw_findings = data.get("findings", [])
    elif isinstance(data, list):
        raw_findings = data
    else:
        raw_findings = []

    findings: List[Finding] = []
    for raw in raw_findings:
        if not isinstance(raw, dict):
            continue
        raw.setdefault("feature", entry.feature)
        try:
            findings.append(Finding(**raw))
        except Exception as exc:  # noqa: BLE001 - tolerate a bad finding, keep the rest
            logger.warning("Skipping malformed finding for %s: %s", entry.feature, exc)
    return findings


def analyze_entry(
    entry: MappingEntry,
    agent_md: str,
    cfg: UnitemConfig,
    runner: CursorRunner,
    cwd: Path,
) -> List[Finding]:
    prompt = build_prompt(entry, agent_md, cfg)
    try:
        result = runner.run(prompt, cwd)
    except CursorError as exc:
        logger.error("Agent run failed for %s: %s", entry.feature, exc)
        return []
    try:
        return _parse_findings(entry, result.text)
    except CursorError as exc:
        logger.error("Could not parse findings for %s: %s", entry.feature, exc)
        return []


def analyze_mapping(
    mapping: Mapping,
    agent_md: str,
    cfg: UnitemConfig,
    runner: CursorRunner,
    cwd: Optional[Path] = None,
    progress=None,
) -> List[Finding]:
    cwd = cwd or Path.cwd()
    findings: List[Finding] = []

    with ThreadPoolExecutor(max_workers=max(1, cfg.concurrency)) as pool:
        futures = {
            pool.submit(analyze_entry, entry, agent_md, cfg, runner, cwd): entry
            for entry in mapping.entries
        }
        for fut in as_completed(futures):
            entry = futures[fut]
            section_findings = fut.result()
            findings.extend(section_findings)
            if progress:
                progress(entry, section_findings)
    return findings
