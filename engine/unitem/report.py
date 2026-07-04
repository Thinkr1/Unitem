"""tickets.json writing and a plain console summary."""
from __future__ import annotations

from pathlib import Path

from .schema import TicketFile


def load_tickets(path: Path) -> TicketFile | None:
    path = Path(path)
    if not path.is_file():
        return None
    return TicketFile.model_validate_json(path.read_text(encoding="utf-8"))


def write_tickets(path: Path, ticket_file: TicketFile) -> None:
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(ticket_file.model_dump_json(indent=2), encoding="utf-8")


_VERDICT_MARK = {"propagate": "->", "hold": "==", "flag": "!!"}


def print_summary(ticket_file: TicketFile) -> None:
    print(f"\nunitem {ticket_file.mode} · screen: {ticket_file.screen} · run: {ticket_file.run_id}")
    print("-" * 78)
    for t in ticket_file.tickets:
        mark = _VERDICT_MARK.get(t.verdict, "??")
        print(
            f"{t.id}  {mark} {t.verdict:<9} {t.severity:<6} {t.confidence:.2f}  "
            f"{t.change.name}  ({t.change.origin_platform}: {t.change.location.file}:{t.change.location.line})"
        )
        print(f"        {t.reason}")
        if t.convention_refs:
            print(f"        rules: {', '.join(t.convention_refs)}")
    counts: dict[str, int] = {}
    for t in ticket_file.tickets:
        counts[t.verdict] = counts.get(t.verdict, 0) + 1
    summary = " · ".join(f"{v}: {n}" for v, n in sorted(counts.items()))
    print("-" * 78)
    print(f"{len(ticket_file.tickets)} finding(s)  ({summary})\n")
