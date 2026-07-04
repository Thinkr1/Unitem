---
name: run-task
description: List or execute ready items from the git-backed task queue (tasks/queue.yaml).
---

# Run task

Use the collaborative task queue at `tasks/queue.yaml`.

## List ready work

```bash
python3 scripts/task_queue.py list --status ready
```

## Run a specific item

1. Generate the cloud-agent prompt:

```bash
python3 scripts/task_queue.py run-prompt <task-or-thread-id>
```

2. Follow the prompt: implement, validate, mark done, open PR.

Or invoke the `task-runner` subagent with the task id.

## Add or split tasks (for humans / follow-ups)

```bash
python3 scripts/task_queue.py add "New task title"
python3 scripts/task_queue.py split task-001 "Sub-thread title"
python3 scripts/task_queue.py ready task-001-a
```

On GitHub, issue comments starting with `/task` auto-commit queue updates (see `docs/10-github-task-queue.md`).
