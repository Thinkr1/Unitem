"""Handoff to the PR-dispatch phase (out of scope for this build).

This build produces tickets only. Turning a ticket into a pull request is a
separate phase owned elsewhere. This module documents the contract and provides
a ``--dry-run`` that prints exactly what would be sent to the Cursor Cloud
Agents API, so the two halves can be wired together later without guesswork.

Contract: the downstream dispatcher consumes ``tickets.json`` (a serialized
``TicketReport``). For each ticket it should create one Cloud Agent run scoped
to the affected platform repo(s).
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import List

from .schema import Ticket, TicketReport

CLOUD_AGENTS_ENDPOINT = "https://api.cursor.com/v1/agents"


def build_dispatch_payload(ticket: Ticket, repo_url: str, starting_ref: str = "main") -> dict:
    """Construct the Cloud Agents API request body for a single ticket.

    Mirrors POST https://api.cursor.com/v1/agents. Not sent here; returned for
    inspection / handoff.
    """

    files = "\n".join(f"- {l.platform.value}: {l.file}" for l in ticket.locations) or "- (see description)"
    prompt = (
        f"Fix cross-platform UI inconsistency {ticket.id} ({ticket.category.value}, "
        f"{ticket.severity.value}) in feature '{ticket.feature}'.\n\n"
        f"{ticket.description}\n\n"
        f"Suggested fix: {ticket.suggested_fix or 'make the platforms consistent per agent.md'}\n\n"
        f"Affected files:\n{files}\n\n"
        "Keep platform-native patterns intact; only fix the unintended inconsistency."
    )
    return {
        "prompt": {"text": prompt},
        "repos": [{"url": repo_url, "startingRef": starting_ref}],
        "metadata": {"unitem_ticket_id": ticket.id},
    }


def dry_run(report: TicketReport, repo_url: str, starting_ref: str = "main") -> List[dict]:
    return [build_dispatch_payload(t, repo_url, starting_ref) for t in report.tickets]


def load_report(path: Path) -> TicketReport:
    return TicketReport(**json.loads(path.read_text()))
