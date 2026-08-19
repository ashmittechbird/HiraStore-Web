import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

/**
 * Frappe backend that has the `hira` app + ERPNext installed.
 * Override with VITE_FRAPPE_URL in .env.local when the bench moves.
 *
 * When it's unreachable the app detects that at runtime and serves the bundled
 * catalog instead, so `npm run dev` works with or without a backend.
 */
const backend = process.env.VITE_FRAPPE_URL || 'http://172.30.38.114:8001'

/**
 * Base path per target:
 *   dev            -> /store/                        (matches the Frappe route)
 *   build          -> /assets/hirastore/store/       (served by Frappe)
 *   build --mode vercel -> /                         (root of the Vercel domain)
 *
 * VITE_BASE overrides all of them.
 */
function resolveBase(command: string, mode: string): string {
  if (process.env.VITE_BASE) return process.env.VITE_BASE
  if (command !== 'build') return '/store/'
  if (mode === 'vercel') return '/'
  return '/assets/hirastore/store/'
}

export default defineConfig(({ command, mode }) => ({
  base: resolveBase(command, mode),
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    // Frappe serves its desk assets from /assets/*, and we proxy that prefix
    // straight through to the bench so /app works. So the storefront's own
    // bundles have to live somewhere else or the two collide.
    assetsDir: 'static',
    // Keep the vendor split small and cacheable; the catalog is the big payload.
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
    chunkSizeWarningLimit: 900,
  },
  server: {
    port: 8001,
    proxy: (() => {
      // changeOrigin rewrites the Host header to match the target, which is what
      // a real Frappe site expects.
      //
      // The short timeouts matter: when the bench is down or off-VPN, a TCP
      // connect hangs for ~20s by default and every page load stalls behind it.
      // Failing fast lets the runtime fall back to demo mode straight away.
      const proxyOpts = {
        target: backend,
        changeOrigin: true,
        secure: false,
        timeout: 3000,
        proxyTimeout: 3000,
      }
      // Mirrors the rewrites in vercel.json so /app behaves the same in dev.
      // Vite serves its own dev assets under the base (/store/), which leaves
      // /assets free for the Frappe desk's bundles.
      return {
        '/api/method': proxyOpts,
        '/api/resource': proxyOpts,
        '/api': proxyOpts,
        '/files': proxyOpts,
        '/private': proxyOpts,
        '/app': proxyOpts,
        '/assets': proxyOpts,
      }
    })(),
  },
}))
