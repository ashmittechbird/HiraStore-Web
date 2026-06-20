import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// Frappe backend that has the `hira` app + ERPNext installed.
// Override via VITE_FRAPPE_URL in a local .env if you move the site.
const backend = (process.env.VITE_FRAPPE_URL as string) || 'http://172.30.38.114:8001'

export default defineConfig(({ command }) => ({
  // Dev server runs the app at /store/; production assets are served by Frappe
  // from apps/hirastore/hirastore/public/store/ at /assets/hirastore/store/.
  base: command === 'build' ? '/assets/hirastore/store/' : '/store/',
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    proxy: (() => {
      // changeOrigin rewrites the Host header to match the target, which is what the
      // real Frappe site at 172.30.38.114:8001 expects. (The old config forced
      // Host: hirastore.local which doesn't exist there.)
      const proxyOpts = {
        target: backend,
        changeOrigin: true,
        secure: false,
      };
      return {
        '/api/method': proxyOpts,
        '/api/resource': proxyOpts,
        '/files': proxyOpts,
        '/api': proxyOpts,
        '/catalog_images': proxyOpts,
        '/app': proxyOpts,
        '/assets': proxyOpts,
        '/login': proxyOpts,
        '/private': proxyOpts,
      };
    })(),
    port: 8001,
  },
}))
