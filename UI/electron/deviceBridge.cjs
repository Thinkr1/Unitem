// ─────────────────────────────────────────────────────────────────────────────
// deviceBridge — shells out to the real platform tooling so the renderer can
// show an actual iOS Simulator (via `xcrun simctl`) and a real Android
// emulator (via the Android SDK's `emulator` + `adb`) instead of the drawn
// mockups in LoginPreview/FlutterPreview.
//
// This only runs in the Electron **main** process (full Node access). None of
// it is reachable from the plain browser dev server (`npm run dev:vite`) —
// see `preload.cjs` for the narrow API surface exposed to the renderer.
//
// Platform reality:
//   - iOS Simulator is macOS + Xcode only. `xcrun` simply won't exist
//     elsewhere; every function below fails fast with a clear error.
//   - Android emulator needs the Android SDK (`emulator`, `adb`,
//     `platform-tools`) on PATH (or `$ANDROID_HOME`/`$ANDROID_SDK_ROOT` set)
//     and hardware virtualization enabled (KVM/HAXM/HVF) for a usable boot
//     time — it *can* run on Linux/macOS/Windows dev machines.
// ─────────────────────────────────────────────────────────────────────────────

const { execFile, spawn } = require('node:child_process')
const fs = require('node:fs/promises')
const fsSync = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const EXEC_OPTS = { maxBuffer: 1024 * 1024 * 64 }

function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { ...EXEC_OPTS, ...opts }, (error, stdout, stderr) => {
      if (error) {
        error.stderr = stderr
        reject(error)
        return
      }
      resolve({ stdout, stderr })
    })
  })
}

/** Common default install locations, tried when $ANDROID_HOME/$ANDROID_SDK_ROOT aren't set. */
function defaultAndroidSdkCandidates() {
  const home = os.homedir()
  switch (process.platform) {
    case 'darwin':
      return [path.join(home, 'Library', 'Android', 'sdk')]
    case 'win32':
      return [path.join(process.env.LOCALAPPDATA || '', 'Android', 'Sdk')]
    default:
      return [path.join(home, 'Android', 'Sdk'), path.join(home, 'Android', 'sdk')]
  }
}

function androidSdkRoots() {
  const configured = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT
  const roots = [configured, ...defaultAndroidSdkCandidates()].filter(Boolean)
  return roots.filter((root) => fsSync.existsSync(root))
}

async function firstWorkingBin(name, candidates) {
  for (const bin of candidates) {
    try {
      await fs.access(bin, fsSync.constants.X_OK)
      return bin
    } catch {
      // try next
    }
  }
  return name // nothing found on disk — let PATH resolution have a go (and fail loudly if that misses too)
}

async function resolveAndroidBin(name) {
  const exeName = process.platform === 'win32' ? `${name}.exe` : name
  const candidates = androidSdkRoots().flatMap((root) => [
    path.join(root, 'emulator', exeName),
    path.join(root, 'platform-tools', exeName),
  ])
  return firstWorkingBin(exeName, candidates)
}

// ── iOS (xcrun simctl) ───────────────────────────────────────────────────────

async function listIOSSimulators() {
  if (process.platform !== 'darwin') {
    throw new Error('The iOS Simulator only exists on macOS. Run the app on a Mac with Xcode installed.')
  }
  const { stdout } = await run('xcrun', ['simctl', 'list', 'devices', 'available', '--json'])
  const parsed = JSON.parse(stdout)
  const devices = []
  for (const [runtime, list] of Object.entries(parsed.devices ?? {})) {
    for (const device of list) {
      devices.push({
        udid: device.udid,
        name: device.name,
        state: device.state, // 'Booted' | 'Shutdown' | ...
        runtime: runtime.replace('com.apple.CoreSimulator.SimRuntime.', '').replace(/-/g, ' '),
      })
    }
  }
  return devices
}

/**
 * Brings up the real Simulator.app GUI window, focused on `udid`. Tries a few
 * variants because `open -a Simulator` can be finicky across Xcode versions —
 * throws (with the last, most useful error) only if every variant fails.
 */
async function openIOSSimulatorApp(udid) {
  const attempts = [
    ['-a', 'Simulator', '--args', '-CurrentDeviceUDID', udid],
    ['-b', 'com.apple.iphonesimulator', '--args', '-CurrentDeviceUDID', udid],
    ['-a', 'Simulator'],
  ]
  let lastErr = null
  for (const args of attempts) {
    try {
      await run('open', args)
      return
    } catch (err) {
      lastErr = err
    }
  }
  throw new Error(
    `"open -a Simulator" failed (${lastErr?.message ?? 'unknown error'}). Confirm Xcode is ` +
      'installed and Simulator.app exists (try opening it manually from Spotlight).',
  )
}

async function bootIOSSimulator(udid) {
  try {
    await run('xcrun', ['simctl', 'boot', udid])
  } catch (err) {
    if (!/already booted/i.test(err.stderr ?? '')) throw err
  }

  // Booting via simctl alone is headless — it does NOT show a window. The
  // actual point of this feature is a real, interactive Simulator.app window,
  // so failing to open it is reported back rather than swallowed.
  try {
    await openIOSSimulatorApp(udid)
    return { udid, openedGui: true, openError: null }
  } catch (err) {
    console.error('[deviceBridge] simctl booted the device but could not open Simulator.app:', err)
    return { udid, openedGui: false, openError: err.message }
  }
}

async function shutdownIOSSimulator(udid) {
  await run('xcrun', ['simctl', 'shutdown', udid])
  return { udid }
}

