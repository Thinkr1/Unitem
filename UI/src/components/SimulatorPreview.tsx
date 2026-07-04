import { useEffect, useRef, useState } from 'react'
import type {
  AndroidAvdInfo,
  AndroidDeviceInfo,
  IOSSimulatorInfo,
} from '../types/deviceBridge'

// ─────────────────────────────────────────────────────────────────────────────
// SimulatorPreview's job is to put a REAL, interactive Simulator.app / Android
// Emulator window on screen — a separate native window you can click and type
// into, not a picture of one. "Boot" always tries to bring that native window
// to the front and reports plainly whether it succeeded.
//
// The in-app screenshot mirror below is a secondary, opt-in convenience (e.g.
// for glancing at state without alt-tabbing) — it is a *read-only, ~1fps
// picture*, explicitly labeled as such so it's never mistaken for "the
// simulator" itself.
//
// This only works inside the Electron shell (`npm run dev`), because it needs
// `child_process` access in the main process — see `electron/deviceBridge.cjs`
// and `electron/preload.cjs`. In the plain browser dev server
// (`npm run dev:vite`) `window.deviceBridge` is undefined.
// ─────────────────────────────────────────────────────────────────────────────

const SCREENSHOT_INTERVAL_MS = 1000

interface SimulatorPreviewProps {
  platform: 'ios' | 'android'
}

export default function SimulatorPreview({ platform }: SimulatorPreviewProps) {
  const bridge = typeof window !== 'undefined' ? window.deviceBridge : undefined

  if (!bridge) {
    return <Unavailable platform={platform} />
  }

  return platform === 'ios' ? (
    <IOSSimulatorPanel bridge={bridge} />
  ) : (
    <AndroidEmulatorPanel bridge={bridge} />
  )
}

function Unavailable({ platform }: { platform: 'ios' | 'android' }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 px-8 text-center">
      <p className="font-heading text-[12.5px] font-semibold text-ink">
        Live {platform === 'ios' ? 'iOS Simulator' : 'Android emulator'} unavailable
      </p>
      <p className="max-w-xs text-[11px] leading-snug text-ink-faint">
        Launching a real device needs the Electron shell, not the browser dev
        server. Run <code className="text-ink-muted">npm run dev</code> (not{' '}
        <code className="text-ink-muted">npm run dev:vite</code>) from{' '}
        <code className="text-ink-muted">UI/</code>.
        {platform === 'ios'
          ? ' It also requires macOS with Xcode + the Simulator installed.'
          : ' It also requires the Android SDK (emulator, adb, and at least one AVD).'}
      </p>
    </div>
  )
}

function ErrorNote({ message }: { message: string }) {
  return (
    <div className="mx-3 mb-2 rounded-lg border border-severity-error/30 bg-severity-error/10 px-3 py-2 text-[10.5px] leading-snug text-severity-error">
      {message}
    </div>
  )
}

function StatusNote({ tone, message }: { tone: 'success' | 'warning' | 'progress'; message: string }) {
  const cls =
    tone === 'success'
      ? 'border-accent/40 bg-accent/10 text-ink'
      : tone === 'warning'
        ? 'border-severity-warning/30 bg-severity-warning/10 text-severity-warning'
        : 'border-edge-bright/50 bg-surface-deep text-ink-muted'
  return <div className={`mx-3 mb-2 rounded-lg border px-3 py-2 text-[10.5px] leading-snug ${cls}`}>{message}</div>
}

// ── iOS ──────────────────────────────────────────────────────────────────────

type SampleAppStatus = 'idle' | 'booting' | 'checking' | 'building' | 'installing' | 'launching' | 'done'

const SAMPLE_STATUS_LABEL: Record<SampleAppStatus, string> = {
  idle: '',
  booting: 'Booting the simulator…',
  checking: 'Checking for a built sample app…',
  building: 'Building sample-ios (first time only — this can take a minute or two)…',
  installing: 'Installing the sample app…',
  launching: 'Launching the sample app…',
  done: '✓ Sample Login app launched — check the Simulator.app window.',
}

