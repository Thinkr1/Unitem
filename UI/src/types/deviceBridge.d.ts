// ─────────────────────────────────────────────────────────────────────────────
// Ambient types for the `window.deviceBridge` API exposed by
// `electron/preload.cjs`. Only present when the app is running inside the
// Electron shell (`npm run dev`); undefined in the plain browser dev server.
// ─────────────────────────────────────────────────────────────────────────────

export interface IOSSimulatorInfo {
  udid: string
  name: string
  state: 'Booted' | 'Shutdown' | string
  runtime: string
}

export interface AndroidAvdInfo {
  name: string
}

export interface AndroidDeviceInfo {
  serial: string
  state: string
  isEmulator: boolean
}

export interface PickFileOptions {
  directory?: boolean
  filters?: { name: string; extensions: string[] }[]
}

export interface DeviceBridge {
  ios: {
    list(): Promise<IOSSimulatorInfo[]>
    boot(udid: string): Promise<{ udid: string; openedGui: boolean; openError: string | null }>
    open(udid: string): Promise<void>
    shutdown(udid: string): Promise<{ udid: string }>
    screenshot(udid: string): Promise<string> // base64 PNG
    install(udid: string, appPath: string): Promise<{ udid: string; appPath: string }>
    launch(udid: string, bundleId: string): Promise<{ udid: string; bundleId: string }>
  }
  android: {
    listAvds(): Promise<AndroidAvdInfo[]>
    listDevices(): Promise<AndroidDeviceInfo[]>
    launchEmulator(avdName: string): Promise<{ avdName: string; pid: number | undefined }>
    waitForBoot(serial?: string): Promise<{ serial: string }>
    screenshot(serial: string): Promise<string> // base64 PNG
    install(serial: string, apkPath: string): Promise<{ serial: string; apkPath: string }>
    launchApp(serial: string, packageName: string): Promise<{ serial: string; packageName: string }>
  }
  pickFile(options?: PickFileOptions): Promise<string | null>
}

declare global {
  interface Window {
    deviceBridge?: DeviceBridge
  }
}
