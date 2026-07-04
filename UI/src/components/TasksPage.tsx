import { useCallback, useEffect, useState } from 'react'
import type { QueueTask, TaskQueue, TaskStatus, TaskThread } from '../lib/taskQueue'
import { buildRunPrompt, readyCount, sortByStatus } from '../lib/taskQueue'

const STATUS_LABEL: Record<TaskStatus, string> = {
  pending: 'Pending',
  ready: 'Ready',
  running: 'Running',
  done: 'Done',
  cancelled: 'Cancelled',
}

const STATUS_CLASS: Record<TaskStatus, string> = {
  pending: 'bg-surface-raised text-ink-muted',
  ready: 'bg-accent/20 text-accent',
  running: 'bg-info-blue/20 text-info-blue',
  done: 'bg-surface-raised text-ink-faint line-through',
  cancelled: 'bg-surface-raised text-ink-faint',
}

function StatusBadge({ status }: { status: TaskStatus }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wide ${STATUS_CLASS[status]}`}
    >
      {STATUS_LABEL[status]}
    </span>
  )
}

function CopyPromptButton({ task, target }: { task: QueueTask; target: QueueTask | TaskThread }) {
  const [copied, setCopied] = useState(false)
  const canRun = target.status === 'ready' || target.status === 'running'

  const copy = useCallback(async () => {
    await navigator.clipboard.writeText(buildRunPrompt(task, target))
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2000)
  }, [task, target])

  if (!canRun) return null

  return (
    <button
      type="button"
      onClick={() => void copy()}
      className="rounded-lg border border-edge bg-surface px-2.5 py-1 font-mono text-[10px] text-ink-muted transition-colors hover:border-accent/40 hover:text-accent"
    >
      {copied ? 'Copied!' : 'Copy agent prompt'}
    </button>
  )
}

function ThreadRow({ task, thread }: { task: QueueTask; thread: TaskThread }) {
  const deps = thread.run_after ?? []
  return (
    <div className="flex items-start gap-3 rounded-xl border border-edge/60 bg-well/40 px-3 py-2.5">
      <div className="mt-0.5 font-mono text-[10px] text-ink-faint">{thread.id}</div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-heading text-[12px] font-medium text-ink">{thread.title}</p>
          <StatusBadge status={thread.status} />
        </div>
        {deps.length > 0 && (
          <p className="mt-1 font-mono text-[10px] text-ink-faint">
            runs after {deps.join(', ')}
          </p>
        )}
      </div>
      <CopyPromptButton task={task} target={thread} />
    </div>
  )
}

function TaskCard({ task }: { task: QueueTask }) {
  const threads = task.threads ?? []
  return (
    <article className="rounded-2xl border border-edge bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[11px] text-ink-faint">{task.id}</span>
            <StatusBadge status={task.status} />
            {task.priority && task.priority !== 'normal' && (
              <span className="font-mono text-[10px] uppercase text-ink-faint">
                {task.priority}
              </span>
            )}
          </div>
          <h3 className="mt-1 font-heading text-[14px] font-semibold text-ink">{task.title}</h3>
          {task.description && (
            <p className="mt-1.5 text-[12px] leading-relaxed text-ink-muted">{task.description}</p>
          )}
          {(task.labels ?? []).length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {(task.labels ?? []).map((label) => (
                <span
                  key={label}
                  className="rounded-md bg-surface-raised px-1.5 py-0.5 font-mono text-[10px] text-ink-faint"
                >
                  {label}
                </span>
              ))}
            </div>
          )}
        </div>
        <CopyPromptButton task={task} target={task} />
      </div>

      {threads.length > 0 && (
        <div className="mt-4 space-y-2 border-t border-edge pt-3">
          <p className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">
            Sub-threads ({threads.length})
          </p>
          {threads.map((thread) => (
            <ThreadRow key={thread.id} task={task} thread={thread} />
          ))}
        </div>
      )}
    </article>
  )
}

export default function TasksPage() {
  const [queue, setQueue] = useState<TaskQueue | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/tasks/queue.json')
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load task queue (${res.status})`)
        return res.json() as Promise<TaskQueue>
      })
      .then((data) => {
        if (!cancelled) setQueue(data)
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load tasks')
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  const tasks = queue ? sortByStatus(queue.tasks) : []
  const ready = queue ? readyCount(queue.tasks) : 0

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-5">
      <div className="mx-auto max-w-2xl space-y-5">
        <div className="rounded-2xl border border-edge bg-surface px-4 py-3">
          <p className="font-heading text-[13px] font-semibold text-ink">GitHub task queue</p>
          <p className="mt-1 text-[12px] leading-relaxed text-ink-muted">
            Shared todo list in{' '}
            <code className="rounded bg-well px-1 py-0.5 font-mono text-[11px] text-code">
              tasks/queue.yaml
            </code>
            . Add via{' '}
            <code className="rounded bg-well px-1 py-0.5 font-mono text-[11px] text-code">
              /task add …
            </code>{' '}
            on any issue, split with{' '}
            <code className="rounded bg-well px-1 py-0.5 font-mono text-[11px] text-code">
              /task split
            </code>
            , then mark{' '}
            <code className="rounded bg-well px-1 py-0.5 font-mono text-[11px] text-code">
              /task ready
            </code>{' '}
            to run in Cloud Agents.
          </p>
          {queue?.updated_at && (
            <p className="mt-2 font-mono text-[10px] text-ink-faint">
              Updated {queue.updated_at}
              {ready > 0 && ` · ${ready} ready to run`}
            </p>
          )}
        </div>

        {error && (
          <div className="rounded-2xl border border-severity-error/30 bg-surface px-4 py-8 text-center">
            <p className="font-heading text-[13px] font-semibold text-severity-error">
              Could not load tasks
            </p>
            <p className="mt-1 text-[12px] text-ink-muted">{error}</p>
            <p className="mt-2 font-mono text-[10px] text-ink-faint">
              Run npm run sync:tasks from UI/
            </p>
          </div>
        )}

        {!error && !queue && (
          <div className="rounded-2xl border border-edge bg-surface py-12 text-center text-[12px] text-ink-muted">
            Loading task queue…
          </div>
        )}

        {queue && tasks.length === 0 && (
          <div className="rounded-2xl border border-edge bg-surface py-16 text-center">
            <p className="font-heading text-[14px] font-semibold text-ink">No tasks yet</p>
            <p className="mt-1 text-[12px] text-ink-muted">
              Comment{' '}
              <code className="font-mono text-[11px] text-code">/task add My first task</code> on a
              GitHub issue.
            </p>
          </div>
        )}

        {tasks.map((task) => (
          <TaskCard key={task.id} task={task} />
        ))}
      </div>
    </div>
  )
}
