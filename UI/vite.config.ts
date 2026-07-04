import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  // Relative base so hashed assets resolve inside the Capacitor native
  // WebView (capacitor:// on iOS, https://localhost on Android) and Electron.
  base: './',
  plugins: [react(), tailwindcss()],
  server: {
    watch: {
      // WSL2 working on /mnt/* (Windows drive) doesn't deliver inotify events —
      // without polling, the dev server silently serves stale code forever.
      usePolling: true,
      interval: 400,
    },
  },
})
