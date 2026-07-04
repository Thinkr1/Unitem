"""unitem CLI: diff | audit | serve."""
from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

from .aggregate import assign_ids, dedupe, sort_tickets
from .config import Config, load_config
from .judge import JudgeContext, judge_all, load_overrides, load_rules
from .report import load_tickets, print_summary, write_tickets
from .runner import get_runner
from .schema import AtomicChange, TicketFile


def _slice_around(cfg: Config, file: str, line: int, width: int = 15) -> str:
    """±width lines around a location; whole file if it's small."""
    path = Path(file)
    if not path.is_absolute():
        path = cfg.root / file
    if not path.is_file():
        return "(file not found)"
    lines = path.read_text(encoding="utf-8").splitlines()
    if len(lines) <= 80:
        return "\n".join(f"{i + 1:>4}  {text}" for i, text in enumerate(lines))
    lo = max(0, line - 1 - width)
    hi = min(len(lines), line + width)
    return "\n".join(f"{i + 1:>4}  {text}" for i, text in enumerate(lines[lo:hi], start=lo))


def _load_changes_file(path: Path) -> list[AtomicChange]:
    data = json.loads(Path(path).read_text(encoding="utf-8"))
    items = data["changes"] if isinstance(data, dict) else data
    return [AtomicChange.model_validate(c) for c in items]


def cmd_diff(args: argparse.Namespace) -> int:
    cfg = load_config(args.config)
    runner = get_runner(cfg, args.runner)

    if args.changes_file:
        changes = _load_changes_file(Path(args.changes_file))
    else:
        from .diffing import detect_changes  # M5

        changes = detect_changes(cfg, base_ref=args.base)
    if not changes:
        print("No design-relevant changes detected.")
        return 0

    ctx = JudgeContext(
        rules=load_rules(cfg.conventions),
        agent_md=cfg.read_agent_md(),
        overrides=load_overrides(cfg.overrides_file),
        mode="diff",
        counterpart_slices={
            c.id: _slice_around(cfg, c.counterpart_location.file, c.counterpart_location.line)
            for c in changes
            if c.counterpart_location
        },
        dump_dir=Path(args.dump_prompts) if args.dump_prompts else None,
        record_dir=(cfg.fixtures_dir / "judge") if args.record else None,
        timeout_s=cfg.runner.timeout_s,
    )

    tickets = judge_all(changes, ctx, runner, concurrency=cfg.runner.concurrency)
    tickets = sort_tickets(dedupe(tickets))

    from .generate import generate_fix  # eager preview so the UI shows diffs pre-accept

    for ticket in tickets:
        if ticket.verdict in ("propagate", "flag") and ticket.proposed_fix is None:
            ticket.proposed_fix = generate_fix(ticket, cfg)

    out_path = cfg.out_dir / "tickets.json"
    previous = load_tickets(out_path)
    tickets = assign_ids(tickets, previous)

    ticket_file = TicketFile(
        run_id=time.strftime("%Y%m%d-%H%M%S"),
        mode="diff",
        screen=args.screen or cfg.screen,
        tickets=tickets,
    )
    write_tickets(out_path, ticket_file)
    print_summary(ticket_file)
    print(f"tickets written to {out_path}")
    return 0


def cmd_transfer(args: argparse.Namespace) -> int:
    """Whole-screen design transfer: regenerate the Flutter screen from iOS."""
    cfg = load_config(args.config)
    runner = get_runner(cfg, args.runner)
    from .transfer import run_transfer

    result = run_transfer(
        cfg,
        runner,
        screen=args.screen,
        on_stage=lambda stage, detail: print(f"[{stage}] {detail}"),
        record_dir=(cfg.fixtures_dir / "judge") if args.record else None,
    )
    if not result.ok:
        print(f"transfer FAILED after {result.attempts} writer attempt(s): {result.error}")
        return 1
    print(f"transfer complete ({result.attempts} writer attempt(s)): {result.summary}")
    for path in result.files_written:
        print(f"  wrote {path}")
    for dep in result.dependencies_added:
        print(f"  added dependency {dep} to pubspec.yaml")
    for warning in result.warnings:
        print(f"  warning: {warning}")
    return 0


def cmd_audit(args: argparse.Namespace) -> int:
    print(
        "audit mode is not implemented yet — diff mode is the demo path.\n"
        "(Planned: full-tree cross-platform baseline scan; see ARCHITECTURE.md §3.)"
    )
    return 2


def cmd_serve(args: argparse.Namespace) -> int:
    import uvicorn

    from .api import create_app

    app = create_app(load_config(args.config))
    uvicorn.run(app, host="127.0.0.1", port=args.port)
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="unitem", description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)

    common = argparse.ArgumentParser(add_help=False)
    common.add_argument("--config", default="unitem.yaml", help="path to unitem.yaml")

    p_diff = sub.add_parser("diff", parents=[common], help="judge design changes (demo path)")
    p_diff.add_argument("--runner", choices=["mock", "cursor", "claude"], default=None)
    p_diff.add_argument("--changes-file", help="seeded AtomicChange JSON (skips git detection)")
    p_diff.add_argument("--base", default="HEAD", help="git ref to diff against")
    p_diff.add_argument("--screen", default=None)
    p_diff.add_argument("--dump-prompts", metavar="DIR", help="write built prompts for inspection")
    p_diff.add_argument("--record", action="store_true", help="save real responses as fixtures")
    p_diff.set_defaults(func=cmd_diff)

    p_transfer = sub.add_parser(
        "transfer", parents=[common], help="regenerate the Flutter screen from the iOS design"
    )
    p_transfer.add_argument("--runner", choices=["mock", "cursor", "claude"], default=None)
    p_transfer.add_argument("--screen", default=None)
    p_transfer.add_argument("--record", action="store_true", help="save agent responses as fixtures")
    p_transfer.set_defaults(func=cmd_transfer)

    p_audit = sub.add_parser("audit", parents=[common], help="baseline scan (not yet implemented)")
    p_audit.set_defaults(func=cmd_audit)

    p_serve = sub.add_parser("serve", parents=[common], help="run the UI-facing API on :8787")
    p_serve.add_argument("--port", type=int, default=8787)
    p_serve.set_defaults(func=cmd_serve)

    args = parser.parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
