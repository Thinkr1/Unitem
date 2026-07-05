import LiveFlowPanel from './LiveFlowPanel'

const STAGE_DESCRIPTIONS = [
  {
    label: 'Discover',
    body: 'tree-sitter and regex extract UI facts from Swift and Dart source — button colors, padding, typography, copy.',
  },
  {
    label: 'Map',
    body: 'The mapper agent pairs DailyGoalsView.swift with daily_goals_screen.dart by screen semantics, not file name.',
  },
  {
    label: 'Retrieve',
    body: 'Context tools fetch the matching convention_refs from the rulebook for each mapped property pair.',
  },
  {
    label: 'Judge',
    body: 'Classifier fan-out assigns propagate, hold, or flag with confidence scores for every difference.',
  },
  {
    label: 'Validate',
    body: 'Schema gate retries invalid JSON before writing tickets.json — no malformed output reaches the UI.',
  },
  {
    label: 'Review',
    body: 'Human console: accept, override, or narrow focus before any fix is applied to either codebase.',
  },
  {
    label: 'Fix',
    body: 'Cloud fixer writes minimal counterpart edits and opens a PR with only the reconciled lines changed.',
  },
  {
    label: 'Verify',
    body: 'Verifier rebuilds both platforms and returns build + visual results to the console.',
  },
]

export default function AgentsPage() {
  return (
    <div className="h-full min-h-0 overflow-y-auto">
      <div className="mx-auto max-w-5xl space-y-4">
        <div className="neo-card overflow-hidden">
          <LiveFlowPanel />
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {STAGE_DESCRIPTIONS.map((stage) => (
            <div
              key={stage.label}
              className="rounded-xl border border-edge bg-surface p-3.5"
            >
              <h3 className="font-heading text-[12px] font-semibold text-accent">
                {stage.label}
              </h3>
              <p className="mt-1.5 text-[11px] leading-snug text-ink-muted">
                {stage.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
