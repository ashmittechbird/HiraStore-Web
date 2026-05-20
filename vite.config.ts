import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { execSync } from 'child_process'

// Resolve WSL2 backend — try wsl hostname first, fall back to localhost
function getBackendUrl(): string {
  try {
    const ip = execSync('wsl hostname -I', { timeout: 3000 }).toString().trim().split(' ')[0]
    if (ip && /^\d+\.\d+\.\d+\.\d+$/.test(ip)) return `http://${ip}:8001`
  } catch { /* ignore */ }
  return 'http://localhost:8001'
}

const backend = getBackendUrl()

export default defineConfig({
  base: '/store/',
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    proxy: {
      '/api/method': { target: backend, changeOrigin: true },
      '/api/resource': { target: backend, changeOrigin: true },
      '/files': { target: backend, changeOrigin: true },
      '/api': { target: backend, changeOrigin: true },
      '/catalog_images': { target: backend, changeOrigin: true },
    },
  },
})
