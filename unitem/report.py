"""Render the ticket report to JSON, Markdown, and HTML."""

from __future__ import annotations

import json
from importlib import resources
from pathlib import Path

from jinja2 import Environment

from .schema import TicketReport


def write_json(report: TicketReport, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(report.model_dump(mode="json"), indent=2))


def render_markdown(report: TicketReport) -> str:
    lines: list[str] = []
    lines.append("# Unitem Consistency Report")
    lines.append("")
    lines.append(f"- Generated: {report.generated_at}")
    lines.append(f"- iOS: `{report.ios_path}`")
    lines.append(f"- Android: `{report.android_path}`")
    lines.append(f"- Tickets: **{len(report.tickets)}**")
    lines.append(f"- Expected-native differences (not ticketed): {report.expected_native_count}")
    lines.append("")

    if not report.tickets:
        lines.append("No inconsistencies found. Both platforms are consistent per the design principles.")
        return "\n".join(lines) + "\n"

    lines.append("| ID | Severity | Feature | Category | Issue |")
    lines.append("| --- | --- | --- | --- | --- |")
    for t in report.tickets:
        issue = t.title.replace("|", "\\|")
        lines.append(
            f"| {t.id} | {t.severity.value} | {t.feature} | {t.category.value} | {issue} |"
        )
    lines.append("")

    for t in report.tickets:
        lines.append(f"## {t.id}: {t.title}")
        lines.append("")
        lines.append(f"- Feature: {t.feature}")
        lines.append(f"- Severity: {t.severity.value} / Category: {t.category.value}")
        lines.append(f"- Platforms: {', '.join(p.value for p in t.platforms)}")
        lines.append(f"- Confidence: {t.confidence}")
        lines.append("")
        lines.append(t.description)
        lines.append("")
        if t.rationale:
            lines.append(f"**Why:** {t.rationale}")
            lines.append("")
        if t.suggested_fix:
            lines.append(f"**Suggested fix:** {t.suggested_fix}")
            lines.append("")
        if t.locations:
            lines.append("**Locations:**")
            for l in t.locations:
                loc = f"{l.platform.value}: `{l.file}`"
                if l.line:
                    loc += f":{l.line}"
                lines.append(f"- {loc}")
                if l.snippet:
                    lines.append(f"  ```")
                    lines.append(f"  {l.snippet}")
                    lines.append(f"  ```")
            lines.append("")
    return "\n".join(lines) + "\n"


def write_markdown(report: TicketReport, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(render_markdown(report))


def render_html(report: TicketReport) -> str:
    template_text = resources.files("unitem.templates").joinpath("report.html.j2").read_text()
    env = Environment(autoescape=True)
    template = env.from_string(template_text)
    return template.render(report=report)


def write_html(report: TicketReport, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(render_html(report))
