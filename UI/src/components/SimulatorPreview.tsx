import { useEffect, useRef, useState } from 'react'
import type {
  AndroidAvdInfo,
  AndroidDeviceInfo,
  IOSSimulatorInfo,
} from '../types/deviceBridge'

// ─────────────────────────────────────────────────────────────────────────────
// SimulatorPreview shows a *real* iOS Simulator (via `xcrun simctl`) or a real
// Android emulator (via `emulator`/`adb`), streamed as polled screenshots.
//
// This only works inside the Electron shell (`npm run dev`), because it needs
// `child_process` access in the main process — see `electron/deviceBridge.cjs`
// and `electron/preload.cjs`. In the plain browser dev server
// (`npm run dev:vite`) `window.deviceBridge` is undefined and we show an
// explainer instead of pretending to stream a device.
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
        Real device streaming needs the Electron shell, not the browser dev
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

function Screen({ dataUrl, loading }: { dataUrl: string | null; loading: boolean }) {
  return (
    <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-black">
      {dataUrl ? (
        <img
          src={dataUrl}
          alt="Live device screen"
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

// ── iOS ──────────────────────────────────────────────────────────────────────

function IOSSimulatorPanel({ bridge }: { bridge: NonNullable<Window['deviceBridge']> }) {
  const [devices, setDevices] = useState<IOSSimulatorInfo[]>([])
  const [udid, setUdid] = useState<string>('')
  const [booting, setBooting] = useState(false)
  const [screenshot, setScreenshot] = useState<string | null>(null)
  const [bundleId, setBundleId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const pollRef = useRef<number | null>(null)

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

  const startPolling = (targetUdid: string) => {
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

  const onBoot = async () => {
    if (!udid) return
    setBooting(true)
    setError(null)
    try {
      await bridge.ios.boot(udid)
      startPolling(udid)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBooting(false)
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
          {booting ? 'Booting…' : 'Boot'}
        </ToolbarButton>
      </Toolbar>

      {error && <ErrorNote message={error} />}
      <Screen dataUrl={screenshot} loading={booting} />

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

  const startPolling = (targetSerial: string) => {
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

  const onBoot = async () => {
    if (!avdName) return
    setBooting(true)
    setError(null)
    try {
      await bridge.android.launchEmulator(avdName)
      const { serial: bootedSerial } = await bridge.android.waitForBoot()
      setSerial(bootedSerial)
      startPolling(bootedSerial)
      refreshDevices()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBooting(false)
    }
  }

  const onAttach = () => {
    if (!serial) return
    startPolling(serial)
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
          {booting ? 'Booting…' : 'Boot'}
        </ToolbarButton>
      </Toolbar>

      {devices.length > 0 && (
        <Toolbar>
          <DeviceSelect
            value={serial}
            onChange={setSerial}
            options={devices.map((d) => ({ value: d.serial, label: `${d.serial} (${d.state})` }))}
            placeholder="No running devices"
          />
          <ToolbarButton onClick={onAttach} disabled={!serial}>
            Attach
          </ToolbarButton>
        </Toolbar>
      )}

      {error && <ErrorNote message={error} />}
      <Screen dataUrl={screenshot} loading={booting} />

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