function IOSSimulatorPanel({ bridge }: { bridge: NonNullable<Window['deviceBridge']> }) {
  const [devices, setDevices] = useState<IOSSimulatorInfo[]>([])
  const [udid, setUdid] = useState<string>('')
  const [booting, setBooting] = useState(false)
  const [gui, setGui] = useState<{ ok: boolean; error: string | null } | null>(null)
  const [mirrorOn, setMirrorOn] = useState(false)
  const [screenshot, setScreenshot] = useState<string | null>(null)
  const [bundleId, setBundleId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [sampleStatus, setSampleStatus] = useState<SampleAppStatus>('idle')
  const pollRef = useRef<number | null>(null)
  const sampleBusy = sampleStatus !== 'idle' && sampleStatus !== 'done'

  const refreshDevices = async () => {
    setError(null)
    try {
      const list = await bridge.ios.list()
      setDevices(list)
      if (!udid && list.length > 0) setUdid(list[0].udid)
    } catch (err) {
      setError((err as Error).message)
    }
  }

  useEffect(() => {
    refreshDevices()
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const stopMirror = () => {
    if (pollRef.current) window.clearInterval(pollRef.current)
    pollRef.current = null
    setScreenshot(null)
  }

  const startMirror = (targetUdid: string) => {
    if (pollRef.current) window.clearInterval(pollRef.current)
    pollRef.current = window.setInterval(async () => {
      try {
        const base64 = await bridge.ios.screenshot(targetUdid)
        setScreenshot(`data:image/png;base64,${base64}`)
      } catch (err) {
        setError((err as Error).message)
      }
    }, SCREENSHOT_INTERVAL_MS)
  }

  useEffect(() => {
    if (mirrorOn && udid) startMirror(udid)
    else stopMirror()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mirrorOn])

  const onBoot = async () => {
    if (!udid) return
    setBooting(true)
    setError(null)
    setGui(null)
    try {
      const result = await bridge.ios.boot(udid)
      setGui({ ok: result.openedGui, error: result.openError })
      if (mirrorOn) startMirror(udid)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBooting(false)
    }
  }

  const onOpenAgain = async () => {
    if (!udid) return
    try {
      await bridge.ios.open(udid)
      setGui({ ok: true, error: null })
    } catch (err) {
      setGui({ ok: false, error: (err as Error).message })
    }
  }

  const onInstall = async () => {
    const appPath = await bridge.pickFile({ directory: true })
    if (!appPath || !udid) return
    try {
      await bridge.ios.install(udid, appPath)
    } catch (err) {
      setError((err as Error).message)
    }
  }

  const onLaunch = async () => {
    if (!udid || !bundleId) return
    try {
      await bridge.ios.launch(udid, bundleId)
    } catch (err) {
      setError((err as Error).message)
    }
  }

  /**
   * The one-click path: boot the simulator if needed, build sample-ios/ if it
   * hasn't been built yet (slow, one-time), then install + launch it — so
   * something real actually shows up instead of just the simulator home
   * screen. Mirrors what `sample-ios/run.sh` does standalone.
   */
  const onRunSampleApp = async () => {
    if (!udid) return
    setError(null)
    try {
      if (!gui?.ok) {
        setSampleStatus('booting')
        const bootResult = await bridge.ios.boot(udid)
        setGui({ ok: bootResult.openedGui, error: bootResult.openError })
      }

      setSampleStatus('checking')
      const info = await bridge.ios.sampleInfo()
      let { appPath, bundleId: sampleBundleId } = info
      if (!info.exists) {
        setSampleStatus('building')
        const built = await bridge.ios.buildSample()
        appPath = built.appPath
        sampleBundleId = built.bundleId
      }

      setSampleStatus('installing')
      await bridge.ios.install(udid, appPath)

      setSampleStatus('launching')
      await bridge.ios.launch(udid, sampleBundleId)

      setSampleStatus('done')
    } catch (err) {
      setError((err as Error).message)
      setSampleStatus('idle')
    }
  }

  const onRebuildSampleApp = async () => {
    setError(null)
    setSampleStatus('building')
    try {
      await bridge.ios.buildSample()
      setSampleStatus('idle')
    } catch (err) {
      setError((err as Error).message)
      setSampleStatus('idle')
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Toolbar>
        <DeviceSelect
          value={udid}
          onChange={setUdid}
          options={devices.map((d) => ({ value: d.udid, label: `${d.name} · ${d.runtime}` }))}
          placeholder="No simulators found"
        />
        <ToolbarButton onClick={refreshDevices}>Refresh</ToolbarButton>
        <ToolbarButton onClick={onBoot} disabled={!udid || booting} primary>
          {booting ? 'Opening…' : 'Open Simulator'}
        </ToolbarButton>
      </Toolbar>

      {error && <ErrorNote message={error} />}
      {gui?.ok && (
        <StatusNote
          tone="success"
          message="Simulator.app should now be the front window — switch to it (⌘-Tab) to tap and type directly."
        />
      )}
      {gui && !gui.ok && (
        <StatusNote
          tone="warning"
          message={`Device booted, but couldn't bring up the Simulator.app window automatically (${gui.error}). Try again, or open Simulator.app yourself from Spotlight — it will show the already-booted device.`}
        />
      )}
      {gui && !gui.ok && (
        <div className="mx-3 -mt-1 mb-2">
          <ToolbarButton onClick={onOpenAgain}>Try opening the window again</ToolbarButton>
        </div>
      )}

      <Toolbar>
        <ToolbarButton onClick={onRunSampleApp} disabled={!udid || sampleBusy} primary>
          {sampleBusy ? 'Working…' : 'Run Sample Login App'}
        </ToolbarButton>
        <ToolbarButton onClick={onRebuildSampleApp} disabled={sampleBusy}>
          Rebuild
        </ToolbarButton>
      </Toolbar>
      {sampleStatus !== 'idle' && (
        <StatusNote
          tone={sampleStatus === 'done' ? 'success' : 'progress'}
          message={SAMPLE_STATUS_LABEL[sampleStatus]}
        />
      )}

      <MirrorToggle enabled={mirrorOn} onChange={setMirrorOn} label="Mirror this device's screen in-panel" />
      {mirrorOn && <Screen dataUrl={screenshot} loading={booting} />}

      <Toolbar>
        <ToolbarButton onClick={onInstall} disabled={!udid}>
          Install .app…
        </ToolbarButton>
        <input
          value={bundleId}
          onChange={(e) => setBundleId(e.target.value)}
          placeholder="com.example.App"
          className="min-w-0 flex-1 rounded-md bg-surface-deep px-2 py-1 font-mono text-[10.5px] text-ink placeholder:text-ink-faint focus:outline-none"
        />
        <ToolbarButton onClick={onLaunch} disabled={!udid || !bundleId}>
          Launch
        </ToolbarButton>
      </Toolbar>
    </div>
  )
}

// ── Android ──────────────────────────────────────────────────────────────────

function AndroidEmulatorPanel({ bridge }: { bridge: NonNullable<Window['deviceBridge']> }) {
  const [avds, setAvds] = useState<AndroidAvdInfo[]>([])
  const [avdName, setAvdName] = useState('')
  const [devices, setDevices] = useState<AndroidDeviceInfo[]>([])
  const [serial, setSerial] = useState<string>('')
  const [booting, setBooting] = useState(false)
  const [launched, setLaunched] = useState(false)
  const [mirrorOn, setMirrorOn] = useState(false)
  const [screenshot, setScreenshot] = useState<string | null>(null)
  const [packageName, setPackageName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const pollRef = useRef<number | null>(null)

  const refreshAvds = async () => {
    setError(null)
    try {
      const list = await bridge.android.listAvds()
      setAvds(list)
      if (!avdName && list.length > 0) setAvdName(list[0].name)
    } catch (err) {
      setError((err as Error).message)
    }
  }

  const refreshDevices = async () => {
    try {
      const list = await bridge.android.listDevices()
      setDevices(list)
      if (!serial && list.length > 0) setSerial(list[0].serial)
    } catch {
      // adb not available yet — surfaced via the AVD list error already
    }
  }

  useEffect(() => {
    refreshAvds()
    refreshDevices()
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const stopMirror = () => {
    if (pollRef.current) window.clearInterval(pollRef.current)
    pollRef.current = null
    setScreenshot(null)
  }

  const startMirror = (targetSerial: string) => {
    if (pollRef.current) window.clearInterval(pollRef.current)
    pollRef.current = window.setInterval(async () => {
      try {
        const base64 = await bridge.android.screenshot(targetSerial)
        setScreenshot(`data:image/png;base64,${base64}`)
      } catch (err) {
        setError((err as Error).message)
      }
    }, SCREENSHOT_INTERVAL_MS)
  }

  useEffect(() => {
    if (mirrorOn && serial) startMirror(serial)
    else stopMirror()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mirrorOn])

  const onBoot = async () => {
    if (!avdName) return
    setBooting(true)
    setError(null)
    setLaunched(false)
    try {
      // launchEmulator throws if the process fails to start at all (bad
      // path, bad AVD) instead of silently "succeeding" — see deviceBridge.
      await bridge.android.launchEmulator(avdName)
      setLaunched(true)
      const { serial: bootedSerial } = await bridge.android.waitForBoot()
      setSerial(bootedSerial)
      if (mirrorOn) startMirror(bootedSerial)
      refreshDevices()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBooting(false)
    }
  }

  const onInstall = async () => {
    const apkPath = await bridge.pickFile({
      filters: [{ name: 'Android package', extensions: ['apk'] }],
    })
    if (!apkPath || !serial) return
    try {
      await bridge.android.install(serial, apkPath)
    } catch (err) {
      setError((err as Error).message)
    }
  }

  const onLaunch = async () => {
    if (!serial || !packageName) return
    try {
      await bridge.android.launchApp(serial, packageName)
    } catch (err) {
      setError((err as Error).message)
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Toolbar>
        <DeviceSelect
          value={avdName}
          onChange={setAvdName}
          options={avds.map((a) => ({ value: a.name, label: a.name }))}
          placeholder="No AVDs found"
        />
        <ToolbarButton onClick={refreshAvds}>Refresh</ToolbarButton>
        <ToolbarButton onClick={onBoot} disabled={!avdName || booting} primary>
          {booting ? 'Starting…' : 'Launch Emulator'}
        </ToolbarButton>
      </Toolbar>

      {error && <ErrorNote message={error} />}
      {launched && !error && (
        <StatusNote
          tone="success"
          message="A real Android Emulator window has been started — look for a new window on your desktop (first boot can take 30–90s). It's fully interactive: click and type directly into it."
        />
      )}

      {devices.length > 0 && (
        <Toolbar>
          <DeviceSelect
            value={serial}
            onChange={setSerial}
            options={devices.map((d) => ({ value: d.serial, label: `${d.serial} (${d.state})` }))}
            placeholder="No running devices"
          />
        </Toolbar>
      )}

      <MirrorToggle enabled={mirrorOn} onChange={setMirrorOn} label="Mirror this device's screen in-panel" />
      {mirrorOn && <Screen dataUrl={screenshot} loading={booting} />}

      <Toolbar>
        <ToolbarButton onClick={onInstall} disabled={!serial}>
          Install .apk…
        </ToolbarButton>
        <input
          value={packageName}
          onChange={(e) => setPackageName(e.target.value)}
          placeholder="com.example.app"
          className="min-w-0 flex-1 rounded-md bg-surface-deep px-2 py-1 font-mono text-[10.5px] text-ink placeholder:text-ink-faint focus:outline-none"
        />
        <ToolbarButton onClick={onLaunch} disabled={!serial || !packageName}>
          Launch
        </ToolbarButton>
      </Toolbar>
    </div>
  )
}

// ── Shared bits ──────────────────────────────────────────────────────────────

function Screen({ dataUrl, loading }: { dataUrl: string | null; loading: boolean }) {
  return (
    <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-black">
      {dataUrl ? (
        <img
          src={dataUrl}
          alt="Mirrored device screen (read-only)"
          className="max-h-full max-w-full object-contain"
          draggable={false}
        />
      ) : (
        <span className="text-[11px] text-ink-faint">
          {loading ? 'Waiting for first frame…' : 'No device booted yet'}
        </span>
      )}
    </div>
  )
}

function MirrorToggle({
  enabled,
  onChange,
  label,
}: {
  enabled: boolean
  onChange: (value: boolean) => void
  label: string
}) {
  return (
    <label className="flex shrink-0 cursor-pointer items-center gap-2 px-3 pb-1 text-[10.5px] text-ink-faint">
      <input
        type="checkbox"
        checked={enabled}
        onChange={(e) => onChange(e.target.checked)}
        className="h-3 w-3 accent-info-blue"
      />
      {label}
      <span className="text-ink-faint/70">(read-only, ~1fps — the real window above is the interactive one)</span>
    </label>
  )
}

function Toolbar({ children }: { children: React.ReactNode }) {
  return <div className="flex shrink-0 items-center gap-1.5 px-3 py-2">{children}</div>
}

function ToolbarButton({
  onClick,
  disabled,
  primary,
  children,
}: {
  onClick: () => void
  disabled?: boolean
  primary?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`shrink-0 rounded-md px-2.5 py-1 font-heading text-[10.5px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
        primary
          ? 'bg-info-blue text-white hover:opacity-90'
          : 'bg-surface-deep text-ink-muted hover:text-ink'
      }`}
    >
      {children}
    </button>
  )
}

function DeviceSelect({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string }[]
  placeholder: string
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="min-w-0 flex-1 rounded-md bg-surface-deep px-2 py-1 text-[10.5px] text-ink focus:outline-none"
    >
      {options.length === 0 && <option value="">{placeholder}</option>}
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  )
}
