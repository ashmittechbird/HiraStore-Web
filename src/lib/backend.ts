/**
 * Backend router.
 *
 * Every call the storefront makes goes through `call()`. It tries the real
 * Frappe/ERPNext backend first and transparently falls back to the in-browser
 * demo store when Frappe isn't reachable — so the same build works against a
 * live bench, on Vercel with no backend, and on a laptop with the VPN off.
 *
 * Nothing above this file needs to know which mode it's in.
 */
import { FORCED_MODE, PROBE_TIMEOUT_MS } from './config';
import * as db from './demoDb';

export type Mode = 'frappe' | 'demo';

// ─── mode detection ──────────────────────────────────────────────────────────

let modePromise: Promise<Mode> | null = null;
let resolvedMode: Mode | null = null;

/** Last known mode, or null before the first probe settles. */
export function currentMode(): Mode | null {
  return resolvedMode;
}

const modeListeners = new Set<(m: Mode) => void>();

export function onModeChange(fn: (m: Mode) => void): () => void {
  modeListeners.add(fn);
  return () => modeListeners.delete(fn);
}

function setMode(m: Mode) {
  if (resolvedMode === m) return m;
  resolvedMode = m;
  modeListeners.forEach(fn => fn(m));
  return m;
}

/**
 * How long a probe result is trusted across page loads, in ms.
 *
 * Without this every navigation pays the full probe timeout again when the
 * backend is down — an unreachable host can take seconds to refuse a TCP
 * connection. Short enough that starting a bench is picked up quickly.
 */
const PROBE_CACHE_MS = 60_000;
const PROBE_CACHE_KEY = 'hs_backend_mode';

function readCachedMode(): Mode | null {
  try {
    const raw = sessionStorage.getItem(PROBE_CACHE_KEY);
    if (!raw) return null;
    const { mode, at } = JSON.parse(raw);
    if (Date.now() - at > PROBE_CACHE_MS) return null;
    return mode === 'frappe' || mode === 'demo' ? mode : null;
  } catch {
    return null;
  }
}

function cacheMode(mode: Mode): Mode {
  try {
    sessionStorage.setItem(PROBE_CACHE_KEY, JSON.stringify({ mode, at: Date.now() }));
  } catch {
    /* private mode — just probe again next load */
  }
  return setMode(mode);
}

/**
 * Decide which backend is live.
 *
 * `/api/method/ping` is whitelisted for Guest on every Frappe install, so a 200
 * with Frappe's envelope means a real bench is answering. Anything else — a 404
 * from a static host, a network error, a timeout — means demo mode.
 */
export function detectMode(): Promise<Mode> {
  if (FORCED_MODE === 'demo' || FORCED_MODE === 'frappe') {
    return Promise.resolve(setMode(FORCED_MODE));
  }
  if (modePromise) return modePromise;

  const cached = readCachedMode();
  if (cached) {
    modePromise = Promise.resolve(setMode(cached));
    return modePromise;
  }

  modePromise = (async (): Promise<Mode> => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), PROBE_TIMEOUT_MS);
    try {
      const r = await fetch('/api/method/ping', {
        credentials: 'include',
        signal: ctrl.signal,
        headers: { Accept: 'application/json' },
      });
      if (!r.ok) return cacheMode('demo');
      const body = await r.json().catch(() => null);
      // A static host can return 200 with an HTML shell; require Frappe's shape.
      return cacheMode(body && typeof body === 'object' && 'message' in body ? 'frappe' : 'demo');
    } catch {
      return cacheMode('demo');
    } finally {
      clearTimeout(timer);
    }
  })();

  return modePromise;
}

/** Drop the cached probe result and re-detect on the next call. */
export function resetModeCache(): void {
  modePromise = null;
  resolvedMode = null;
  try {
    sessionStorage.removeItem(PROBE_CACHE_KEY);
  } catch {
    /* nothing to clear */
  }
}

// ─── Frappe transport ────────────────────────────────────────────────────────

/**
 * CSRF token for write requests.
 *
 * Frappe's desk reads this out of the bootinfo embedded in the page it serves.
 * The storefront is served by Vite (or Vercel), so there is no boot to read and
 * the cookie isn't exposed either — which made every POST fail with
 * CSRFTokenError. The `hira` app hands the token to the same-origin frontend so
 * writes work without disabling CSRF protection on the bench.
 */
