#!/usr/bin/env python3
"""Collaborative git-backed task queue for Unitem.

Used locally and by .github/workflows/task-queue.yml to add, split, validate,
and emit cloud-agent run prompts.
"""

from __future__ import annotations

import argparse
import re
import sys
from copy import deepcopy
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

try:
    import yaml
except ImportError:
    print("PyYAML required: pip install pyyaml", file=sys.stderr)
    sys.exit(1)

ROOT = Path(__file__).resolve().parents[1]
QUEUE_PATH = ROOT / "tasks" / "queue.yaml"

STATUSES = frozenset({"pending", "ready", "running", "done", "cancelled"})
PRIORITIES = frozenset({"low", "normal", "high"})


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def load_queue() -> dict[str, Any]:
    if not QUEUE_PATH.exists():
        return {"version": 1, "updated_at": utc_now(), "tasks": []}
    with QUEUE_PATH.open(encoding="utf-8") as fh:
        data = yaml.safe_load(fh) or {}
    data.setdefault("version", 1)
    data.setdefault("tasks", [])
    return data


def save_queue(data: dict[str, Any]) -> None:
    data["updated_at"] = utc_now()
    QUEUE_PATH.parent.mkdir(parents=True, exist_ok=True)
    with QUEUE_PATH.open("w", encoding="utf-8") as fh:
        yaml.dump(
            data,
            fh,
            default_flow_style=False,
            sort_keys=False,
            allow_unicode=True,
            width=100,
        )


