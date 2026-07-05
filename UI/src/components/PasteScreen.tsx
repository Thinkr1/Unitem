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
    <div className="glass-card flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b border-edge px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-edge bg-surface-raised font-heading text-[10px] font-bold text-ink">
            {label === 'iOS' ? 'iOS' : 'And'}
          </span>
          <span className="font-heading text-[14px] font-bold text-ink">{label}</span>
        </div>
        <span className="rounded-md border border-edge px-2 py-0.5 font-heading text-[10px] font-semibold text-ink-faint">
          {hint}
        </span>
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        spellCheck={false}
        className="min-h-0 flex-1 resize-none bg-surface-raised px-4 pb-4 pt-3 font-mono text-[12px] leading-[1.65] text-code placeholder:text-ink-faint focus:bg-surface focus:outline-none"
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
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex min-h-0 flex-1 gap-3">
        <Editor
          label="iOS"
          hint="SwiftUI"
          value={iosCode}
          onChange={setIosCode}
          placeholder="Paste your SwiftUI source here…"
        />
        <Editor
          label="Android"
          hint="Flutter"
          value={androidCode}
          onChange={setAndroidCode}
          placeholder="Paste your Flutter source here…"
        />
      </div>

      <div className="flex shrink-0 items-center justify-between gap-4 rounded-xl border border-edge bg-surface px-4 py-3">
        <p className="text-[12px] text-ink-muted">
          Hit analyze when both sides are ready — we&apos;ll diff them live.
        </p>
        <button
          onClick={() => onAnalyze({ iosCode, androidCode })}
          disabled={!canAnalyze}
          className="glass-btn-primary-lg flex shrink-0 items-center gap-2 disabled:opacity-40"
        >
          Analyze
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </button>
      </div>
    </div>
  )
}
