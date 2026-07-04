"""FastAPI serving the /UI review console (ARCHITECTURE.md §7).

The adapter emits the UI's current `types.ts` names verbatim
(`inconsistencies`, status open|resolved|ignored, severity error|warning|info);
every verdict-era field is additive and optional on the UI side.
"""
from __future__ import annotations

import json
import re
import threading
import time
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from .config import Config
from .report import load_tickets, write_tickets
from .schema import Location, OverrideRecord, Ticket, TicketFile, Verdict

_SEVERITY_TO_UI = {"high": "error", "medium": "warning", "low": "info"}
_STATUS_TO_UI = {"pending": "open", "accepted": "resolved", "overridden": "ignored"}


class OverrideBody(BaseModel):
    verdict: Verdict
    note: Optional[str] = None


class Store:
    """Tickets + source panels, persisted back to out/tickets.json on change."""

    def __init__(self, cfg: Config):
        self.cfg = cfg
        self.lock = threading.Lock()
        self.path = cfg.out_dir / "tickets.json"
        self.tickets: TicketFile = load_tickets(self.path) or TicketFile(
            run_id="empty", mode="diff", screen=cfg.screen, tickets=[]
        )

    def save(self) -> None:
        write_tickets(self.path, self.tickets)

    def find(self, ticket_id: str) -> Ticket:
        for ticket in self.tickets.tickets:
            if ticket.id == ticket_id:
                return ticket
        raise HTTPException(status_code=404, detail=f"no ticket {ticket_id}")


def humanize(name: str) -> str:
    """'color.brandPrimary' -> 'Brand primary'."""
    tail = name.split(".")[-1].split(" ")[0]
    words = re.sub(r"(?<!^)(?=[A-Z])", " ", tail).lower()
    return words[:1].upper() + words[1:]


def _read_value_at(cfg: Config, loc: Location | None) -> str:
    """Best-effort short value shown in the card's compact row."""
    if loc is None:
        return "—"
    path = Path(loc.file)
    if not path.is_absolute():
        path = cfg.root / loc.file
    if not path.is_file():
        return "—"
    lines = path.read_text(encoding="utf-8").splitlines()
    if not (1 <= loc.line <= len(lines)):
        return "—"
    line = lines[loc.line - 1]
    hex_match = re.search(r"#[0-9A-Fa-f]{6}|0xFF([0-9A-Fa-f]{6})", line)
    if hex_match:
        return "#" + hex_match.group(1) if hex_match.group(1) else hex_match.group(0)
    return line.strip()[:40]


def ticket_to_ui(ticket: Ticket, cfg: Config) -> dict:
    change = ticket.change
    origin_loc, counter_loc = change.location, change.counterpart_location
    if change.origin_platform == "ios":
        ios_loc, android_loc = origin_loc, counter_loc
    else:
        ios_loc, android_loc = counter_loc, origin_loc

    def side(loc: Location | None, is_origin: bool) -> dict:
        value = change.after if is_origin else _read_value_at(cfg, loc)
        return {"value": value, "line": loc.line if loc else 0}

    return {
        "id": ticket.id,
        "property": humanize(change.name),
        "severity": _SEVERITY_TO_UI[ticket.severity],
        "rule": ticket.reason,
        "expected": ticket.expected,
        "ios": side(ios_loc, change.origin_platform == "ios"),
        "android": side(android_loc, change.origin_platform == "android"),
        "status": _STATUS_TO_UI[ticket.status],
        # additive fields (UI/ARCHITECTURE-ALIGNMENT.md) — safe to ignore:
        "verdict": ticket.verdict,
        "confidence": ticket.confidence,
        "reason": ticket.reason,
        "conventionRefs": ticket.convention_refs,
        "originPlatform": change.origin_platform,
        "proposedFix": (
            {
                "targetPlatform": ticket.proposed_fix.target_platform,
                "file": ticket.proposed_fix.file,
                "diff": ticket.proposed_fix.diff,
            }
            if ticket.proposed_fix
            else None
        ),
        "prUrl": ticket.pr_url,
    }


def _panel(cfg: Config, platform: str, screen: str) -> dict:
    """Read the mapped screen file for one platform from mapping.json."""
    mapping_path = cfg.root / "examples" / "mapping.json"
    file: str | None = None
    if mapping_path.is_file():
        mapping = json.loads(mapping_path.read_text(encoding="utf-8"))
        for entry in mapping.get("screens", []):
            if entry["feature"] == screen and entry.get(platform):
                file = entry[platform][0]
                break
    if file is None:
        file = f"examples/{platform}/LoginView.swift"
    path = cfg.root / file
    return {
        "platform": platform,
        "language": "swift" if platform == "ios" else "kotlin",
        "fileName": Path(file).name,
        "code": path.read_text(encoding="utf-8") if path.is_file() else "// (file not found)",
    }


def _rulebook(cfg: Config) -> dict[str, str]:
    """Token table from agent.md's markdown table (name -> value)."""
    rulebook: dict[str, str] = {}
    text = cfg.read_agent_md()
    for match in re.finditer(r"^\|\s*([\w.]+)\s*\|\s*([^|]+?)\s*\|", text, re.MULTILINE):
        name, value = match.group(1), match.group(2)
        if name.lower() not in ("token",):
            rulebook[name] = value.strip().strip('"')
    return rulebook


def create_app(cfg: Config) -> FastAPI:
    app = FastAPI(title="unitem engine")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
        allow_methods=["*"],
        allow_headers=["*"],
    )
    store = Store(cfg)

    @app.get("/comparison")
    def comparison(screen: str = "login") -> dict:
        return {
            "screen": screen,
            "ios": _panel(cfg, "ios", screen),
            "android": _panel(cfg, "android", screen),
            "inconsistencies": [ticket_to_ui(t, cfg) for t in store.tickets.tickets],
            "rulebook": _rulebook(cfg),
        }

    @app.post("/findings/{ticket_id}/accept")
    def accept(ticket_id: str) -> dict:
        with store.lock:
            ticket = store.find(ticket_id)
            if ticket.status != "pending":
                raise HTTPException(status_code=409, detail=f"ticket is {ticket.status}")
            from .generate import apply_and_pr  # late import: generate lands in M7

            apply_and_pr(ticket, cfg)
            ticket.status = "accepted"
            store.save()
            return ticket_to_ui(ticket, cfg)

    @app.post("/findings/{ticket_id}/override")
    def override(ticket_id: str, body: OverrideBody) -> dict:
        with store.lock:
            ticket = store.find(ticket_id)
            record = OverrideRecord(
                ticket_id=ticket.id,
                change_name=ticket.change.name,
                category=ticket.category,
                engine_verdict=ticket.verdict,
                human_verdict=body.verdict,
                note=body.note,
                timestamp=time.strftime("%Y-%m-%dT%H:%M:%S"),
            )
            cfg.overrides_file.parent.mkdir(parents=True, exist_ok=True)
            with cfg.overrides_file.open("a", encoding="utf-8") as fh:
                fh.write(record.model_dump_json() + "\n")
            ticket.status = "overridden"
            store.save()
            return ticket_to_ui(ticket, cfg)

    return app
