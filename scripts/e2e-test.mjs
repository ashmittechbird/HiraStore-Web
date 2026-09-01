/**
 * End-to-end checks against a running bench.
 *
 *   node scripts/e2e-test.mjs            # against http://localhost:8001
 *   BASE=https://... node scripts/e2e-test.mjs
 *
 * Covers the paths a real shop depends on: catalogue, pricing, coupons, orders,
 * bookings, and the permission boundaries around them. Written to be run before
 * a production deploy, and to fail loudly rather than print reassuring output.
 */

const BASE = process.env.BASE || 'http://localhost:8001';
const ADMIN = { usr: 'Administrator', pwd: process.env.ADMIN_PWD || 'admin' };

let pass = 0, fail = 0, warn = 0;
const failures = [];

function ok(name, detail = '') { pass++; console.log(`  PASS  ${name}${detail ? ' — ' + detail : ''}`); }
function bad(name, detail = '') { fail++; failures.push(`${name} — ${detail}`); console.log(`  FAIL  ${name}${detail ? ' — ' + detail : ''}`); }
function note(name, detail = '') { warn++; console.log(`  WARN  ${name}${detail ? ' — ' + detail : ''}`); }
function section(t) { console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 58 - t.length))}`); }

/** Cookie jar so guest and admin sessions stay separate. */
function jar() {
  const cookies = new Map();
  return {
    header: () => [...cookies].map(([k, v]) => `${k}=${v}`).join('; '),
    absorb(res) {
      const raw = typeof res.headers.getSetCookie === 'function'
        ? res.headers.getSetCookie()
        : [res.headers.get('set-cookie')].filter(Boolean);
      for (const c of raw) {
        const [pair] = String(c).split(';');
        const i = pair.indexOf('=');
        if (i > 0) cookies.set(pair.slice(0, i).trim(), pair.slice(i + 1).trim());
      }
    },
  };
}

async function call(session, method, params = {}, verb = 'GET') {
  const url = new URL(`${BASE}/api/method/${method}`);
  const init = { method: verb, headers: { Accept: 'application/json' }, redirect: 'manual' };
  if (session.header()) init.headers.Cookie = session.header();

  if (verb === 'GET') {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null) url.searchParams.set(k, typeof v === 'string' ? v : JSON.stringify(v));
    }
  } else {
    init.headers['Content-Type'] = 'application/json';
    init.headers['X-Frappe-CSRF-Token'] = session.csrf || 'fetch';
    init.body = JSON.stringify(params);
  }

  const res = await fetch(url, init);
  session.absorb(res);
  const text = await res.text();
  let body;
  try { body = JSON.parse(text); } catch { body = { _raw: text.slice(0, 200) }; }
  return { status: res.status, body, ok: res.ok };
}

async function login(session, creds) {
  const r = await call(session, 'login', creds, 'POST');
  const t = await call(session, 'hira.api.session.get_csrf_token');
  session.csrf = t.body?.message?.csrf_token;
  return r;
}

const guest = jar();
const admin = jar();
const shopper = jar();

console.log(`e2e against ${BASE}\n${'='.repeat(64)}`);

// ── catalogue ───────────────────────────────────────────────────────────────
section('Catalogue');

const feed = await call(guest, 'hira.api.products.get_public_items', { limit: 500 });
const items = feed.body?.message || [];
items.length > 0 ? ok('guest can read the product feed', `${items.length} products`)
                 : bad('guest can read the product feed', `got ${items.length}`);

const disabled = items.filter(i => i.disabled);
disabled.length === 0 ? ok('feed excludes disabled products')
                      : bad('feed excludes disabled products', `${disabled.length} leaked`);

const noPrice = items.filter(i => !(Number(i.standard_rate) > 0));
noPrice.length === 0 ? ok('every listed product has a price')
                     : bad('every listed product has a price', `${noPrice.length} at 0`);

const costFields = items.filter(i => 'valuation_rate' in i || 'last_purchase_rate' in i);
costFields.length === 0 ? ok('feed hides costing fields')
                        : bad('feed hides costing fields', `${costFields.length} expose cost`);

const tagged = ['THSN003', 'THSB016', 'THSN028', 'THSE091', 'THSP012', 'THSNC001'];
const leaked = tagged.filter(t => items.some(i => i.name === t));
leaked.length === 0 ? ok('photos with price tags stay hidden')
                    : bad('photos with price tags stay hidden', leaked.join(', '));

const single = await call(guest, 'hira.api.products.get_public_item', { name: items[0]?.name });
single.body?.message?.name ? ok('guest can read a single product', single.body.message.name)
                           : bad('guest can read a single product', JSON.stringify(single.body).slice(0, 90));

const missing = await call(guest, 'hira.api.products.get_public_item', { name: 'NOPE-DOES-NOT-EXIST' });
!missing.ok ? ok('unknown product is rejected') : bad('unknown product is rejected', `HTTP ${missing.status}`);

// ── permission boundaries ───────────────────────────────────────────────────
section('Permission boundaries (as guest)');

const guestItems = await call(guest, 'frappe.client.get_list', { doctype: 'Item', limit_page_length: 5 });
const gotItems = Array.isArray(guestItems.body?.message) && guestItems.body.message.length > 0;
!gotItems ? ok('guest cannot list the Item doctype directly')
          : bad('guest cannot list the Item doctype directly', `${guestItems.body.message.length} rows`);

const guestOrders = await call(guest, 'hira.api.orders.get_my_orders');
const guestOrderRows = guestOrders.body?.message;
(!Array.isArray(guestOrderRows) || guestOrderRows.length === 0)
  ? ok('guest sees no orders')
  : bad('guest sees no orders', `${guestOrderRows.length} rows`);

const guestBookings = await call(guest, 'hira.api.bookings.list_bookings');
!guestBookings.ok ? ok('guest cannot list bookings')
                  : bad('guest cannot list bookings', `HTTP ${guestBookings.status}, ${(guestBookings.body?.message || []).length} rows`);

const guestStatus = await call(guest, 'hira.api.bookings.set_booking_status',
  { name: 'VCB-2026-00001', status: 'Cancelled' }, 'POST');
!guestStatus.ok ? ok('guest cannot change a booking status')
                : bad('guest cannot change a booking status', `HTTP ${guestStatus.status}`);

const guestOrder = await call(guest, 'hira.api.orders.create_cod_order', {
  customer: JSON.stringify({ fullName: 'Guest', email: 'g@x.com' }),
  cart_items: JSON.stringify([{ id: items[0]?.name, price: 10, qty: 1 }]),
}, 'POST');
!guestOrder.ok ? ok('guest cannot place an order without signing in')
               : bad('guest cannot place an order without signing in', `created ${guestOrder.body?.message?.order_id}`);

// ── coupons ─────────────────────────────────────────────────────────────────
section('Coupons');

const c30 = await call(guest, 'hira.api.coupons.validate_coupon', { code: 'HIRA30', subtotal: 200 });
c30.body?.message?.discount === 60 ? ok('HIRA30 gives 30%', '$200 -> $60 off')
                                   : bad('HIRA30 gives 30%', JSON.stringify(c30.body?.message));

const cMinFail = await call(guest, 'hira.api.coupons.validate_coupon', { code: 'FESTIVE20', subtotal: 50 });
!cMinFail.ok ? ok('FESTIVE20 enforces its $100 minimum')
             : bad('FESTIVE20 enforces its $100 minimum', JSON.stringify(cMinFail.body?.message));

const cMinPass = await call(guest, 'hira.api.coupons.validate_coupon', { code: 'FESTIVE20', subtotal: 150 });
cMinPass.body?.message?.discount === 30 ? ok('FESTIVE20 applies above the minimum', '$150 -> $30 off')
                                        : bad('FESTIVE20 applies above the minimum', JSON.stringify(cMinPass.body?.message));

const cBad = await call(guest, 'hira.api.coupons.validate_coupon', { code: 'NOT-A-CODE', subtotal: 200 });
!cBad.ok ? ok('an unknown coupon is rejected') : bad('an unknown coupon is rejected', 'accepted');

const cCase = await call(guest, 'hira.api.coupons.validate_coupon', { code: ' hira30 ', subtotal: 100 });
cCase.body?.message?.discount === 30 ? ok('coupon match ignores case and spacing')
                                     : note('coupon match ignores case and spacing', JSON.stringify(cCase.body?.message || cCase.body).slice(0, 80));

const cNeg = await call(guest, 'hira.api.coupons.validate_coupon', { code: 'HIRA30', subtotal: -500 });
const negDisc = cNeg.body?.message?.discount;
(!cNeg.ok || !(negDisc < 0)) ? ok('a negative subtotal cannot mint a discount')
                             : bad('a negative subtotal cannot mint a discount', `discount ${negDisc}`);

// ── bookings ────────────────────────────────────────────────────────────────
section('Video call bookings');

const bOk = await call(guest, 'hira.api.bookings.create_booking', {
  customer_name: 'E2E Tester', phone: '+91 90000 00001', email: 'e2e@example.com',
  preferred_date: '2027-01-15', preferred_time: '03:00 PM - 04:00 PM', notes: 'automated test',
}, 'POST');
const bookingId = bOk.body?.message?.booking_id;
bookingId ? ok('a guest can request a video call', bookingId)
          : bad('a guest can request a video call', JSON.stringify(bOk.body).slice(0, 120));

bOk.body?.message?.notified === false && bOk.body?.message?.email_configured === false
  ? ok('no email is claimed while SMTP is unconfigured')
  : note('notification honesty', JSON.stringify(bOk.body?.message));

const bNoName = await call(guest, 'hira.api.bookings.create_booking', { customer_name: '  ', phone: '9000000001' }, 'POST');
!bNoName.ok ? ok('a booking without a name is rejected') : bad('a booking without a name is rejected', 'accepted');

const bBadPhone = await call(guest, 'hira.api.bookings.create_booking', { customer_name: 'X', phone: '123' }, 'POST');
!bBadPhone.ok ? ok('a booking with a short phone is rejected') : bad('a booking with a short phone is rejected', 'accepted');

const bPast = await call(guest, 'hira.api.bookings.create_booking',
  { customer_name: 'X', phone: '9000000001', preferred_date: '2020-01-01' }, 'POST');
!bPast.ok ? ok('a booking in the past is rejected') : bad('a booking in the past is rejected', 'accepted');

// ── admin ───────────────────────────────────────────────────────────────────
section('Admin (as Administrator)');

const adminLogin = await login(admin, ADMIN);
adminLogin.ok ? ok('admin can sign in') : bad('admin can sign in', JSON.stringify(adminLogin.body).slice(0, 100));

const aBookings = await call(admin, 'hira.api.bookings.list_bookings', { limit: 200 });
const bookingRows = aBookings.body?.message || [];
bookingRows.length > 0 ? ok('admin can list bookings', `${bookingRows.length} rows`)
                       : bad('admin can list bookings', 'none');

bookingRows.some(b => b.name === bookingId)
  ? ok('the new booking is retained for the owner')
  : bad('the new booking is retained for the owner', `${bookingId} missing`);

const conf = await call(admin, 'hira.api.bookings.set_booking_status', { name: bookingId, status: 'Confirmed' }, 'POST');
conf.body?.message?.status === 'Confirmed' ? ok('admin can confirm a booking')
                                           : bad('admin can confirm a booking', JSON.stringify(conf.body).slice(0, 100));

const badStatus = await call(admin, 'hira.api.bookings.set_booking_status', { name: bookingId, status: 'Banana' }, 'POST');
!badStatus.ok ? ok('an invalid status is rejected') : bad('an invalid status is rejected', 'accepted');

const wa = await call(admin, 'hira.api.bookings.whatsapp_message', { name: bookingId });
const waUrl = wa.body?.message?.url || '';
/^https:\/\/wa\.me\/\d{11,}\?text=/.test(waUrl)
  ? ok('the WhatsApp link carries a country code', waUrl.split('?')[0])
  : bad('the WhatsApp link carries a country code', waUrl.slice(0, 60));

const aItems = await call(admin, 'frappe.client.get_list',
  { doctype: 'Item', fields: ['name'], limit_page_length: 500 }, 'POST');
const adminItemCount = (aItems.body?.message || []).length;
adminItemCount > 20 ? ok('admin lists beyond the default 20-row cap', `${adminItemCount} items`)
                    : bad('admin lists beyond the default 20-row cap', `${adminItemCount} items`);

// ── orders ──────────────────────────────────────────────────────────────────
section('Orders');

const prod = items.find(i => Number(i.standard_rate) > 50);
const realPrice = Number(prod.standard_rate);

const order = await call(admin, 'hira.api.orders.create_cod_order', {
  customer: JSON.stringify({ fullName: 'E2E Shopper', email: 'e2e-shopper@example.com', phone: '9000000002' }),
  cart_items: JSON.stringify([{ id: prod.name, name: prod.item_name, price: realPrice, qty: 1, image: '' }]),
  discount: 0, shipping: 0, payment_method: 'Cash on Delivery',
}, 'POST');
const orderId = order.body?.message?.order_id;
orderId ? ok('an order can be placed', orderId) : bad('an order can be placed', JSON.stringify(order.body).slice(0, 140));

const soCheck = await call(admin, 'frappe.client.get', { doctype: 'Sales Order', name: orderId }, 'POST');
const so = soCheck.body?.message;
so?.docstatus === 1 ? ok('the order is submitted, not left as a draft') : bad('the order is submitted', `docstatus ${so?.docstatus}`);
Number(so?.grand_total) === realPrice ? ok('the order total matches the catalogue price', `$${so?.grand_total}`)
                                      : bad('the order total matches the catalogue price', `$${so?.grand_total} vs $${realPrice}`);

// An order carrying a coupon code exercises ERPNext's own redemption checks,
// which a discount-free order never touches — that gap hid a bug where every
// discounted order failed with "Allowed quantity is exhausted".
const couponOrder = await call(admin, 'hira.api.orders.create_cod_order', {
  customer: JSON.stringify({ fullName: 'Coupon Buyer', email: 'coupon@example.com', phone: '9000000006' }),
  cart_items: JSON.stringify([{ id: prod.name, name: prod.item_name, price: realPrice, qty: 1, image: '' }]),
  coupon_code: 'HIRA30', discount: Math.round(realPrice * 0.3 * 100) / 100,
  shipping: 0, payment_method: 'Cash on Delivery',
}, 'POST');
const couponOrderId = couponOrder.body?.message?.order_id;
if (couponOrderId) {
  const co = await call(admin, 'frappe.client.get', { doctype: 'Sales Order', name: couponOrderId }, 'POST');
  const total = Number(co.body?.message?.grand_total);
  const expected = Math.round((realPrice * 0.7) * 100) / 100;
  Math.abs(total - expected) < 0.02
    ? ok('an order with a coupon books at the discounted total', )
    : bad('an order with a coupon books at the discounted total', );
} else {
  bad('an order with a coupon can be placed', JSON.stringify(couponOrder.body).slice(0, 160));
}

// ── price tampering ─────────────────────────────────────────────────────────
section('Price tampering');

const tamper = await call(admin, 'hira.api.orders.create_cod_order', {
  customer: JSON.stringify({ fullName: 'Tamper Test', email: 'tamper@example.com', phone: '9000000003' }),
  cart_items: JSON.stringify([{ id: prod.name, name: prod.item_name, price: 1, qty: 1, image: '' }]),
  discount: 0, shipping: 0, payment_method: 'Cash on Delivery',
}, 'POST');
const tamperId = tamper.body?.message?.order_id;
if (tamperId) {
  const t = await call(admin, 'frappe.client.get', { doctype: 'Sales Order', name: tamperId }, 'POST');
  const total = Number(t.body?.message?.grand_total);
  total === realPrice
    ? ok('a tampered price is overridden by the catalogue', `$1 sent, charged $${total}`)
    : bad('a tampered price is overridden by the catalogue',
          `sent $1 for a $${realPrice} item and the order was booked at $${total}`);
} else {
  ok('a tampered price is refused outright');
}

const overDiscount = await call(admin, 'hira.api.orders.create_cod_order', {
  customer: JSON.stringify({ fullName: 'Discount Test', email: 'disc@example.com', phone: '9000000004' }),
  cart_items: JSON.stringify([{ id: prod.name, name: prod.item_name, price: realPrice, qty: 1, image: '' }]),
  discount: realPrice * 10, shipping: 0, payment_method: 'Cash on Delivery',
}, 'POST');
const odId = overDiscount.body?.message?.order_id;
if (odId) {
  const t = await call(admin, 'frappe.client.get', { doctype: 'Sales Order', name: odId }, 'POST');
  const total = Number(t.body?.message?.grand_total);
  total >= 0 && total <= realPrice
    ? ok('an oversized discount cannot drive the total negative', `$${total}`)
    : bad('an oversized discount cannot drive the total negative', `total $${total}`);
} else {
  ok('an oversized discount is refused');
}

const negQty = await call(admin, 'hira.api.orders.create_cod_order', {
  customer: JSON.stringify({ fullName: 'Qty Test', email: 'qty@example.com', phone: '9000000005' }),
  cart_items: JSON.stringify([{ id: prod.name, name: prod.item_name, price: realPrice, qty: -5, image: '' }]),
  payment_method: 'Cash on Delivery',
}, 'POST');
!negQty.ok ? ok('a negative quantity is rejected')
           : bad('a negative quantity is rejected', `created ${negQty.body?.message?.order_id}`);

const emptyCart = await call(admin, 'hira.api.orders.create_cod_order', {
  customer: JSON.stringify({ fullName: 'Empty', email: 'e@example.com' }),
  cart_items: JSON.stringify([]), payment_method: 'Cash on Delivery',
}, 'POST');
!emptyCart.ok ? ok('an empty cart is rejected') : bad('an empty cart is rejected', 'accepted');

// ── owner records ───────────────────────────────────────────────────────────
section('Records kept for the owner');

const myOrders = await call(admin, 'hira.api.orders.get_my_orders');
Array.isArray(myOrders.body?.message) ? ok('order history is readable', `${myOrders.body.message.length} orders`)
                                      : bad('order history is readable', JSON.stringify(myOrders.body).slice(0, 90));

const custs = await call(admin, 'frappe.client.get_list',
  { doctype: 'Customer', fields: ['name'], limit_page_length: 200 }, 'POST');
const custCount = (custs.body?.message || []).length;
custCount > 0 ? ok('customers are created from orders', `${custCount} customers`)
              : bad('customers are created from orders', 'none');

// ── summary ─────────────────────────────────────────────────────────────────
console.log(`\n${'='.repeat(64)}`);
console.log(`PASS ${pass}   FAIL ${fail}   WARN ${warn}`);
if (failures.length) {
  console.log('\nFAILURES:');
  failures.forEach(f => console.log('  - ' + f));
}
process.exit(fail > 0 ? 1 : 0);
