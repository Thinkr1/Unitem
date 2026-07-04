# Task queue

Collaborative, git-backed todo list for Unitem. Changes to `queue.yaml` are validated and auto-committed by GitHub Actions.

## Add a task (pick any)

| Method | Example |
|--------|---------|
| **Issue comment** | `/task add Fix override popover` |
| **Sub-thread** | `/task split task-001 "Write unit tests"` |
| **Mark ready to run** | `/task ready task-001` or `/task ready task-001 task-001-a` |
| **Local CLI** | `python3 scripts/task_queue.py add "My task"` |
| **Direct edit** | Edit `tasks/queue.yaml` and open a PR |

## Run a task (Cloud Agent)

1. Mark it ready: `/task ready task-001-a`
2. Open [cursor.com/agents](https://cursor.com/agents) → New agent → repo `Thinkr1/Unitem`
3. Paste the prompt from: `python3 scripts/task_queue.py run-prompt task-001-a`

Or invoke the `/run-task` skill / `task-runner` subagent (see `docs/10-github-task-queue.md`).

## Status flow

`pending` → `ready` → `running` → `done` (or `cancelled`)

Sub-threads with `run_after` stay `pending` until their dependencies are `done`.
