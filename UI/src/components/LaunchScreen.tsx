import { useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { DEMO_APPS } from '../demoApps'
import type { AppScreen, CodebaseApp } from '../types'
import { analyzePair } from '../lib/api'
import {
  guessFolderName,
  humanizeKey,
  matchScreens,
  readFolderFiles,
  type ScannedFile,
} from '../lib/codebaseScan'
import UnitemLogo from './UnitemLogo'
import ThemeToggle from './ThemeToggle'

interface LaunchScreenProps {
  onSelectApp: (app: CodebaseApp) => void
  onPasteInstead: () => void
  engineLive: boolean | null
}

interface FolderPick {
  files: ScannedFile[]
  folderName: string | null
}

type Side = 'ios' | 'android'

function FolderIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" />
    </svg>
  )
}

function FolderPicker({
  label,
  hint,
  pick,
  disabled,
  onPick,
  onClear,
}: {
  label: string
  hint: string
  pick: FolderPick | null
  disabled: boolean
  onPick: (files: FileList | null) => void
  onClear: () => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <div className="glass-card flex flex-1 flex-col gap-3 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-edge bg-surface-raised font-heading text-[10px] font-bold text-ink">
            {label === 'iOS' ? 'iOS' : 'And'}
          </span>
          <span className="font-heading text-[13px] font-bold text-ink">{label} codebase</span>
        </div>
        <span className="rounded-md border border-edge px-2 py-0.5 font-heading text-[10px] font-semibold text-ink-faint">
          {hint}
        </span>
      </div>

      <input
        type="file"
        multiple
        hidden
        onChange={(e: ChangeEvent<HTMLInputElement>) => {
          onPick(e.target.files)
          e.target.value = ''
        }}
        ref={(el) => {
          inputRef.current = el
          // Non-standard attributes (no React typing) — the only way to get a
          // native folder picker without a file-system-access-API dependency.
          el?.setAttribute('webkitdirectory', '')
          el?.setAttribute('directory', '')
        }}
      />

      {pick && pick.files.length > 0 ? (
        <div className="glass-inset flex items-center justify-between gap-3 px-3 py-2.5">
          <div className="min-w-0">
            <p className="truncate font-heading text-[12px] font-semibold text-ink">
              {pick.folderName ?? 'Selected folder'}
            </p>
            <p className="text-[11px] text-ink-muted">
              {pick.files.length} file{pick.files.length === 1 ? '' : 's'} found
            </p>
          </div>
          <button
            type="button"
            onClick={onClear}
            disabled={disabled}
            title="Clear selection"
            aria-label="Clear selection"
            className="glass-btn-quiet flex h-7 w-7 shrink-0 items-center justify-center rounded-lg disabled:opacity-40"
          >
            ✕
          </button>
        </div>
      ) : (
        <button
          type="button"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
          className="glass-inset flex flex-col items-center justify-center gap-2 border-dashed px-3 py-6 text-ink-faint transition-colors hover:border-edge-bright hover:text-ink-muted disabled:opacity-50"
        >
          <FolderIcon />
          <span className="font-heading text-[12px] font-semibold">Select folder…</span>
        </button>
      )}
    </div>
  )
}

function DemoAppCard({ app, onSelect }: { app: CodebaseApp; onSelect: () => void }) {
  const platforms = new Set<string>()
  for (const s of app.screens) {
    platforms.add(s.ios.language)
    platforms.add(s.android.language)
  }
  return (
    <button
      type="button"
      onClick={onSelect}
      className="glass-card group flex flex-col items-start gap-3 p-5 text-left transition-transform hover:-translate-y-0.5 hover:border-edge-bright"
    >
      <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-edge bg-surface-raised text-[22px]">
        {app.icon}
      </span>
      <div className="min-w-0">
        <h3 className="font-heading text-[15px] font-bold text-ink">{app.name}</h3>
        <p className="mt-1 text-[12px] leading-snug text-ink-muted">{app.description}</p>
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-1.5">
        <span className="rounded-full border border-edge bg-surface-raised px-2 py-0.5 font-heading text-[10px] font-semibold text-ink-faint">
          {app.screens.length} screen{app.screens.length === 1 ? '' : 's'}
        </span>
        <span className="rounded-full border border-edge bg-surface-raised px-2 py-0.5 font-heading text-[10px] font-semibold text-ink-faint">
          SwiftUI
        </span>
        <span className="rounded-full border border-edge bg-surface-raised px-2 py-0.5 font-heading text-[10px] font-semibold text-ink-faint">
          Flutter
        </span>
      </div>
      <span className="mt-1 font-heading text-[12px] font-bold text-accent opacity-0 transition-opacity group-hover:opacity-100">
        Analyze this app →
      </span>
    </button>
  )
}

