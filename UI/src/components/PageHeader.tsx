import type { ReactNode } from 'react'

interface PageHeaderProps {
  title: string
  subtitle: string
  action?: ReactNode
}

export default function PageHeader({ title, subtitle, action }: PageHeaderProps) {
  return (
    <header className="app-drag mb-1.5 flex shrink-0 items-end justify-between gap-4">
      <div className="min-w-0" data-no-drag>
        <h1 className="font-heading text-[20px] font-semibold tracking-tight text-ink">
          {title}
        </h1>
        <p className="mt-0.5 text-[13px] text-ink-muted">{subtitle}</p>
      </div>
      {action ? (
        <div className="shrink-0 pt-0.5" data-no-drag>
          {action}
        </div>
      ) : null}
    </header>
  )
}
