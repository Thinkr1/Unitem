from unitem.aggregate import assign_ids, dedupe, sort_tickets
from unitem.schema import AtomicChange, Location, Ticket, TicketFile


def _ticket(name: str, verdict: str, severity: str = "high") -> Ticket:
    change = AtomicChange(
        kind="token",
        category="color",
        name=name,
        before="#000000",
        after="#FFFFFF",
        origin_platform="ios",
        location=Location(file="Theme.swift", line=1),
    )
    return Ticket(
        id=change.id,
        mode="diff",
        category="color",
        change=change,
        verdict=verdict,
        severity=severity,
        confidence=0.9,
        reason="r",
        convention_refs=[],
    )


def test_ids_stable_across_runs():
    first = assign_ids([_ticket("color.a", "flag"), _ticket("color.b", "propagate")])
    previous = TicketFile(run_id="r1", mode="diff", screen="login", tickets=first)
    second = assign_ids(
        [_ticket("color.b", "propagate"), _ticket("color.c", "hold")], previous
    )
    by_name = {t.change.name: t.id for t in second}
    assert by_name["color.b"] == next(
        t.id for t in first if t.change.name == "color.b"
    )
    assert by_name["color.c"] == "UNI-003"  # continues after the highest known


def test_dedupe_and_sort():
    tickets = [
        _ticket("color.x", "hold", "low"),
        _ticket("color.x", "hold", "low"),
        _ticket("color.y", "propagate"),
        _ticket("color.z", "flag"),
    ]
    result = sort_tickets(dedupe(tickets))
    assert [t.verdict for t in result] == ["propagate", "flag", "hold"]
