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


class AnalyzeBody(BaseModel):
    iosCode: str
    androidCode: str
    screen: str = "pasted"


class Progress:
    """Live pipeline stage, polled by the UI's pipeline strip (GET /progress)."""

    def __init__(self):
        self.lock = threading.Lock()
        self.state = "idle"  # idle | running
        self.stage = ""  # discover | map | judge | fix | review
        self.detail = ""
        self.done = 0
        self.total = 0
        self.events: list[dict] = []  # rolling activity feed (the UI's "thinking" view)

    def event(self, text: str) -> None:
        with self.lock:
            self.events.append({"ts": time.strftime("%H:%M:%S"), "text": text})
            self.events = self.events[-50:]

    def set(self, stage: str, detail: str = "", done: int = 0, total: int = 0) -> None:
        with self.lock:
            self.state = "running"
            self.stage, self.detail, self.done, self.total = stage, detail, done, total
            self.events.append({"ts": time.strftime("%H:%M:%S"), "text": f"{stage}: {detail}"})
            self.events = self.events[-50:]

    def bump(self) -> None:
        with self.lock:
            self.done += 1

    def idle(self) -> None:
        with self.lock:
            self.state, self.stage, self.detail = "idle", "", ""
            self.done = self.total = 0

    def snapshot(self) -> dict:
        with self.lock:
            return {
                "state": self.state,
                "stage": self.stage,
                "detail": self.detail,
                "done": self.done,
                "total": self.total,
                "events": self.events[-15:],
            }


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


def _slice_for(cfg: Config, change) -> str:
    loc = change.counterpart_location
    path = cfg.root / loc.file
    if not path.is_file():
        return "(file not found)"
    lines = path.read_text(encoding="utf-8").splitlines()
    if len(lines) <= 80:
        return "\n".join(f"{i + 1:>4}  {t}" for i, t in enumerate(lines))
    lo, hi = max(0, loc.line - 16), min(len(lines), loc.line + 15)
    return "\n".join(f"{i + 1:>4}  {t}" for i, t in enumerate(lines[lo:hi], start=lo))


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
        if is_origin:
            value = change.after
        elif loc and loc.file.startswith("pasted/"):
            value = change.before or "—"  # pasted snippets aren't on disk
        else:
            value = _read_value_at(cfg, loc)
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
        "requiredDependencies": ticket.required_dependencies,
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


_SUFFIX_LANGUAGE = {".swift": "swift", ".kt": "kotlin", ".dart": "dart"}


def _panel(cfg: Config, platform: str, screen: str) -> dict:
    """Read the mapped screen file for one platform (live mapping, examples fallback)."""
    file: str | None = None
    from .discovery import discover
    from .mapping import build_mapping

    facts = discover(cfg)
    mapping = build_mapping(cfg, facts["ios"], facts["android"])
    for entry in mapping.screens:
        files = entry.ios if platform == "ios" else entry.android
        if entry.feature == screen and files:
            file = files[0]
            break
    if file is None:
        mapping_path = cfg.root / "examples" / "mapping.json"
        if mapping_path.is_file():
            data = json.loads(mapping_path.read_text(encoding="utf-8"))
            for entry in data.get("screens", []):
                if entry["feature"] == screen and entry.get(platform):
                    file = entry[platform][0]
                    break
    if file is None:
        file = f"examples/{platform}/LoginView.swift"
    path = cfg.root / file
    code = path.read_text(encoding="utf-8") if path.is_file() else "// (file not found)"
    panel = {
        "platform": platform,
        "language": _SUFFIX_LANGUAGE.get(Path(file).suffix, "swift"),
        "fileName": Path(file).name,
        "code": code,
    }
    theme_path = _theme_file(cfg, platform, Path(file).suffix)
    if theme_path is not None:
        panel["themeCode"] = theme_path.read_text(encoding="utf-8")
    if path.suffix == ".dart":
        preview = _flatten_dart_for_preview(code, path)
        if preview:
            panel["previewCode"] = preview
    return panel


def _theme_file(cfg: Config, platform: str, suffix: str) -> Path | None:
    """The platform's theme source, so previews resolve Theme.*/AppTheme.* live."""
    root = cfg.ios_root if platform == "ios" else cfg.android_root
    pattern = "Theme.swift" if platform == "ios" else ("theme.dart" if suffix == ".dart" else "Color.kt")
    return next(iter(sorted(root.rglob(pattern))), None)


