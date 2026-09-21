import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'

const ENGINE = 'http://127.0.0.1:8040'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    port: 5230,
    strictPort: true,
    // The Python engine serves the world and the live stream; the dev server forwards to it.
    proxy: {
      '/api': ENGINE,
      '/ws': { target: ENGINE, ws: true },
    },
  },
})
