import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

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
      // Frappe SDK routes — direct to ERPNext (must be listed before the generic /api catch-all)
      '/api/method': { target: 'http://localhost:8001', changeOrigin: true },
      '/api/resource': { target: 'http://localhost:8001', changeOrigin: true },
      '/files': { target: 'http://localhost:8001', changeOrigin: true },
      // Remaining /api/* not matched above → ERPNext
      '/api': { target: 'http://localhost:8001', changeOrigin: true },
      // Local catalog images (move folder to public/catalog_images/ for dev)
      '/catalog_images': { target: 'http://localhost:8001', changeOrigin: true },
    },
  },
})
