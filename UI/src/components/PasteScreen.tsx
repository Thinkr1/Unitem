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
        <span className="font-heading text-[13px] font-semibold text-ink">
          {label}
        </span>
        {hint ? (
          <span className="font-mono text-[10.5px] text-ink-faint">{hint}</span>
        ) : null}
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
    <div className="flex h-screen bg-surface-deep text-ink antialiased">
      <nav className="app-drag flex w-[4.5rem] shrink-0 flex-col items-center pt-11">
        <img
          src="./unitem-logo.png"
          alt="Unitem"
          className="h-8 w-auto max-w-[3.25rem] object-contain brightness-110"
          draggable={false}
        />
      </nav>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col px-6 pb-6 pt-4">
        <h1 className="mb-1 font-heading text-[18px] font-bold text-ink">
          Paste your code
        </h1>
        <p className="mb-5 text-[12px] text-ink-muted">
          Drop in your iOS and Android screens to compare them side by side.
        </p>

        <div className="flex min-h-0 flex-1 gap-4">
          <Editor
            label="iOS"
            hint=""
            value={iosCode}
            onChange={setIosCode}
            placeholder="Paste your SwiftUI source here…"
          />
          <Editor
            label="Android"
            hint=""
            value={androidCode}
            onChange={setAndroidCode}
            placeholder="Paste your Flutter source here…"
          />
        </div>

        <div className="mt-4 flex shrink-0 justify-end">
          <button
            onClick={() => onAnalyze({ iosCode, androidCode })}
            disabled={!canAnalyze}
            className="flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 font-heading text-[13px] font-semibold text-accent-contrast transition-all hover:bg-accent-bright disabled:bg-surface-raised disabled:text-ink-faint"
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
