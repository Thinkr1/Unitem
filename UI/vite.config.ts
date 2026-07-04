import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  // Relative base so hashed assets resolve inside the Capacitor native
  // WebView (capacitor:// on iOS, https://localhost on Android) and Electron.
  base: './',
  plugins: [react(), tailwindcss()],
})
