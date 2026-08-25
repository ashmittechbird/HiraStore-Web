/**
 * Runtime configuration.
 *
 * The storefront runs in two modes:
 *
 *  - `frappe` — a reachable Frappe/ERPNext backend answers /api/method/*.
 *               Real items, real auth, real Sales Orders, real Square payments.
 *  - `demo`   — no backend (Vercel preview, laptop with the VPN off, client demo).
 *               The bundled catalog and a localStorage-backed store take over so
 *               every screen still works end to end.
 *
 * Mode is detected at runtime, never hard-coded, so the same build works in both.
 */

/** Router basename, derived from Vite's base so /store/ and / both work. */
export const ROUTER_BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

/** Absolute URL for a file in public/ — always correct whatever the base path is. */
export function asset(p: string): string {
  return `${import.meta.env.BASE_URL}${p.replace(/^\//, '')}`;
}

/** Where product photos live. Overridable for the Frappe asset pipeline. */
export const CATALOG_BASE =
  (import.meta.env.VITE_CATALOG_BASE as string) || asset('catalog_images');

/** Home URL — used for hard redirects that can't go through the router. */
export const HOME_URL = import.meta.env.BASE_URL;

/**
 * Force a mode instead of probing. Useful for local testing:
 *   VITE_BACKEND_MODE=demo npm run dev
 */
export const FORCED_MODE = (import.meta.env.VITE_BACKEND_MODE as string) || '';

/** How long to wait for the backend probe before falling back to demo. */
export const PROBE_TIMEOUT_MS = 2500;

/** Free shipping threshold, and the flat rate below it. Shared by cart + checkout. */
export const FREE_SHIPPING_OVER = 100;
export const SHIPPING_FLAT = 5;

export function shippingFor(subtotal: number): number {
  return subtotal >= FREE_SHIPPING_OVER ? 0 : SHIPPING_FLAT;
}
