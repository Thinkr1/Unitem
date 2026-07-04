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

function androidSdkRoot() {
  return process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT || null
}

async function firstWorkingBin(name, candidates) {
  for (const bin of candidates) {
    try {
      await fs.access(bin)
      return bin
    } catch {
      // try next
    }
  }
  return name // let PATH resolution have a go
}

async function resolveAndroidBin(name) {
  const root = androidSdkRoot()
  const candidates = root
    ? [path.join(root, 'emulator', name), path.join(root, 'platform-tools', name)]
    : []
  return firstWorkingBin(name, candidates)
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

async function bootIOSSimulator(udid) {
  try {
    await run('xcrun', ['simctl', 'boot', udid])
  } catch (err) {
    if (!/already booted/i.test(err.stderr ?? '')) throw err
  }
  // Best-effort: bring up the actual Simulator.app window. Non-fatal if it
  // fails (e.g. no GUI session) — screenshots still work headless.
  try {
    await run('open', ['-a', 'Simulator', '--args', '-CurrentDeviceUDID', udid])
  } catch {
    // ignore
  }
  return { udid }
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

/** Boots an AVD as a detached background process; does not wait for boot. */
async function launchAndroidEmulator(avdName) {
  const bin = await resolveAndroidBin('emulator')
  const child = spawn(bin, ['-avd', avdName, '-netdelay', 'none', '-netspeed', 'full'], {
    detached: true,
    stdio: 'ignore',
  })
  child.unref()
  return { avdName, pid: child.pid }
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
