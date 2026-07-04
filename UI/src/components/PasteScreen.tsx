import { useState } from 'react'

interface PasteScreenProps {
  initialIos: string
  initialAndroid: string
  onAnalyze: (payload: { iosCode: string; androidCode: string }) => void
}

function Editor({
  label,
  hint,
  value,
  onChange,
  placeholder,
}: {
  label: string
  hint: string
  value: string
  onChange: (v: string) => void
  placeholder: string
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-edge bg-surface">
      <div className="flex items-center justify-between border-b border-edge px-4 py-2.5">
        <span className="font-heading text-[12.5px] font-semibold text-ink">
          {label}
        </span>
        <span className="font-mono text-[10.5px] text-ink-faint">{hint}</span>
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        spellCheck={false}
        className="min-h-0 flex-1 resize-none bg-well p-4 font-mono text-[11.5px] leading-[1.6] text-code placeholder:text-ink-faint focus:outline-none"
      />
    </div>
  )
}

export default function PasteScreen({
  initialIos,
  initialAndroid,
  onAnalyze,
}: PasteScreenProps) {
  const [iosCode, setIosCode] = useState(initialIos)
  const [androidCode, setAndroidCode] = useState(initialAndroid)

  const canAnalyze = iosCode.trim().length > 0 || androidCode.trim().length > 0

  return (
    <div className="flex h-screen flex-col bg-surface-deep text-ink antialiased">
      <header className="app-drag flex h-16 shrink-0 items-center gap-3 pl-24 pr-5">
        <div className="flex h-9 w-9 items-center justify-center">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M5 4v10a7 7 0 0 0 14 0V4"
              stroke="var(--color-ink)"
              strokeWidth="2.4"
              strokeLinecap="round"
            />
          </svg>
        </div>
        <div>
          <h1 className="font-heading text-[15px] font-bold leading-tight tracking-wide text-ink">
            New comparison
          </h1>
          <p className="text-[11.5px] text-ink-muted">
            Paste your iOS and Android screens to reconcile them
          </p>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col px-6 pb-6">
        <div className="flex min-h-0 flex-1 gap-4">
          <Editor
            label="iOS · Swift"
            hint="DailyGoalsView.swift"
            value={iosCode}
            onChange={setIosCode}
            placeholder="Paste your SwiftUI source here…"
          />
          <Editor
            label="Android · Dart"
            hint="daily_goals_screen.dart"
            value={androidCode}
            onChange={setAndroidCode}
            placeholder="Paste your Flutter source here…"
          />
        </div>

        <div className="mt-4 flex shrink-0 items-center justify-between">
          <p className="text-[11px] text-ink-faint">
            The Android side renders live via DartPad. iOS shows a schematic
            preview.
          </p>
          <button
            onClick={() => onAnalyze({ iosCode, androidCode })}
            disabled={!canAnalyze}
            className="flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 font-heading text-[13px] font-semibold text-accent-contrast transition-colors hover:bg-accent-bright disabled:bg-surface-raised disabled:text-ink-faint"
          >
            Analyze
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