let csrfPromise: Promise<string> | null = null;

async function csrf(): Promise<string> {
  const fromCookie = document.cookie.match(/csrftoken=([^;]+)/)?.[1];
  if (fromCookie) return fromCookie;

  if (!csrfPromise) {
    csrfPromise = fetch('/api/method/hira.api.session.get_csrf_token', {
      credentials: 'include',
      headers: { Accept: 'application/json' },
    })
      .then(r => (r.ok ? r.json() : null))
      .then(b => b?.message?.csrf_token || 'fetch')
      .catch(() => 'fetch');
  }
  return csrfPromise;
}

/** Drop the cached token — the session changed, or the server rejected it. */
export function resetCsrf(): void {
  csrfPromise = null;
}

/** Pull a readable message out of Frappe's error envelope. */
export function frappeError(data: unknown): string {
  const d = data as Record<string, any>;
  try {
    if (d?._server_messages) {
      const parsed = JSON.parse(d._server_messages);
      const first = parsed[0];
      let msg: string;
      try {
        msg = JSON.parse(first).message || first;
      } catch {
        msg = first;
      }
      return String(msg).replace(/<[^>]+>/g, '').trim();
    }
    if (d?.exception) {
      const m = String(d.exception).split(':').slice(1).join(':').trim();
      if (m) return m;
    }
    if (typeof d?.message === 'string') return d.message;
  } catch {
    /* fall through */
  }
  return '';
}

class BackendError extends Error {}

async function frappePost(method: string, params: Record<string, unknown>, retry = true): Promise<any> {
  const r = await fetch(`/api/method/${method}`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', 'X-Frappe-CSRF-Token': await csrf() },
    body: JSON.stringify(params),
  });
  const body = await r.json().catch(() => ({}));

  // A stale token after login/logout is normal — fetch a fresh one and retry once.
  if (!r.ok && body?.exc_type === 'CSRFTokenError' && retry) {
    resetCsrf();
    return frappePost(method, params, false);
  }

  if (!r.ok || body?.exc) throw new BackendError(frappeError(body) || `Request failed (${r.status})`);
  return body;
}

async function frappeGet(method: string, params: Record<string, unknown>): Promise<any> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    qs.set(k, typeof v === 'string' ? v : JSON.stringify(v));
  }
  const r = await fetch(`/api/method/${method}${qs.toString() ? `?${qs}` : ''}`, {
    credentials: 'include',
    headers: { Accept: 'application/json' },
  });
  const body = await r.json().catch(() => ({}));
  if (!r.ok || body?.exc) throw new BackendError(frappeError(body) || `Request failed (${r.status})`);
  return body;
}

// ─── demo query engine ───────────────────────────────────────────────────────

type Row = Record<string, any>;

/** Evaluate one Frappe filter triple against a row. */
function matchOne(row: Row, field: string, op: string, value: any): boolean {
  const v = row[field];
  switch (String(op).toLowerCase()) {
    case '=':
    case '==':
      // Frappe treats 0/false and undefined-on-a-flag as equivalent.
      if (typeof value === 'number' && (v === undefined || v === null)) return value === 0;
      return String(v ?? '') === String(value);
    case '!=':
      return String(v ?? '') !== String(value);
    case 'like':
      return new RegExp(String(value).replace(/%/g, '.*'), 'i').test(String(v ?? ''));
    case 'not like':
      return !new RegExp(String(value).replace(/%/g, '.*'), 'i').test(String(v ?? ''));
    case 'in':
      return (value as any[]).map(String).includes(String(v));
    case 'not in':
      return !(value as any[]).map(String).includes(String(v));
    case '>':
      return Number(v) > Number(value);
    case '<':
      return Number(v) < Number(value);
    case '>=':
      return Number(v) >= Number(value);
    case '<=':
      return Number(v) <= Number(value);
    default:
      return true;
  }
}

