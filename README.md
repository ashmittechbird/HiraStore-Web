# Hira — storefront API for Frappe/ERPNext

The backend for [The Hira Store](https://hira-store.vercel.app). A Frappe app
that gives the React storefront the endpoints ERPNext doesn't provide, and adds
video call bookings.

Install it on any Frappe v15 bench with ERPNext and the storefront works — no
manual doctype creation, no field setup, no coupon entry.

---

## Install

```bash
cd /path/to/frappe-bench

bench get-app https://github.com/ashmittechbird/hira.git
bench --site your-site.local install-app hira
bench --site your-site.local migrate
```

That's the whole backend. `install-app` creates the custom Item fields and the
promotional coupons; `migrate` installs the **Video Call Booking** doctype.

Then load the catalogue, if you have one to import:

```bash
bench --site your-site.local execute hira.api.seed.seed_catalog
```

It reads `sites/catalog.json` — the file the storefront's
`npm run catalog` produces.

### Serving on the right port

The storefront proxies to port **8001** by default:

```bash
bench set-config -g webserver_port 8001
bench start
```

---

## What it provides

| Endpoint | Why it exists |
|---|---|
| `hira.api.products.get_public_items` | Guests can't read the `Item` doctype, so a logged-out shopper saw an empty shop. Opening `Item` to Guest would also expose `valuation_rate` and `last_purchase_rate`; this returns a safe field list. |
| `hira.api.products.get_public_item` | Same permission wall, for a single product page. |
| `hira.api.orders.create_cod_order` | Books a submitted Sales Order and creates the Customer on first purchase. **Prices every line from the Item record** — the browser's price is ignored, so an edited request can't buy a $600 piece for $1. |
| `hira.api.orders.get_my_orders` | Shoppers can't list Sales Orders they don't own; this scopes to their own. |
| `hira.api.coupons.validate_coupon` | Guests can't read `Coupon Code`, and the percentage lives on the linked Pricing Rule rather than the coupon — reading it off the coupon yields 0% every time. |
| `hira.api.coupons.list_public_coupons` | Powers the admin Offers tab, resolving discount and minimum from the Pricing Rule. |
| `hira.api.bookings.*` | Video call requests: create (guest), list and triage (staff), and a pre-filled WhatsApp confirmation link. |
| `hira.api.session.get_csrf_token` | The desk reads its CSRF token from bootinfo in the page Frappe serves. A decoupled storefront has no boot and the cookie isn't readable, so every POST failed with `CSRFTokenError`. This hands the token to the same-origin frontend rather than turning CSRF off. |
| `hira.api.seed.seed_catalog` | Imports products from `sites/catalog.json`. Idempotent. |

---

## Connecting the storefront

The storefront must reach Frappe **same-origin**, or the session cookie is
dropped as third-party and nobody can log in.

**Development** — `VITE_FRAPPE_URL` in the storefront's `.env.local`; Vite
proxies `/api`, `/files`, `/app` and `/assets`.

**Production** — set `FRAPPE_URL` in the Vercel project. `api/[...path].js`
proxies the same paths, so `/app` serves the ERPNext desk on the store's own
domain.

Add `FRAPPE_SITE_NAME` as well if the bench is multi-tenant and the site name
differs from the host you point at.

---

## Configuration

| Setting | Default | Purpose |
|---|---|---|
| `default_country_code` | `1` | Prepended to phone numbers without one. wa.me fails *silently* on a bare local number, so the store would think it had messaged a customer. Set with `bench --site <site> set-config default_country_code 91`. |

### Email

Booking confirmations send automatically once the site has an outgoing Email
Account. Until then the API returns `notified: false` rather than claiming a
message went out — an account still *awaiting its password* counts as
configured in Frappe but fails at SMTP time, so that case is treated as not
ready.

Set one up in the desk: **Email Account → New**, outgoing, default.

---

## Development

```bash
bench --site your-site.local console
```

The storefront repo carries an end-to-end suite that exercises this app —
catalogue, permissions, coupons, orders, bookings and the boundaries around
them:

```bash
BASE=http://localhost:8001 npm run test:e2e
```

Run it before any deploy.

---

## Security notes

- Order lines are priced from the `Item` record, never from the request.
  Quantity is bounded and disabled or non-sales items are refused.
- Discounts are clamped to the catalogue-priced subtotal, so a large discount
  can't drive a total negative.
- `create_cod_order` and the product feeds run with `ignore_permissions` by
  design: shoppers hold no ERPNext roles, and the storefront gates checkout on
  login before calling. Don't widen them to accept an arbitrary customer or
  price without revisiting that.
- CSRF stays enabled. The token endpoint is the supported way to hand it to a
  decoupled frontend.
