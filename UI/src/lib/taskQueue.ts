export type TaskStatus = 'pending' | 'ready' | 'running' | 'done' | 'cancelled'
export type TaskPriority = 'low' | 'normal' | 'high'

export interface TaskThread {
  id: string
  title: string
  status: TaskStatus
  run_after?: string[]
}

export interface TaskRunConfig {
  agent?: string
  branch_prefix?: string
}

export interface QueueTask {
  id: string
  title: string
  description?: string
  status: TaskStatus
  priority?: TaskPriority
  created_at?: string
  created_by?: string
  labels?: string[]
  threads?: TaskThread[]
  run?: TaskRunConfig
}

export interface TaskQueue {
  version: number
  updated_at?: string
  tasks: QueueTask[]
}

const STATUS_ORDER: Record<TaskStatus, number> = {
  ready: 0,
  running: 1,
  pending: 2,
  done: 3,
  cancelled: 4,
}

export function sortByStatus(tasks: QueueTask[]): QueueTask[] {
  return [...tasks].sort(
    (a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status],
  )
}

export function readyCount(tasks: QueueTask[]): number {
  return tasks.reduce((n, t) => {
    const threadReady = (t.threads ?? []).filter((th) => th.status === 'ready').length
    const taskReady = t.status === 'ready' ? 1 : 0
    return n + taskReady + threadReady
  }, 0)
}

export function buildRunPrompt(task: QueueTask, target: QueueTask | TaskThread): string {
  const run = task.run ?? {}
  const agent = run.agent ?? 'orchestrator'
  const branch = run.branch_prefix ?? 'cursor/'
  const title = 'title' in target && target !== task ? target.title : task.title
  const description =
    ('description' in target && target.description) || task.description || '(see queue.yaml)'
  const id = target.id
  const labels = (task.labels ?? []).join(', ') || 'none'

  return `Run Unitem task queue item **${id}**: ${title}

Read \`tasks/queue.yaml\` and \`ARCHITECTURE.md\` before starting.

**Task:** ${title}
**Description:** ${description}
**Labels:** ${labels}
**Suggested agent:** ${agent}
**Branch prefix:** ${branch}

When complete:
1. Implement the work described above (minimal, focused diff).
2. Run \`cd UI && npm run lint && npm run build\` if UI changed.
3. Mark done: \`python3 scripts/task_queue.py done ${id}\` and commit the queue update.
4. Open a PR on branch \`${branch}<short-slug>-9425\` with auto-create enabled.

Do not edit unrelated files.`
}