export default function LaunchScreen({ onSelectApp, onPasteInstead, engineLive }: LaunchScreenProps) {
  const [iosPick, setIosPick] = useState<FolderPick | null>(null)
  const [androidPick, setAndroidPick] = useState<FolderPick | null>(null)
  const [reading, setReading] = useState<Side | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [notice, setNotice] = useState<{ kind: 'error' | 'info'; text: string } | null>(null)

  const handlePick = async (side: Side, fileList: FileList | null) => {
    setNotice(null)
    setReading(side)
    try {
      const files = await readFolderFiles(fileList, side === 'ios' ? ['.swift'] : ['.dart'])
      const pick: FolderPick = { files, folderName: guessFolderName(files) }
      if (side === 'ios') setIosPick(pick)
      else setAndroidPick(pick)
      if (files.length === 0) {
        setNotice({
          kind: 'error',
          text: `No ${side === 'ios' ? '.swift' : '.dart'} files found in that folder.`,
        })
      }
    } finally {
      setReading(null)
    }
  }

  const canAnalyze =
    !!iosPick?.files.length && !!androidPick?.files.length && !analyzing && reading === null

  const handleAnalyze = async () => {
    if (!iosPick || !androidPick) return
    setNotice(null)
    const { matched, unmatchedIos, unmatchedAndroid } = matchScreens(iosPick.files, androidPick.files)

    if (matched.length === 0) {
      const sample = [...unmatchedIos.slice(0, 3).map((f) => f.name), ...unmatchedAndroid.slice(0, 3).map((f) => f.name)]
      setNotice({
        kind: 'error',
        text:
          "Couldn't match any screens between the two folders — Unitem pairs files by name (e.g. LoginView.swift ↔ login_screen.dart)." +
          (sample.length ? ` Found: ${sample.join(', ')}…` : ' No SwiftUI views or Flutter widgets were found.'),
      })
      return
    }

    setAnalyzing(true)
    setProgress({ done: 0, total: matched.length })
    const screens: AppScreen[] = []
    let rulebook: Record<string, string> = {}
    for (let i = 0; i < matched.length; i++) {
      const m = matched[i]
      const result = await analyzePair(m.ios.content, m.android.content)
      if (result?.rulebook) rulebook = result.rulebook
      screens.push({
        id: m.key || `screen-${i}`,
        name: humanizeKey(m.key),
        ios: { platform: 'ios', language: 'swift', fileName: m.ios.name, code: m.ios.content },
        android: {
          platform: 'android',
          language: 'dart',
          fileName: m.android.name,
          code: m.android.content,
        },
        inconsistencies: result?.inconsistencies ?? [],
      })
      setProgress({ done: i + 1, total: matched.length })
    }

    const appName = iosPick.folderName || androidPick.folderName || 'My codebase'
    const skipped = unmatchedIos.length + unmatchedAndroid.length
    onSelectApp({
      id: `custom-${Date.now()}`,
      name: appName,
      description: `${screens.length} screen${screens.length === 1 ? '' : 's'} imported from your codebase${
        skipped ? ` · ${skipped} file${skipped === 1 ? '' : 's'} skipped (no match)` : ''
      }`,
      icon: '📦',
      rulebook,
      screens,
    })
    setAnalyzing(false)
    setProgress(null)
  }

  return (
    <div className="app-canvas flex h-screen flex-col overflow-y-auto text-ink antialiased">
      <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-6 py-10">
        <header className="flex items-center justify-between">
          <UnitemLogo />
          <div className="w-28">
            <ThemeToggle />
          </div>
        </header>

        <div className="mt-8">
          <h1 className="font-heading text-[26px] font-bold leading-tight text-ink">
            Analyze an app
          </h1>
          <p className="mt-1.5 max-w-xl text-[13px] leading-relaxed text-ink-muted">
            Compare a whole iOS + Android codebase against a shared design rulebook — every
            screen, not just one. Pick a demo app below, or point Unitem at your own iOS and
            Android source folders.
          </p>
          {engineLive === false && (
            <p className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-edge bg-surface-raised px-2.5 py-1 font-heading text-[11px] font-semibold text-ink-muted">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-ink-faint" />
              Engine offline — demo apps use their bundled findings; your own codebase will show
              code without automatic diffing until `unitem serve` is running.
            </p>
          )}
        </div>

        <section className="mt-8">
          <h2 className="nav-label !pl-0">Demo apps</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {DEMO_APPS.map((app) => (
              <DemoAppCard key={app.id} app={app} onSelect={() => onSelectApp(app)} />
            ))}
          </div>
        </section>

        <section className="mt-8">
          <h2 className="nav-label !pl-0">Your own codebase</h2>
          <div className="flex flex-col gap-3 sm:flex-row">
            <FolderPicker
              label="iOS"
              hint="SwiftUI"
              pick={iosPick}
              disabled={analyzing || reading !== null}
              onPick={(files) => handlePick('ios', files)}
              onClear={() => setIosPick(null)}
            />
            <FolderPicker
              label="Android"
              hint="Flutter"
              pick={androidPick}
              disabled={analyzing || reading !== null}
              onPick={(files) => handlePick('android', files)}
              onClear={() => setAndroidPick(null)}
            />
          </div>

          {notice && (
            <p
              role="status"
              className={`mt-3 rounded-lg px-3 py-2 text-[12px] leading-snug ${
                notice.kind === 'error'
                  ? 'bg-severity-error/10 text-severity-error ring-1 ring-severity-error/30'
                  : 'bg-accent/10 text-ink-muted ring-1 ring-edge'
              }`}
            >
              {notice.text}
            </p>
          )}

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-edge bg-surface px-4 py-3">
            <p className="text-[12px] text-ink-muted">
              {analyzing && progress
                ? `Analyzing screen ${progress.done} of ${progress.total}…`
                : reading
                  ? 'Reading files…'
                  : 'Screens are matched by file name across both folders, then diffed one by one.'}
            </p>
            <button
              onClick={handleAnalyze}
              disabled={!canAnalyze}
              className="glass-btn-primary-lg flex shrink-0 items-center gap-2 disabled:opacity-40"
            >
              {analyzing ? 'Analyzing…' : 'Analyze codebase'}
              {!analyzing && (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              )}
            </button>
          </div>
        </section>

        <footer className="mt-8 flex justify-center">
          <button
            type="button"
            onClick={onPasteInstead}
            className="font-heading text-[12px] font-semibold text-ink-faint underline-offset-4 hover:text-ink-muted hover:underline"
          >
            Or paste a single screen's code instead →
          </button>
        </footer>
      </div>
    </div>
  )
}