def slugify(text: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")
    return slug[:40] or "task"


def next_task_id(tasks: list[dict[str, Any]]) -> str:
    nums = []
    for task in tasks:
        match = re.match(r"task-(\d+)$", task.get("id", ""))
        if match:
            nums.append(int(match.group(1)))
    n = max(nums, default=0) + 1
    return f"task-{n:03d}"


def next_thread_id(task: dict[str, Any], title: str) -> str:
    base = task["id"]
    threads = task.get("threads") or []
    letters = [t["id"].split("-")[-1] for t in threads if t["id"].startswith(base)]
    if not letters:
        return f"{base}-a"
    last = max(letters)
    if len(last) == 1 and last.isalpha():
        return f"{base}-{chr(ord(last) + 1)}"
    return f"{base}-{len(threads) + 1}"


def find_task(tasks: list[dict[str, Any]], task_id: str) -> dict[str, Any] | None:
    for task in tasks:
        if task.get("id") == task_id:
            return task
    return None


def find_thread(task: dict[str, Any], thread_id: str) -> dict[str, Any] | None:
    for thread in task.get("threads") or []:
        if thread.get("id") == thread_id:
            return thread
    return None


def resolve_target(
    tasks: list[dict[str, Any]], ref: str
) -> tuple[dict[str, Any], dict[str, Any] | None]:
    """Resolve task-id or thread-id to (task, thread|None)."""
    for task in tasks:
        if task.get("id") == ref:
            return task, None
        thread = find_thread(task, ref)
        if thread:
            return task, thread
    raise SystemExit(f"Unknown task or thread id: {ref}")


def validate_queue(data: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    tasks = data.get("tasks") or []
    seen_ids: set[str] = set()

    for task in tasks:
        tid = task.get("id")
        if not tid:
            errors.append("Task missing id")
            continue
        if tid in seen_ids:
            errors.append(f"Duplicate id: {tid}")
        seen_ids.add(tid)

        if task.get("status") not in STATUSES:
            errors.append(f"{tid}: invalid status {task.get('status')!r}")
        if task.get("priority") and task.get("priority") not in PRIORITIES:
            errors.append(f"{tid}: invalid priority {task.get('priority')!r}")
        if not task.get("title"):
            errors.append(f"{tid}: missing title")

        thread_ids: set[str] = set()
        for thread in task.get("threads") or []:
            thid = thread.get("id")
            if not thid:
                errors.append(f"{tid}: thread missing id")
                continue
            if thid in thread_ids:
                errors.append(f"{tid}: duplicate thread id {thid}")
            thread_ids.add(thid)
            if thid in seen_ids:
                errors.append(f"Duplicate id: {thid}")
            seen_ids.add(thid)
            if thread.get("status") not in STATUSES:
                errors.append(f"{thid}: invalid status {thread.get('status')!r}")
            for dep in thread.get("run_after") or []:
                if dep not in thread_ids:
                    errors.append(f"{thid}: run_after references unknown thread {dep!r}")

    return errors


def refresh_thread_readiness(task: dict[str, Any]) -> None:
    """Promote pending threads to ready when run_after deps are done."""
    threads = task.get("threads") or []
    done_ids = {t["id"] for t in threads if t.get("status") == "done"}
    for thread in threads:
        if thread.get("status") != "pending":
            continue
        deps = thread.get("run_after") or []
        if all(dep in done_ids for dep in deps):
            thread["status"] = "ready"


def cmd_add(args: argparse.Namespace) -> None:
    data = load_queue()
    tasks = data["tasks"]
    task_id = next_task_id(tasks)

    if args.parent:
        parent = find_task(tasks, args.parent)
        if not parent:
            raise SystemExit(f"Unknown parent task: {args.parent}")
        thread_id = next_thread_id(parent, args.title)
        parent.setdefault("threads", []).append(
            {
                "id": thread_id,
                "title": args.title,
                "status": "pending",
                "run_after": list(args.run_after or []),
            }
        )
        refresh_thread_readiness(parent)
        save_queue(data)
        print(thread_id)
        return

    tasks.append(
        {
            "id": task_id,
            "title": args.title,
            "description": args.description or "",
            "status": "pending",
            "priority": args.priority,
            "created_at": utc_now(),
            "created_by": args.by,
            "labels": list(args.labels or []),
            "threads": [],
            "run": {
                "agent": args.agent,
                "branch_prefix": "cursor/",
            },
        }
    )
    save_queue(data)
    print(task_id)


def cmd_split(args: argparse.Namespace) -> None:
    args.parent = args.task_id
    cmd_add(args)


def cmd_ready(args: argparse.Namespace) -> None:
    data = load_queue()
    task, thread = resolve_target(data["tasks"], args.ref)
    target = thread or task
    if target.get("status") in ("done", "cancelled"):
        raise SystemExit(f"{args.ref} is already {target['status']}")
    target["status"] = "ready"
    refresh_thread_readiness(task)
    save_queue(data)
    print(args.ref)


def cmd_done(args: argparse.Namespace) -> None:
    data = load_queue()
    task, thread = resolve_target(data["tasks"], args.ref)
    target = thread or task
    target["status"] = "done"
    refresh_thread_readiness(task)
    save_queue(data)
    print(args.ref)


def cmd_list(args: argparse.Namespace) -> None:
    data = load_queue()
    for task in data.get("tasks") or []:
        if args.status and task.get("status") != args.status:
            continue
        print(f"[{task.get('status')}] {task['id']}: {task['title']}")
        for thread in task.get("threads") or []:
            if args.status and thread.get("status") != args.status:
                continue
            deps = thread.get("run_after") or []
            dep_note = f" (after {', '.join(deps)})" if deps else ""
            print(f"  └─ [{thread.get('status')}] {thread['id']}: {thread['title']}{dep_note}")


def cmd_run_prompt(args: argparse.Namespace) -> None:
    data = load_queue()
    task, thread = resolve_target(data["tasks"], args.ref)
    target = thread or task
    run_cfg = task.get("run") or {}
    agent = run_cfg.get("agent", "orchestrator")
    branch_prefix = run_cfg.get("branch_prefix", "cursor/")

    title = target.get("title", task.get("title"))
    description = target.get("description") or task.get("description") or ""
    labels = ", ".join(task.get("labels") or [])

    prompt = f"""Run Unitem task queue item **{target['id']}**: {title}

Read `tasks/queue.yaml` and `ARCHITECTURE.md` before starting.

**Task:** {title}
**Description:** {description.strip() or "(see queue.yaml)"}
**Labels:** {labels or "none"}
**Suggested agent:** {agent}
**Branch prefix:** {branch_prefix}

When complete:
1. Implement the work described above (minimal, focused diff).
2. Run `cd UI && npm run lint && npm run build` if UI changed.
3. Mark done: `python3 scripts/task_queue.py done {target['id']}` and commit the queue update.
4. Open a PR on branch `{branch_prefix}<short-slug>-9425` with auto-create enabled.

Do not edit unrelated files."""
    print(prompt)


def cmd_validate(_: argparse.Namespace) -> None:
    data = load_queue()
    errors = validate_queue(data)
    if errors:
        for err in errors:
            print(f"ERROR: {err}", file=sys.stderr)
        raise SystemExit(1)
    print("OK")


def cmd_export_json(_: argparse.Namespace) -> None:
    import json

    data = load_queue()
    errors = validate_queue(data)
    if errors:
        for err in errors:
            print(f"ERROR: {err}", file=sys.stderr)
        raise SystemExit(1)
    out = ROOT / "UI" / "public" / "tasks" / "queue.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
    print(out)


def cmd_from_comment(args: argparse.Namespace) -> None:
    """Parse a GitHub issue comment like `/task add Title` or `/task ready task-001-a`."""
    body = args.comment.strip()
    if not body.startswith("/task"):
        raise SystemExit("Comment does not start with /task")

    parts = body.split(None, 2)
    if len(parts) < 2:
        raise SystemExit("Usage: /task <add|split|ready|done|list> ...")

    sub = parts[1].lower()
    rest = parts[2] if len(parts) > 2 else ""

    if sub == "list":
        cmd_list(argparse.Namespace(status=None))
        return

    if sub == "add":
        if not rest:
            raise SystemExit("/task add requires a title")
        title = rest.strip('"')
        ns = argparse.Namespace(
            title=title,
            description="",
            by=args.author,
            labels=[],
            priority="normal",
            agent="orchestrator",
            parent=None,
            run_after=[],
        )
        cmd_add(ns)
        return

    if sub == "split":
        split_parts = rest.split(None, 1)
        if len(split_parts) < 2:
            raise SystemExit('/task split <task-id> "Sub-thread title"')
        task_id, title = split_parts[0], split_parts[1].strip('"')
        ns = argparse.Namespace(
            task_id=task_id,
            title=title,
            description="",
            by=args.author,
            labels=[],
            priority="normal",
            agent="orchestrator",
            parent=task_id,
            run_after=[],
        )
        cmd_split(ns)
        return

    if sub in ("ready", "done"):
        if not rest:
            raise SystemExit(f"/task {sub} requires a task or thread id")
        ref = rest.split()[0]
        fn = cmd_ready if sub == "ready" else cmd_done
        fn(argparse.Namespace(ref=ref))
        return

    raise SystemExit(f"Unknown /task subcommand: {sub}")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Unitem collaborative task queue")
    sub = parser.add_subparsers(dest="command", required=True)

    p_add = sub.add_parser("add", help="Add a top-level task")
    p_add.add_argument("title")
    p_add.add_argument("--description", default="")
    p_add.add_argument("--by", default="team")
    p_add.add_argument("--labels", nargs="*", default=[])
    p_add.add_argument("--priority", choices=sorted(PRIORITIES), default="normal")
    p_add.add_argument("--agent", default="orchestrator")
    p_add.add_argument("--parent", help="Add as sub-thread under this task id")
    p_add.add_argument("--run-after", nargs="*", default=[])
    p_add.set_defaults(func=cmd_add)

    p_split = sub.add_parser("split", help="Split a task into a sub-thread")
    p_split.add_argument("task_id")
    p_split.add_argument("title")
    p_split.add_argument("--by", default="team")
    p_split.add_argument("--run-after", nargs="*", default=[])
    p_split.set_defaults(func=cmd_split)

    p_ready = sub.add_parser("ready", help="Mark task/thread ready for cloud agent")
    p_ready.add_argument("ref", help="task-id or thread-id")
    p_ready.set_defaults(func=cmd_ready)

    p_done = sub.add_parser("done", help="Mark task/thread done")
    p_done.add_argument("ref")
    p_done.set_defaults(func=cmd_done)

    p_list = sub.add_parser("list")
    p_list.add_argument("--status", choices=sorted(STATUSES))
    p_list.set_defaults(func=cmd_list)

    p_prompt = sub.add_parser("run-prompt", help="Print cloud-agent prompt for a task")
    p_prompt.add_argument("ref")
    p_prompt.set_defaults(func=cmd_run_prompt)

    p_val = sub.add_parser("validate")
    p_val.set_defaults(func=cmd_validate)

    p_export = sub.add_parser("export-json", help="Export queue.json for the UI")
    p_export.set_defaults(func=cmd_export_json)

    p_comment = sub.add_parser("from-comment", help="Parse /task issue comment (CI)")
    p_comment.add_argument("comment")
    p_comment.add_argument("--author", default="github")
    p_comment.set_defaults(func=cmd_from_comment)

    return parser


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
