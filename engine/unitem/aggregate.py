"""Stable ticket IDs across re-runs, dedupe, and presentation ordering."""
from __future__ import annotations

import re

from .schema import Ticket, TicketFile

_VERDICT_ORDER = {"propagate": 0, "flag": 1, "hold": 2}
_SEVERITY_ORDER = {"high": 0, "medium": 1, "low": 2}


def dedupe(tickets: list[Ticket]) -> list[Ticket]:
    seen: set[str] = set()
    unique = []
    for ticket in tickets:
        if ticket.change.id not in seen:
            seen.add(ticket.change.id)
            unique.append(ticket)
    return unique


def assign_ids(tickets: list[Ticket], previous: TicketFile | None = None) -> list[Ticket]:
    """Re-runs keep their UNI-NNN ids: identity is the atomic change id."""
    known: dict[str, str] = {}
    highest = 0
    if previous:
        for old in previous.tickets:
            known[old.change.id] = old.id
            match = re.match(r"UNI-(\d+)", old.id)
            if match:
                highest = max(highest, int(match.group(1)))
    for ticket in tickets:
        if ticket.change.id in known:
            ticket.id = known[ticket.change.id]
        else:
            highest += 1
            ticket.id = f"UNI-{highest:03d}"
    return tickets


def sort_tickets(tickets: list[Ticket]) -> list[Ticket]:
    return sorted(
        tickets,
        key=lambda t: (
            _VERDICT_ORDER.get(t.verdict, 9),
            _SEVERITY_ORDER.get(t.severity, 9),
            -t.confidence,
        ),
    )
