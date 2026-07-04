import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.unitem.app',
  appName: 'Unitem',
  webDir: 'dist',
  server: {
    // The Android panel embeds DartPad (live Flutter render); the WebView
    // must be allowed to navigate/load that origin inside the iframe.
    allowNavigation: ['dartpad.dev', '*.dartpad.dev'],
  },
}

export default config
