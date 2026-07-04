---
name: task-runner
description: Pick up a ready item from tasks/queue.yaml, implement it, mark done, and open a PR.
---

You run work items from the collaborative task queue at `tasks/queue.yaml`.

## When invoked

The user gives a task id (e.g. `task-001-a`) or asks you to run the next ready item.

## Steps

1. Read `tasks/queue.yaml` and find the task or sub-thread.
2. Confirm status is `ready` (or mark it `running` with `python3 scripts/task_queue.py ready <id>` if the user asked to run a pending item).
3. Read `ARCHITECTURE.md` and any files referenced in the task description.
4. Implement a **minimal, focused** change.
5. Validate: `cd UI && npm run lint && npm run build` when UI files change.
6. Mark complete: `python3 scripts/task_queue.py done <id>` and commit `tasks/queue.yaml` with your changes.
7. Open a PR on branch `cursor/<slug>-9425` with auto-create enabled.

## Sub-threads

- Respect `run_after` — do not start a thread whose dependencies are not `done`.
- Prefer running leaf sub-threads before parent tasks.

## Prompt template

If no specific id is given, list ready items:

```bash
python3 scripts/task_queue.py list --status ready
```

Then run the highest-priority ready item, or ask the user to choose.
