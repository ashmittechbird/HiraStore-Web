/**
 * Demo backend — a complete, persistent store that runs entirely in the browser.
 *
 * This exists so the storefront is never a dead page: with no Frappe reachable
 * (Vercel preview, VPN off, client walkthrough) products still list, accounts
 * still work, coupons still validate and orders still place. Everything is kept
 * in localStorage so a refresh — or coming back tomorrow — keeps your data.
 *
 * Responses are shaped like Frappe's so the app's data layer stays identical
 * between modes.
 */
import catalog from '@/data/catalog.json';

export interface DemoItem {
  name: string;
  item_name: string;
  item_group: string;
  standard_rate: number;
  image: string;
  custom_material: string;
  custom_short_description: string;
  weight_per_unit: number;
  custom_is_featured: number;
  disabled: number;
  is_sales_item: number;
  modified: string;
  custom_item_images?: string;
  description?: string;
  [k: string]: unknown;
}

const K = {
  items: 'hs_demo_items',
  users: 'hs_demo_users',
  session: 'hs_demo_session',
  orders: 'hs_demo_orders',
  coupons: 'hs_demo_coupons',
  files: 'hs_demo_files',
  seq: 'hs_demo_seq',
  catalogSig: 'hs_demo_catalog_sig',
  bookings: 'hs_demo_bookings',
};

function read<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota exceeded — demo persistence is best-effort */
  }
}

