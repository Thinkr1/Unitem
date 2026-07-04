const { app, BrowserWindow } = require('electron')

const DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL ?? 'http://127.0.0.1:5173'

function createWindow() {
  const win = new BrowserWindow({
    width: 1600,
    height: 1000,
    minWidth: 1100,
    minHeight: 700,
    title: 'Unitem',
    backgroundColor: '#0d0d0e',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 12 },
  })

  win.loadURL(DEV_SERVER_URL)
}

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  app.quit()
})