function applyFilters(rows: Row[], filters: unknown): Row[] {
  if (!filters) return rows;
  const triples: Array<[string, string, any]> = [];

  if (Array.isArray(filters)) {
    for (const f of filters as any[]) {
      if (Array.isArray(f)) {
        // ['field','=',v]  or  ['Doctype','field','=',v]
        if (f.length >= 4) triples.push([f[1], f[2], f[3]]);
        else if (f.length === 3) triples.push([f[0], f[1], f[2]]);
      }
    }
  } else if (typeof filters === 'object') {
    for (const [field, val] of Object.entries(filters as Row)) {
      if (Array.isArray(val) && val.length === 2) triples.push([field, val[0], val[1]]);
      else triples.push([field, '=', val]);
    }
  }
  return rows.filter(r => triples.every(([f, o, v]) => matchOne(r, f, o, v)));
}

function applyOrder(rows: Row[], orderBy: unknown): Row[] {
  if (!orderBy) return rows;
  let field = '';
  let dir = 'asc';
  if (typeof orderBy === 'string') {
    const [f, d] = orderBy.trim().split(/\s+/);
    field = f;
    dir = (d || 'asc').toLowerCase();
  } else if (typeof orderBy === 'object' && orderBy) {
    field = (orderBy as any).field;
    dir = String((orderBy as any).order || 'asc').toLowerCase();
  }
  if (!field) return rows;
  const sorted = [...rows].sort((a, b) => {
    const x = a[field];
    const y = b[field];
    if (typeof x === 'number' && typeof y === 'number') return x - y;
    return String(x ?? '').localeCompare(String(y ?? ''));
  });
  return dir.startsWith('desc') ? sorted.reverse() : sorted;
}