async function screenshotIOSSimulator(udid) {
  const tmpFile = path.join(os.tmpdir(), `unitem-ios-${udid}-${Date.now()}.png`)
  try {
    await run('xcrun', ['simctl', 'io', udid, 'screenshot', tmpFile])
    const buf = await fs.readFile(tmpFile)
    return buf.toString('base64')
  } finally {
    fs.unlink(tmpFile).catch(() => {})
  }
}

async function installIOSApp(udid, appPath) {
  await run('xcrun', ['simctl', 'install', udid, appPath])
  return { udid, appPath }
}

async function launchIOSApp(udid, bundleId) {
  await run('xcrun', ['simctl', 'launch', udid, bundleId])
  return { udid, bundleId }
}

// ── Android (emulator + adb) ─────────────────────────────────────────────────

async function listAndroidEmulators() {
  const bin = await resolveAndroidBin('emulator')
  try {
    const { stdout } = await run(bin, ['-list-avds'])
    return stdout
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((name) => ({ name }))
  } catch (err) {
    throw new Error(
      `Could not run "emulator -list-avds" (${err.message}). Install Android Studio / the ` +
        'command-line tools and create at least one AVD, or set $ANDROID_HOME.',
    )
  }
}

async function listAndroidDevices() {
  const bin = await resolveAndroidBin('adb')
  const { stdout } = await run(bin, ['devices', '-l'])
  return stdout
    .split('\n')
    .slice(1)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('*'))
    .map((line) => {
      const [serial, state] = line.split(/\s+/)
      return { serial, state, isEmulator: serial.startsWith('emulator-') }
    })
}

/**
 * Boots an AVD as a detached background process (with its normal GUI window —
 * we never pass `-no-window`) and does not wait for boot to finish.
 *
 * `spawn()` failures (e.g. the `emulator` binary doesn't actually exist) are
 * reported asynchronously via an `'error'` event, not a thrown exception, so
 * without this guard a bad path would look like a successful launch. We give
 * the process a brief window to fail fast before declaring success.
 */
async function launchAndroidEmulator(avdName) {
  const bin = await resolveAndroidBin('emulator')
  return new Promise((resolve, reject) => {
    const child = spawn(bin, ['-avd', avdName, '-netdelay', 'none', '-netspeed', 'full'], {
      detached: true,
      stdio: 'ignore',
    })

    let settled = false
    child.once('error', (err) => {
      if (settled) return
      settled = true
      reject(
        new Error(
          `Could not start the Android emulator ("${bin}" — ${err.message}). Install the ` +
            'Android SDK (emulator + platform-tools) and set $ANDROID_HOME, or add the ' +
            'emulator binary to PATH.',
        ),
      )
    })
    child.once('exit', (code, signal) => {
      if (settled) return
      settled = true
      reject(new Error(`The Android emulator exited immediately (code ${code}, signal ${signal}). Check the AVD is valid.`))
    })

    setTimeout(() => {
      if (settled) return
      settled = true
      child.unref()
      resolve({ avdName, pid: child.pid })
    }, 500)
  })
}

/** Polls `adb` until some emulator serial reports boot_completed=1, or times out. */
async function waitForAndroidBoot(serial, timeoutMs = 120000) {
  const bin = await resolveAndroidBin('adb')
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const devices = await listAndroidDevices()
      const target = serial
        ? devices.find((d) => d.serial === serial)
        : devices.find((d) => d.isEmulator && d.state === 'device')
      if (target && target.state === 'device') {
        const { stdout } = await run(bin, ['-s', target.serial, 'shell', 'getprop', 'sys.boot_completed'])
        if (stdout.trim() === '1') return { serial: target.serial }
      }
    } catch {
      // keep polling
    }
    await new Promise((r) => setTimeout(r, 1500))
  }
  throw new Error('Timed out waiting for the Android emulator to finish booting.')
}

async function screenshotAndroidDevice(serial) {
  const bin = await resolveAndroidBin('adb')
  const { stdout } = await new Promise((resolve, reject) => {
    execFile(
      bin,
      ['-s', serial, 'exec-out', 'screencap', '-p'],
      { ...EXEC_OPTS, encoding: 'buffer' },
      (error, stdoutBuf, stderr) => {
        if (error) {
          error.stderr = stderr?.toString?.() ?? stderr
          reject(error)
          return
        }
        resolve({ stdout: stdoutBuf })
      },
    )
  })
  return Buffer.from(stdout).toString('base64')
}

async function installAndroidApp(serial, apkPath) {
  const bin = await resolveAndroidBin('adb')
  await run(bin, ['-s', serial, 'install', '-r', apkPath])
  return { serial, apkPath }
}

async function launchAndroidApp(serial, packageName) {
  const bin = await resolveAndroidBin('adb')
  await run(bin, [
    '-s',
    serial,
    'shell',
    'monkey',
    '-p',
    packageName,
    '-c',
    'android.intent.category.LAUNCHER',
    '1',
  ])
  return { serial, packageName }
}

module.exports = {
  ios: {
    list: listIOSSimulators,
    boot: bootIOSSimulator,
    open: openIOSSimulatorApp,
    shutdown: shutdownIOSSimulator,
    screenshot: screenshotIOSSimulator,
    install: installIOSApp,
    launch: launchIOSApp,
  },
  android: {
    listAvds: listAndroidEmulators,
    listDevices: listAndroidDevices,
    launchEmulator: launchAndroidEmulator,
    waitForBoot: waitForAndroidBoot,
    screenshot: screenshotAndroidDevice,
    install: installAndroidApp,
    launchApp: launchAndroidApp,
  },
}
