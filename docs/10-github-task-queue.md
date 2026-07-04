# GitHub task queue

Collaborative, auto-committing todo list stored in `tasks/queue.yaml`. Anyone on the team can add work, split it into sub-threads, and later hand ready items to Cursor Cloud Agents.

## Why git-backed?

Cloud agents only see **committed** repo state. A shared queue in git means:

- Anyone can append tasks (no single owner)
- History and attribution are preserved
- Agents read the same source of truth as humans
- "Run it later" = mark `ready`, then spawn an agent with the generated prompt

## Quick start

### Add a task

```bash
# Local
python3 scripts/task_queue.py add "Fix override popover"

# GitHub issue comment (auto-commits to main)
/task add Fix override popover

# Split into a sub-thread
/task split task-001 "Add mock propagate example"

# GitHub Actions UI: Actions → Task queue → Run workflow
```

### Mark ready and run

```bash
python3 scripts/task_queue.py ready task-001-a
python3 scripts/task_queue.py run-prompt task-001-a
```

Copy the printed prompt into [cursor.com/agents](https://cursor.com/agents) (New agent → `Thinkr1/Unitem` → paste → enable auto-create PR).

When finished:

```bash
python3 scripts/task_queue.py done task-001-a
git add tasks/queue.yaml && git commit -m "task-queue: mark task-001-a done"
```

Or comment `/task done task-001-a` on any issue.

## Data model

```yaml
tasks:
  - id: task-001           # unique
    title: "..."
    description: "..."
    status: pending        # pending | ready | running | done | cancelled
    priority: normal       # low | normal | high
    threads:               # optional sub-threads (split work)
      - id: task-001-a
        title: "..."
        status: pending
        run_after: []      # thread ids that must be done first
    run:
      agent: orchestrator  # suggested Cursor subagent
      branch_prefix: cursor/
```

Sub-threads with `run_after` stay `pending` until dependencies are `done`, then auto-promote to `ready`.

## Automation

| Trigger | What happens |
|---------|----------------|
| Push/PR touching `tasks/queue.yaml` | Validates schema |
| Issue comment starting with `/task` | Updates queue + auto-commit |
| Actions → Task queue → Run workflow | Manual add/split/ready/done |

See `.github/workflows/task-queue.yml`.

## UI

The **Tasks** page in `/UI` reads the queue (synced to `UI/public/tasks/queue.yaml` on dev/build) and shows status, sub-threads, and a copyable cloud-agent prompt for ready items.

## Cursor integration

| Path | Purpose |
|------|---------|
| `.cursor/agents/task-runner.md` | Subagent that picks up a ready queue item |
| `.cursor/skills/run-task/SKILL.md` | `/run-task` skill — list ready items or run one by id |

Example agent invocation:

```
/run-task task-001-a
```

## Related docs

- `docs/08-cloud-agents-setup.md` — dashboard setup for Cloud Agents
- `tasks/README.md` — one-page cheat sheet
