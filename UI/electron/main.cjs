const { app, BrowserWindow, ipcMain, dialog } = require('electron')
const path = require('node:path')
const deviceBridge = require('./deviceBridge.cjs')

const DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL ?? 'http://127.0.0.1:5173'

function createWindow() {
  const win = new BrowserWindow({
    width: 1600,
    height: 1000,
    minWidth: 1100,
    minHeight: 700,
    title: 'Unitem',
    backgroundColor: '#000000',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 12 },
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  win.loadURL(DEV_SERVER_URL)
  return win
}

// ── Device bridge IPC — see electron/deviceBridge.cjs ───────────────────────
// Every handler just forwards to the deviceBridge module; errors thrown there
// reject the renderer's `invoke()` promise with a readable message.

function registerDeviceBridgeHandlers() {
  ipcMain.handle('device:ios:list', () => deviceBridge.ios.list())
  ipcMain.handle('device:ios:boot', (_e, udid) => deviceBridge.ios.boot(udid))
  ipcMain.handle('device:ios:open', (_e, udid) => deviceBridge.ios.open(udid))
  ipcMain.handle('device:ios:shutdown', (_e, udid) => deviceBridge.ios.shutdown(udid))
  ipcMain.handle('device:ios:screenshot', (_e, udid) => deviceBridge.ios.screenshot(udid))
  ipcMain.handle('device:ios:install', (_e, udid, appPath) => deviceBridge.ios.install(udid, appPath))
  ipcMain.handle('device:ios:launch', (_e, udid, bundleId) => deviceBridge.ios.launch(udid, bundleId))
  ipcMain.handle('device:ios:sample-info', () => deviceBridge.ios.sampleInfo())
  ipcMain.handle('device:ios:sample-build', () => deviceBridge.ios.buildSample())

  ipcMain.handle('device:android:list-avds', () => deviceBridge.android.listAvds())
  ipcMain.handle('device:android:list-devices', () => deviceBridge.android.listDevices())
  ipcMain.handle('device:android:launch-emulator', (_e, avdName) => deviceBridge.android.launchEmulator(avdName))
  ipcMain.handle('device:android:wait-for-boot', (_e, serial) => deviceBridge.android.waitForBoot(serial))
  ipcMain.handle('device:android:screenshot', (_e, serial) => deviceBridge.android.screenshot(serial))
  ipcMain.handle('device:android:install', (_e, serial, apkPath) => deviceBridge.android.install(serial, apkPath))
  ipcMain.handle('device:android:launch-app', (_e, serial, packageName) =>
    deviceBridge.android.launchApp(serial, packageName),
  )

  ipcMain.handle('device:pick-file', async (_e, options = {}) => {
    const win = BrowserWindow.getFocusedWindow()
    const result = await dialog.showOpenDialog(win, {
      properties: options.directory ? ['openDirectory'] : ['openFile'],
      filters: options.filters,
    })
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  })
}

app.whenReady().then(() => {
  registerDeviceBridgeHandlers()
  const win = createWindow()
  win.maximize()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  app.quit()
})
