// ─────────────────────────────────────────────────────────────────────────────
// preload — runs in an isolated context with Node access, bridges a narrow,
// serializable API onto `window.deviceBridge` for the renderer. The renderer
// itself never touches `child_process` directly (contextIsolation stays on).
// ─────────────────────────────────────────────────────────────────────────────

const { contextBridge, ipcRenderer } = require('electron')

const invoke = (channel) => (...args) => ipcRenderer.invoke(channel, ...args)

contextBridge.exposeInMainWorld('deviceBridge', {
  ios: {
    list: invoke('device:ios:list'),
    boot: invoke('device:ios:boot'),
    open: invoke('device:ios:open'),
    shutdown: invoke('device:ios:shutdown'),
    screenshot: invoke('device:ios:screenshot'),
    install: invoke('device:ios:install'),
    launch: invoke('device:ios:launch'),
    sampleInfo: invoke('device:ios:sample-info'),
    buildSample: invoke('device:ios:sample-build'),
  },
  android: {
    listAvds: invoke('device:android:list-avds'),
    listDevices: invoke('device:android:list-devices'),
    launchEmulator: invoke('device:android:launch-emulator'),
    waitForBoot: invoke('device:android:wait-for-boot'),
    screenshot: invoke('device:android:screenshot'),
    install: invoke('device:android:install'),
    launchApp: invoke('device:android:launch-app'),
  },
  pickFile: invoke('device:pick-file'),
})