/** Monotonic per-prefix counter for order/item names. */
function nextSeq(prefix: string): number {
  const seqs = read<Record<string, number>>(K.seq, {});
  const n = (seqs[prefix] || 0) + 1;
  seqs[prefix] = n;
  write(K.seq, seqs);
  return n;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

// ─── seed ────────────────────────────────────────────────────────────────────

const DEMO_ADMIN = {
  email: 'admin@hira.store',
  password: 'admin123',
  full_name: 'Store Manager',
  roles: ['System Manager', 'Administrator'],
};

const SEED_COUPONS: DemoCoupon[] = [
  {
    name: 'HIRA30',
    coupon_code: 'HIRA30',
    discount_percentage: 30,
    minimum_amount: 0,
    valid_from: '2025-01-01',
    valid_upto: '2030-12-31',
    description: '30% off sitewide — summer edit',
  },
  {
    name: 'WELCOME10',
    coupon_code: 'WELCOME10',
    discount_percentage: 10,
    minimum_amount: 0,
    valid_from: '2025-01-01',
    valid_upto: '2030-12-31',
    description: '10% off your first order',
  },
  {
    name: 'FESTIVE20',
    coupon_code: 'FESTIVE20',
    discount_percentage: 20,
    minimum_amount: 100,
    valid_from: '2025-01-01',
    valid_upto: '2030-12-31',
    description: '20% off orders over $100',
  },
];

/**
 * Signature of the bundled catalogue.
 *
 * Without this, a browser that seeded once would keep serving the old products
 * forever — a rebuilt catalog.json would never reach anyone who had already
 * visited. When the signature changes we re-seed, preserving anything the admin
 * created or edited.
 */
function catalogSignature(): string {
  const items = catalog as DemoItem[];
  let h = 0;
  for (const it of items) {
    const s = `${it.name}${it.item_name}${it.standard_rate}`;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return `${items.length}:${h >>> 0}`;
}

let seeded = false;

export function seed(): void {
  if (seeded) return;
  seeded = true;

  const sig = catalogSignature();
  const storedSig = localStorage.getItem(K.catalogSig);

  if (!localStorage.getItem(K.items)) {
    write(K.items, catalog as DemoItem[]);
    localStorage.setItem(K.catalogSig, sig);
  } else if (storedSig !== sig) {
    // Rebuild from the new catalogue, then re-apply the admin's own work so a
    // product update doesn't wipe their edits.
    const edited = read<DemoItem[]>(K.items, []).filter(i => i._edited);
    const merged = [...(catalog as DemoItem[])];
    for (const e of edited) {
      const idx = merged.findIndex(i => i.name === e.name);
      if (idx >= 0) merged[idx] = e;
      else merged.unshift(e);
    }
    write(K.items, merged);
    localStorage.setItem(K.catalogSig, sig);
  }

  if (!localStorage.getItem(K.coupons)) write(K.coupons, SEED_COUPONS);
  const users = read<Record<string, DemoUser>>(K.users, {});
  if (!users[DEMO_ADMIN.email]) {
    users[DEMO_ADMIN.email] = { ...DEMO_ADMIN };
    write(K.users, users);
  }
}

/** Credentials surfaced on the login screen while in demo mode. */
export const DEMO_CREDENTIALS = { email: DEMO_ADMIN.email, password: DEMO_ADMIN.password };

// ─── items ───────────────────────────────────────────────────────────────────

export function allItems(): DemoItem[] {
  seed();
  const stored = read<DemoItem[]>(K.items, []);
  return stored.length ? stored : (catalog as DemoItem[]);
}

export function saveItems(items: DemoItem[]): void {
  write(K.items, items);
}

export function getItem(name: string): DemoItem | null {
  return allItems().find(i => i.name === name) ?? null;
}

export function upsertItem(doc: Partial<DemoItem> & { name?: string }): DemoItem {
  const items = allItems();
  const id =
    doc.name ||
    `THS${String(doc.item_group || 'X')[0].toUpperCase()}${String(nextSeq('item')).padStart(3, '0')}`;
  const idx = items.findIndex(i => i.name === id);
  const base: DemoItem =
    idx >= 0
      ? items[idx]
      : {
          name: id,
          item_name: '',
          item_group: 'Accessories',
          standard_rate: 0,
          image: '',
          custom_material: '',
          custom_short_description: '',
          weight_per_unit: 0,
          custom_is_featured: 0,
          disabled: 0,
          is_sales_item: 1,
          modified: new Date().toISOString(),
        };
  const merged: DemoItem = { ...base, ...doc, name: id, _edited: true, modified: new Date().toISOString() };
  if (idx >= 0) items[idx] = merged;
  else items.unshift(merged);
  saveItems(items);
  return merged;
}

export function deleteItem(name: string): void {
  saveItems(allItems().filter(i => i.name !== name));
}

// ─── coupons ─────────────────────────────────────────────────────────────────

export interface DemoCoupon {
  name: string;
  coupon_code: string;
  discount_percentage: number;
  minimum_amount: number;
  valid_from: string;
  valid_upto: string;
  description: string;
}

export function allCoupons(): DemoCoupon[] {
  seed();
  return read<DemoCoupon[]>(K.coupons, SEED_COUPONS);
}

export function upsertCoupon(doc: Partial<DemoCoupon>): DemoCoupon {
  const list = allCoupons();
  const code = String(doc.coupon_code || doc.name || '').trim().toUpperCase();
  const merged: DemoCoupon = {
    name: code,
    coupon_code: code,
    discount_percentage: Number(doc.discount_percentage) || 0,
    minimum_amount: Number(doc.minimum_amount) || 0,
    valid_from: doc.valid_from || today(),
    valid_upto: doc.valid_upto || '2030-12-31',
    description: doc.description || '',
  };
  const idx = list.findIndex(c => c.name === code);
  if (idx >= 0) list[idx] = merged;
  else list.unshift(merged);
  write(K.coupons, list);
  return merged;
}

export function deleteCoupon(name: string): void {
  write(K.coupons, allCoupons().filter(c => c.name !== name));
}

// ─── auth ────────────────────────────────────────────────────────────────────

interface DemoUser {
  email: string;
  password: string;
  full_name: string;
  roles: string[];
}

export function currentSession(): string | null {
  seed();
  return read<string | null>(K.session, null);
}

export function login(usr: string, pwd: string): { user: string; full_name: string } {
  seed();
  const users = read<Record<string, DemoUser>>(K.users, {});
  const key = usr.trim().toLowerCase();
  const found = users[key] || Object.values(users).find(u => u.email.toLowerCase() === key);
  if (!found || found.password !== pwd) {
    throw new Error('Invalid username/email or password');
  }
  write(K.session, found.email);
  return { user: found.email, full_name: found.full_name };
}

export function signup(email: string, fullName: string, password: string): void {
  seed();
  const users = read<Record<string, DemoUser>>(K.users, {});
  const key = email.trim().toLowerCase();
  if (users[key]) throw new Error('An account with this email already exists');
  users[key] = { email: key, password, full_name: fullName || key.split('@')[0], roles: [] };
  write(K.users, users);
  write(K.session, key);
}

export function logout(): void {
  write(K.session, null);
}

export function getUser(
  email: string
): { name: string; full_name: string; email: string; roles: { role: string }[] } | null {
  seed();
  const users = read<Record<string, DemoUser>>(K.users, {});
  const u = users[email.trim().toLowerCase()];
  if (!u) return null;
  return { name: u.email, full_name: u.full_name, email: u.email, roles: u.roles.map(role => ({ role })) };
}

export function isAdmin(email: string | null): boolean {
  if (!email) return false;
  const u = getUser(email);
  return !!u?.roles.some(r => r.role === 'System Manager' || r.role === 'Administrator');
}

// ─── orders ──────────────────────────────────────────────────────────────────

export interface DemoOrder {
  name: string;
  customer: string;
  customer_name: string;
  contact_email: string;
  contact_mobile: string;
  /** Account the order was placed from — mirrors Frappe's Sales Order.owner. */
  owner: string;
  transaction_date: string;
  creation: string;
  grand_total: number;
  net_total: number;
  discount_amount: number;
  shipping_charge: number;
  status: string;
  payment_method: string;
  payment_id: string;
  coupon_code: string;
  shipping_address: Record<string, string>;
  items: Array<{ item_code: string; item_name: string; qty: number; rate: number; amount: number; image: string }>;
}

export function allOrders(): DemoOrder[] {
  seed();
  return read<DemoOrder[]>(K.orders, []);
}

export function ordersFor(email: string | null): DemoOrder[] {
  if (!email) return [];
  const e = email.toLowerCase();
  // Match the account it was placed from as well as the contact address, so an
  // order shipped to someone else still shows in the buyer's history.
  return allOrders().filter(
    o => (o.owner || '').toLowerCase() === e || (o.contact_email || '').toLowerCase() === e
  );
}

export function createOrder(input: {
  customer: Record<string, string>;
  cart: Array<{ id: string; name: string; price: number; qty: number; image: string }>;
  discount?: number;
  shipping?: number;
  couponCode?: string;
  paymentMethod: string;
  paymentId?: string;
}): DemoOrder {
  seed();
  const netTotal = input.cart.reduce((s, i) => s + i.price * i.qty, 0);
  const discount = Math.min(input.discount || 0, netTotal);
  const shipping = input.shipping || 0;
  const id = `SAL-ORD-${new Date().getFullYear()}-${String(nextSeq('order')).padStart(5, '0')}`;
  const session = currentSession();
  const email = input.customer.email || session || 'guest@hira.store';

  const order: DemoOrder = {
    name: id,
    customer: input.customer.fullName || email,
    customer_name: input.customer.fullName || email,
    contact_email: email,
    contact_mobile: input.customer.phone || '',
    owner: session || email,
    transaction_date: today(),
    creation: new Date().toISOString(),
    net_total: netTotal,
    discount_amount: discount,
    shipping_charge: shipping,
    grand_total: Math.max(0, netTotal - discount + shipping),
    status: 'To Deliver and Bill',
    payment_method: input.paymentMethod,
    payment_id: input.paymentId || `demo_${Date.now().toString(36)}`,
    coupon_code: input.couponCode || '',
    shipping_address: {
      address: input.customer.address || '',
      city: input.customer.city || '',
      state: input.customer.state || '',
      zip: input.customer.zip || '',
    },
    items: input.cart.map(i => ({
      item_code: i.id,
      item_name: i.name,
      qty: i.qty,
      rate: i.price,
      amount: i.price * i.qty,
      image: i.image,
    })),
  };

  write(K.orders, [order, ...allOrders()]);
  return order;
}

export function updateOrderStatus(name: string, status: string): void {
  write(K.orders, allOrders().map(o => (o.name === name ? { ...o, status } : o)));
}

// ─── customers (derived from registered users + order history) ───────────────

export interface DemoCustomer {
  name: string;
  customer_name: string;
  customer_type: string;
  email_id: string;
  mobile_no: string;
  creation: string;
}

export function allCustomers(): DemoCustomer[] {
  seed();
  const users = read<Record<string, DemoUser>>(K.users, {});
  const map = new Map<string, DemoCustomer>();

  for (const u of Object.values(users)) {
    if (u.roles.length) continue; // staff account, not a shopper
    map.set(u.email, {
      name: u.full_name || u.email,
      customer_name: u.full_name || u.email,
      customer_type: 'Individual',
      email_id: u.email,
      mobile_no: '',
      creation: new Date().toISOString(),
    });
  }
  for (const o of allOrders()) {
    const e = (o.contact_email || '').toLowerCase();
    if (!e) continue;
    const existing = map.get(e);
    map.set(e, {
      name: o.customer_name || e,
      customer_name: o.customer_name || e,
      customer_type: 'Individual',
      email_id: e,
      mobile_no: o.contact_mobile || existing?.mobile_no || '',
      creation: existing?.creation || o.creation,
    });
  }
  return [...map.values()];
}

// ─── uploaded files (admin product images) ───────────────────────────────────

export function saveFile(name: string, dataUrl: string): string {
  const files = read<Record<string, string>>(K.files, {});
  const url = `demo-file:${name}:${Date.now()}`;
  files[url] = dataUrl;
  write(K.files, files);
  return url;
}

export function readFile(url: string): string | null {
  return read<Record<string, string>>(K.files, {})[url] ?? null;
}

/** Wipe everything and re-seed — powers the admin "Reset demo data" action. */
export function resetAll(): void {
  Object.values(K).forEach(k => localStorage.removeItem(k));
  seeded = false;
  seed();
}

// ─── video call bookings ─────────────────────────────────────────────────────

export interface DemoBooking {
  name: string;
  customer_name: string;
  phone: string;
  email: string;
  preferred_date: string;
  preferred_time: string;
  notes: string;
  status: string;
  source: string;
  creation: string;
}

export function allBookings(): DemoBooking[] {
  seed();
  return read<DemoBooking[]>(K.bookings, []);
}

export function createBooking(input: Partial<DemoBooking>): DemoBooking {
  seed();
  const booking: DemoBooking = {
    name: `VCB-${new Date().getFullYear()}-${String(nextSeq('booking')).padStart(5, '0')}`,
    customer_name: String(input.customer_name || '').slice(0, 140),
    phone: String(input.phone || ''),
    email: String(input.email || ''),
    preferred_date: String(input.preferred_date || ''),
    preferred_time: String(input.preferred_time || ''),
    notes: String(input.notes || '').slice(0, 1000),
    status: 'New',
    source: 'Storefront',
    creation: new Date().toISOString(),
  };
  write(K.bookings, [booking, ...allBookings()]);
  return booking;
}

export function setBookingStatus(name: string, status: string): void {
  write(K.bookings, allBookings().map(b => (b.name === name ? { ...b, status } : b)));
}