def _flatten_dart_for_preview(code: str, screen_path: Path) -> str | None:
    """DartPad is a single-file sandbox: inline local imports (theme.dart) so
    the real screen actually compiles and renders in the preview."""
    local_imports = re.findall(r"import\s+'(?!package:)([^']+)';", code)
    if not local_imports:
        return None
    inlined_parts = []
    for rel in local_imports:
        dep = screen_path.parent / rel
        if not dep.is_file():
            return None
        dep_code = re.sub(r"import\s+'package:flutter/[^']+';\n?", "", dep.read_text(encoding="utf-8"))
        inlined_parts.append(dep_code.strip())
    flattened = re.sub(r"import\s+'(?!package:)[^']+';\n?", "", code)
    # DartPad has no asset bundle — swap asset images for the same placeholder
    # tile the iOS preview draws, so both panels show an identical stand-in.
    from .transfer import _IMAGE_ASSET_RE, LOGO_PLACEHOLDER_DART

    flattened = _IMAGE_ASSET_RE.sub(LOGO_PLACEHOLDER_DART, flattened)
    return flattened.rstrip() + "\n\n// ── inlined for preview ──\n" + "\n\n".join(inlined_parts) + "\n"


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
    progress = Progress()

    @app.get("/progress")
    def get_progress() -> dict:
        return progress.snapshot()

    @app.get("/comparison")
    def comparison(screen: str = "login") -> dict:
        return {
            "screen": screen,
            "ios": _panel(cfg, "ios", screen),
            "android": _panel(cfg, "android", screen),
            "inconsistencies": [ticket_to_ui(t, cfg) for t in store.tickets.tickets],
            "rulebook": _rulebook(cfg),
        }

    @app.post("/rescan")
    def rescan(screen: str = "login") -> dict:
        """Run the full pipeline live: discover -> map -> judge fan-out -> fix previews.
        With runner=cursor this spawns one agent per change (takes a minute);
        with runner=mock it replays recorded model responses."""
        from .aggregate import assign_ids, dedupe, sort_tickets
        from .diffing import detect_changes
        from .generate import generate_fix
        from .judge import JudgeContext, judge_all, load_overrides, load_rules
        from .runner import get_runner

        try:
            progress.set("discover", "extracting design facts from both codebases")
            changes = detect_changes(cfg)
            progress.set("map", "pairing screens across platforms")
            ctx = JudgeContext(
                rules=load_rules(cfg.conventions),
                agent_md=cfg.read_agent_md(),
                overrides=load_overrides(cfg.overrides_file),
                mode="diff",
                counterpart_slices={
                    c.id: _slice_for(cfg, c) for c in changes if c.counterpart_location
                },
                timeout_s=cfg.runner.timeout_s,
            )
            runner = get_runner(cfg)
            agent_word = "replay" if runner.name == "mock" else "agent"
            progress.set(
                "judge",
                f"{len(changes)} changes → one {agent_word} each, parallel",
                0,
                len(changes),
            )
            def _judged(ticket) -> None:
                progress.bump()
                progress.event(
                    f"agent verdict: {ticket.verdict.upper()} {ticket.change.name} "
                    f"(confidence {ticket.confidence:.2f})"
                )

            tickets = sort_tickets(
                dedupe(
                    judge_all(changes, ctx, runner, cfg.runner.concurrency, on_result=_judged)
                )
            )
            with store.lock:
                previous = store.tickets if store.tickets.tickets else None
                tickets = assign_ids(tickets, previous)
                fixable = [t for t in tickets if t.verdict in ("propagate", "flag")]
                progress.set("fix", "generating fix previews", 0, len(fixable))
                for ticket in fixable:
                    if ticket.proposed_fix is None:
                        ticket.proposed_fix = generate_fix(ticket, cfg)
                    progress.bump()
                store.tickets = TicketFile(
                    run_id=time.strftime("%Y%m%d-%H%M%S"),
                    mode="diff",
                    screen=screen,
                    tickets=tickets,
                )
                store.save()
            progress.set("review", "verdicts ready for human review")
            return comparison(screen)
        finally:
            progress.idle()

    @app.post("/transfer")
    def transfer(screen: str = "login") -> dict:
        """Whole-screen design transfer: iOS is the source of truth; the writer
        agent regenerates the Flutter screen + theme, verified before landing."""
        from .runner import get_runner
        from .transfer import run_transfer

        try:
            runner = get_runner(cfg)
            result = run_transfer(
                cfg, runner, screen=screen,
                on_stage=lambda stg, detail: progress.set(stg, detail),
            )
            if result.ok:
                progress.event(
                    f"design transferred to {', '.join(result.files_written)}"
                )
                with store.lock:
                    # the transfer regenerates the whole screen, so open
                    # per-change findings are addressed wholesale
                    for ticket in store.tickets.tickets:
                        if ticket.status == "pending" and ticket.verdict != "hold":
                            ticket.status = "accepted"
                    store.save()
            else:
                progress.event(f"transfer failed: {result.error}")
            payload = comparison(screen)
            payload["transfer"] = result.model_dump()
            return payload
        finally:
            progress.idle()

    @app.post("/analyze")
    def analyze(body: AnalyzeBody) -> dict:
        from .aggregate import assign_ids, dedupe, sort_tickets
        from .analyze import analyze_pair, detect_android_language
        from .judge import JudgeContext, judge_all, load_overrides, load_rules
        from .runner import get_runner

        changes = analyze_pair(body.iosCode, body.androidCode)
        slices = {}
        for change in changes:
            if change.counterpart_location:
                lines = body.androidCode.splitlines()
                loc = change.counterpart_location.line
                lo, hi = max(0, loc - 16), min(len(lines), loc + 15)
                slices[change.id] = "\n".join(
                    f"{i + 1:>4}  {t}" for i, t in enumerate(lines[lo:hi], start=lo)
                )
        ctx = JudgeContext(
            rules=load_rules(cfg.conventions),
            agent_md=cfg.read_agent_md(),
            overrides=load_overrides(cfg.overrides_file),
            mode="audit",
            counterpart_slices=slices,
            timeout_s=cfg.runner.timeout_s,
        )
        runner = get_runner(cfg)
        tickets = assign_ids(sort_tickets(dedupe(judge_all(changes, ctx, runner))))
        with store.lock:
            store.tickets = TicketFile(
                run_id=time.strftime("%Y%m%d-%H%M%S"),
                mode="audit",
                screen=body.screen,
                tickets=tickets,
            )
            store.save()
        android_lang = detect_android_language(body.androidCode)
        return {
            "screen": body.screen,
            "ios": {
                "platform": "ios",
                "language": "swift",
                "fileName": "LoginView.swift",
                "code": body.iosCode,
            },
            "android": {
                "platform": "android",
                "language": android_lang,
                "fileName": f"login_screen.{'dart' if android_lang == 'dart' else 'kt'}",
                "code": body.androidCode,
            },
            "inconsistencies": [ticket_to_ui(t, cfg) for t in tickets],
            "rulebook": _rulebook(cfg),
        }

    @app.post("/findings/{ticket_id}/accept")
    def accept(ticket_id: str) -> dict:
        with store.lock:
            ticket = store.find(ticket_id)
            if ticket.status != "pending":
                raise HTTPException(status_code=409, detail=f"ticket is {ticket.status}")
            if ticket.change.location.file.startswith("pasted/"):
                ticket.status = "accepted"  # pasted snippets have no files to patch
                store.save()
                return ticket_to_ui(ticket, cfg)
            from .generate import apply_and_pr

            try:
                fixer = (
                    "fixer agent" if cfg.runner.name in ("cursor", "claude") else "mechanical fix"
                )
                progress.set("fix", f"{fixer} applying {ticket.id} ({ticket.change.name})")
                apply_and_pr(ticket, cfg)
                progress.event(f"{ticket.id} fix applied to {ticket.change.name}")
            finally:
                progress.idle()
            ticket.status = "accepted"
            store.save()
            return ticket_to_ui(ticket, cfg)

    @app.post("/debug/reset-android")
    def reset_android(screen: str = "login") -> dict:
        """DEV ONLY: restore the pre-transfer (legacy Material) Android files
        and reopen the tickets, so the transfer demo can be run again."""
        legacy = cfg.root / "examples" / "legacy-android"
        if not legacy.is_dir():
            raise HTTPException(status_code=404, detail="examples/legacy-android missing")
        targets = {
            "login_screen.dart": cfg.android_root / "lib" / "login_screen.dart",
            "theme.dart": cfg.android_root / "lib" / "theme.dart",
            "pubspec.yaml": cfg.android_root / "pubspec.yaml",
        }
        for name, target in targets.items():
            source = legacy / name
            if source.is_file():
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_text(source.read_text(encoding="utf-8"), encoding="utf-8")
        with store.lock:
            for ticket in store.tickets.tickets:
                ticket.status = "pending"
            store.save()
        progress.event("dev reset: Android restored to the legacy design")
        return comparison(screen)

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