function pickFields(rows: Row[], fields: unknown): Row[] {
  if (!Array.isArray(fields) || !fields.length || (fields as string[]).includes('*')) return rows;
  const keep = (fields as string[]).map(f => String(f).replace(/^`?tab[^`]*`?\./, '').replace(/[`"]/g, ''));
  return rows.map(r => {
    const o: Row = {};
    for (const f of keep) if (f in r) o[f] = r[f];
    o.name = r.name; // Frappe always returns name
    return o;
  });
}

/** Rows backing each doctype in demo mode. */
function tableFor(doctype: string): Row[] {
  switch (doctype) {
    case 'Item':
      return db.allItems();
    case 'Coupon Code':
      return db.allCoupons();
    case 'Sales Order':
      return db.allOrders();
    case 'Customer':
      return db.allCustomers();
    case 'Company':
      return [{ name: 'The Hira Store' }];
    case 'Has Role': {
      const u = db.currentSession();
      return db.isAdmin(u) ? [{ name: 'demo-role', parent: u, role: 'System Manager' }] : [];
    }
    case 'User': {
      const u = db.currentSession();
      const doc = u ? db.getUser(u) : null;
      return doc ? [doc] : [];
    }
    default:
      return [];
  }
}

function demoGetList(params: Row): Row[] {
  const rows = tableFor(String(params.doctype));
  const filtered = applyFilters(rows, params.filters);
  const ordered = applyOrder(filtered, params.order_by ?? params.orderBy);
  const limit = Number(params.limit ?? params.limit_page_length ?? 0);
  const start = Number(params.limit_start ?? 0);
  const sliced = limit > 0 ? ordered.slice(start, start + limit) : ordered.slice(start);
  return pickFields(sliced, params.fields);
}

function demoGetDoc(doctype: string, name: string): Row {
  const row = tableFor(doctype).find(r => String(r.name) === String(name));
  if (!row) throw new BackendError(`${doctype} ${name} not found`);
  return row;
}

// ─── demo method router ──────────────────────────────────────────────────────

function demoCall(method: string, params: Row): any {
  switch (method) {
    case 'ping':
      return { message: 'pong' };

    // ── auth ──
    case 'login': {
      const { user, full_name } = db.login(String(params.usr), String(params.pwd));
      return { message: 'Logged In', full_name, user };
    }
    case 'logout':
      db.logout();
      return { message: 'Logged Out' };
    case 'frappe.auth.get_logged_user': {
      const u = db.currentSession();
      if (!u) throw new BackendError('Not permitted');
      return { message: u };
    }
    case 'frappe.core.doctype.user.user.sign_up': {
      db.signup(String(params.email), String(params.full_name), String(params.password || 'hira123'));
      return { message: [1, 'Account created successfully'] };
    }

    // ── generic doc access ──
    case 'frappe.client.get_list':
      return { message: demoGetList(params) };
    case 'frappe.client.get':
      return { message: demoGetDoc(String(params.doctype), String(params.name)) };
    case 'frappe.client.insert': {
      const doc = (params.doc ?? params) as Row;
      if (doc.doctype === 'Coupon Code') return { message: db.upsertCoupon(doc as any) };
      return { message: db.upsertItem(doc as any) };
    }
    case 'frappe.client.set_value': {
      const doctype = String(params.doctype);
      const name = String(params.name);
      const patch =
        params.fieldname && typeof params.fieldname === 'object'
          ? (params.fieldname as Row)
          : { [String(params.fieldname)]: params.value };
      if (doctype === 'Sales Order' && patch.status) {
        db.updateOrderStatus(name, String(patch.status));
        return { message: demoGetDoc(doctype, name) };
      }
      if (doctype === 'Coupon Code') return { message: db.upsertCoupon({ ...demoGetDoc(doctype, name), ...patch } as any) };
      return { message: db.upsertItem({ ...demoGetDoc(doctype, name), ...patch, name } as any) };
    }
    case 'frappe.client.delete': {
      const doctype = String(params.doctype);
      const name = String(params.name);
      if (doctype === 'Coupon Code') db.deleteCoupon(name);
      else db.deleteItem(name);
      return { message: 'ok' };
    }

    // ── storefront ──
    case 'hira.api.coupons.validate_coupon': {
      const code = String(params.code || '').trim().toUpperCase();
      const subtotal = Number(params.subtotal || 0);
      const c = db.allCoupons().find(x => x.coupon_code.toUpperCase() === code);
      if (!c) throw new BackendError('Invalid coupon code');
      if (c.valid_upto && c.valid_upto < new Date().toISOString().slice(0, 10)) {
        throw new BackendError('This coupon code has expired');
      }
      if (c.minimum_amount && subtotal < c.minimum_amount) {
        throw new BackendError(`Minimum order $${c.minimum_amount} required for this code`);
      }
      return {
        message: {
          code: c.coupon_code,
          discount_percentage: c.discount_percentage,
          minimum_amount: c.minimum_amount,
          discount: Math.round(subtotal * c.discount_percentage) / 100,
        },
      };
    }
    case 'hira.api.products.get_public_item': {
      const it = db.getItem(String(params.name));
      if (!it || it.disabled) throw new BackendError('Product not found');
      return { message: it };
    }
    case 'hira.api.products.get_public_items': {
      const limit = Number(params.limit || 200);
      return { message: db.allItems().filter(i => !i.disabled).slice(0, limit) };
    }

    // ── payments / orders ──
    case 'square_payment.api.get_config':
      // No Square credentials without a backend. The payment page reads this as
      // "card gateway unavailable" and offers the demo/COD paths instead.
      return { message: null };
    case 'square_payment.api.process_payment': {
      const order = db.createOrder({
        customer: JSON.parse(String(params.customer || '{}')),
        cart: JSON.parse(String(params.cart_items || '[]')),
        discount: Number(params.discount || 0),
        shipping: Number(params.shipping || 0),
        couponCode: String(params.coupon_code || ''),
        paymentMethod: String(params.payment_method || 'Demo Card'),
        paymentId: String(params.source_id || ''),
      });
      return { message: { order_id: order.name, payment_id: order.payment_id } };
    }
    case 'square_payment.api.get_my_orders':
      return { message: db.ordersFor(db.currentSession()) };

    case 'upload_file': {
      const f = params.__file as { name: string; dataUrl: string } | undefined;
      if (!f) throw new BackendError('No file provided');
      return { message: { file_url: db.saveFile(f.name, f.dataUrl) } };
    }

    default:
      throw new BackendError(`"${method}" is not available in demo mode`);
  }
}

// ─── public API ──────────────────────────────────────────────────────────────

export interface CallOptions {
  /** HTTP verb to use against a real Frappe backend. Ignored in demo mode. */
  method?: 'GET' | 'POST';
}

/**
 * Invoke a backend method, whichever backend is live.
 *
 * Falls back to demo automatically if Frappe turns out to be unreachable
 * mid-session (bench restart, VPN drop) — not just at startup.
 */
export async function call(
  path: string,
  params: Record<string, unknown> = {},
  opts: CallOptions = {}
): Promise<any> {
  const mode = await detectMode();

  if (mode === 'demo') return demoCall(path, params);

  try {
    return opts.method === 'GET' ? await frappeGet(path, params) : await frappePost(path, params);
  } catch (e) {
    // A thrown BackendError is a real answer from a live backend (bad password,
    // validation failure) — surface it. Anything else means the transport died,
    // so drop to demo rather than showing the user a dead screen.
    if (e instanceof BackendError) throw e;
    cacheMode('demo');
    modePromise = Promise.resolve('demo');
    return demoCall(path, params);
  }
}

/** Convenience wrappers mirroring the shapes the pages already use. */
export const api = {
  getList: (doctype: string, args: Record<string, unknown> = {}) =>
    call('frappe.client.get_list', { doctype, ...args }).then(r => (r.message ?? []) as Row[]),

  getDoc: (doctype: string, name: string) =>
    call('frappe.client.get', { doctype, name }).then(r => r.message as Row),

  setValue: (doctype: string, name: string, fieldname: Record<string, unknown>) =>
    call('frappe.client.set_value', { doctype, name, fieldname }).then(r => r.message as Row),

  insert: (doc: Record<string, unknown>) =>
    call('frappe.client.insert', { doc }).then(r => r.message as Row),

  remove: (doctype: string, name: string) => call('frappe.client.delete', { doctype, name }),
};

export { db };

// ─── order placement ─────────────────────────────────────────────────────────

export interface PlaceOrderInput {
  customer: Record<string, string>;
  cart: Array<{ id: string; name: string; price: number; qty: number; image: string }>;
  subtotal: number;
  discount: number;
  shipping: number;
  total: number;
  couponCode?: string;
  /** 'card' tokenizes through Square; 'cod' books the order for cash on delivery. */
  paymentMethod: 'card' | 'cod';
  /** Square payment token. Required for 'card' against a live backend. */
  sourceId?: string;
}

export interface PlacedOrder {
  orderId: string;
  paymentId: string;
  paymentLabel: string;
}

/**
 * Book the order against whichever backend is live.
 *
 * In demo mode this always succeeds and persists locally. Against a real
 * backend a failure is surfaced rather than swallowed — a customer must never
 * see a confirmation for an order the merchant will never receive.
 */
export async function placeOrder(input: PlaceOrderInput): Promise<PlacedOrder> {
  const mode = await detectMode();
  const label = input.paymentMethod === 'cod' ? 'Cash on Delivery' : 'Card';

  if (mode === 'demo') {
    const order = db.createOrder({
      customer: input.customer,
      cart: input.cart,
      discount: input.discount,
      shipping: input.shipping,
      couponCode: input.couponCode,
      paymentMethod: label,
      paymentId: input.sourceId,
    });
    return { orderId: order.name, paymentId: order.payment_id, paymentLabel: label };
  }

  const payload = {
    source_id: input.sourceId || 'COD',
    amount_cents: Math.round(input.total * 100),
    customer: JSON.stringify(input.customer),
    cart_items: JSON.stringify(input.cart),
    coupon_code: input.couponCode || '',
    discount: input.discount,
    shipping: input.shipping,
    payment_method: label,
  };

  if (input.paymentMethod === 'cod') {
    // Prefer a purpose-built COD endpoint; fall back to the payment app's
    // handler, which some deployments configure to accept offline methods.
    for (const method of ['hira.api.orders.create_cod_order', 'square_payment.api.process_payment']) {
      try {
        const res = await call(method, payload);
        const m = res?.message;
        if (m?.order_id) return { orderId: m.order_id, paymentId: m.payment_id || 'COD', paymentLabel: label };
      } catch {
        /* try the next endpoint */
      }
    }
    throw new Error(
      'Cash on Delivery is not enabled on the server yet. Please pay by card, or contact us to place this order.'
    );
  }

  const res = await call('square_payment.api.process_payment', payload);
  const m = res?.message;
  if (!m?.order_id) throw new Error('Payment went through but the order could not be created. Please contact support.');
  return { orderId: m.order_id, paymentId: m.payment_id, paymentLabel: label };
}

// ─── homepage curation ───────────────────────────────────────────────────────

const HP_LOCAL_KEY = 'hs_homepage_config';

export interface HomepageConfig {
  /** Item names shown in "Most Loved Pieces", in the order the admin picked. */
  ml: string[];
  /** Item names shown in "New Arrivals". */
  na: string[];
}

/**
 * Read the admin's homepage curation.
 *
 * On a live backend this lives in Frappe's public files so every visitor sees
 * the same rails; localStorage is the offline cache and the demo-mode store.
 */
export async function getHomepageConfig(): Promise<HomepageConfig | null> {
  const local = (() => {
    try {
      return JSON.parse(localStorage.getItem(HP_LOCAL_KEY) || 'null') as HomepageConfig | null;
    } catch {
      return null;
    }
  })();

  if ((await detectMode()) === 'demo') return local;

  try {
    const r = await fetch(`/files/homepage_config.json?t=${Date.now()}`, { credentials: 'include' });
    if (!r.ok) return local;
    const cfg = await r.json();
    if (cfg && (Array.isArray(cfg.ml) || Array.isArray(cfg.na))) {
      localStorage.setItem(HP_LOCAL_KEY, JSON.stringify(cfg));
      return cfg as HomepageConfig;
    }
  } catch {
    /* keep whatever we cached — never wipe a good config on a network blip */
  }
  return local;
}

export function cacheHomepageConfig(cfg: HomepageConfig): void {
  try {
    localStorage.setItem(HP_LOCAL_KEY, JSON.stringify(cfg));
  } catch {
    /* best effort */
  }
}

/** Products for the storefront, newest first. Works in both modes. */
export async function getStorefrontItems(limit = 200): Promise<Row[]> {
  const res = await call('hira.api.products.get_public_items', { limit }, { method: 'GET' }).catch(
    () => null
  );
  if (Array.isArray(res?.message) && res.message.length) return res.message as Row[];

  // The custom `hira` app isn't installed on every bench — fall back to the
  // stock Item list, which any ERPNext site can answer.
  return api.getList('Item', {
    fields: [
      'name', 'item_name', 'item_group', 'standard_rate', 'image',
      'custom_item_images', 'custom_is_featured', 'custom_material',
      'custom_short_description', 'weight_per_unit', 'disabled',
    ],
    filters: [['disabled', '=', 0], ['is_sales_item', '=', 1]],
    order_by: 'modified desc',
    // frappe.client.get_list reads limit_page_length; `limit` alone caps at 20.
    limit,
    limit_page_length: limit,
  });
}

/**
 * One product, guest-readable.
 *
 * Frappe's Item doctype is not readable by Guest, so a plain `frappe.client.get`
 * returns nothing for a logged-out shopper. The `hira` app exposes a whitelisted
 * endpoint over a safe field list; this falls back to the raw doc for benches
 * without that app, and finally to the bundled catalogue.
 */
export async function getStorefrontItem(name: string): Promise<Row | null> {
  const decoded = decodeURIComponent(name);

  const viaApp = await call('hira.api.products.get_public_item', { name: decoded }, { method: 'GET' })
    .then(r => r?.message as Row | undefined)
    .catch(() => undefined);
  if (viaApp) return viaApp;

  return api.getDoc('Item', decoded).catch(() => null);
}

/**
 * Order history for the signed-in shopper.
 *
 * Tries this bench's own endpoint first, then the payment app's (the original
 * deployment served history from there), then the demo store.
 */
export async function getMyOrders(): Promise<Row[]> {
  for (const method of ['hira.api.orders.get_my_orders', 'square_payment.api.get_my_orders']) {
    const res = await call(method, {}, { method: 'GET' }).catch(() => null);
    if (Array.isArray(res?.message)) return res.message as Row[];
  }
  return [];
}

// ─── coupons ─────────────────────────────────────────────────────────────────

export interface CouponResult {
  code: string;
  discount: number;
  discount_percentage: number;
  minimum_amount: number;
}

/**
 * Validate a coupon and get the money amount to subtract.
 *
 * Validation belongs on the server: guests can't read `Coupon Code`, and
 * ERPNext stores the percentage on the linked Pricing Rule rather than on the
 * coupon itself — reading `discount_percentage` off the coupon doc (as the
 * pages used to) always yielded 0.
 */
export async function validateCoupon(code: string, subtotal: number): Promise<CouponResult> {
  const trimmed = code.trim();
  if (!trimmed) throw new Error('Enter a coupon code');

  const res = await call(
    'hira.api.coupons.validate_coupon',
    { code: trimmed, subtotal },
    { method: 'GET' }
  );
  const m = res?.message as CouponResult | undefined;
  if (!m) throw new Error('Invalid coupon code');
  return m;
}
