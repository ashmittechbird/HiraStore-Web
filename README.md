# The Hira Store

A luxury demi-fine jewelry storefront built with React + Vite, backed by
Frappe/ERPNext for inventory, orders and customers.

---

## Two modes, one build

The storefront detects at runtime whether a Frappe backend is answering and
adapts. There is no separate "demo build" — the same bundle does both.

| | **Frappe mode** | **Demo mode** |
|---|---|---|
| Trigger | `/api/method/ping` answers | it doesn't (404, timeout, no backend configured) |
| Products | live ERPNext `Item` records | 286 pieces bundled from the product catalogue |
| Accounts | Frappe users + session cookie | accounts kept in the browser |
| Orders | ERPNext Sales Orders | stored in the browser |
| Card payment | Square Web Payments SDK, real charge | no card asked for, clearly labelled |
| Admin panel | full ERPNext CRUD | full CRUD against the local store |

Demo mode exists so the site is never a dead page — a Vercel preview with no
backend, a laptop off the VPN, or a client walkthrough all still show a
complete, working store. A quiet **Demo mode** chip appears bottom-left when
it's active, because orders placed in that state never reach the merchant.

Force a mode with `VITE_BACKEND_MODE=demo` or `=frappe`.

---

## Getting started

```bash
npm install
npm run dev
```

Opens at **http://localhost:8001/store/**.

No backend needed. To point at a bench, set `VITE_FRAPPE_URL` in `.env.local`
(see [.env.example](.env.example)) — the dev server proxies `/api` and `/files`
there.

**Demo sign-in:** `admin@hira.store` / `admin123` (the login page offers a
one-tap fill). Shoppers can register their own account from Sign Up.

### Scripts

| Command | What it does |
|---|---|
| `npm run dev` | dev server at `/store/` |
| `npm run import-sheet` | read the master .xlsx into `catalog_images/catalog_sheet.json` |
| `npm run catalog` | regenerate `src/data/catalog.json` from that sheet data |
| `npm run build` | production build (base `/assets/hirastore/store/`) |
| `npm run build:vercel` | production build for Vercel (base `/`) |
| `npm run build:frappe` | build for the Frappe asset pipeline |
| `npm run deploy` | copy `dist/` into a sibling `hirastore` Frappe app |
| `npm run typecheck` | `tsc --noEmit` |

> `build` no longer runs `deploy` automatically — `deploy` deletes files in a
> sibling directory, which is not something a build should do silently (and it
> breaks any CI runner). Run it explicitly when you want it.

---

## Deploying to Vercel

Import the repo. [vercel.json](vercel.json) already sets the build command,
output directory, SPA rewrites and asset caching, so no dashboard configuration
is needed.

**With no environment variables**, the deploy is a fully working storefront on
the bundled catalogue — useful for sharing a link with a client.

**To connect the real backend**, add one project environment variable:

```
FRAPPE_URL = https://erp.yourdomain.com
```

[api/\[...path\].js](api/[...path].js) then serves the whole backend under this
domain, same-origin — which is what makes Frappe's session cookie work, since a
cross-origin call would have it dropped as third-party:

| Path | Serves |
|---|---|
| `/app` | the **ERPNext desk**, on your own domain |
| `/assets/*` | desk assets — the storefront's own bundles live at `/static/*` to avoid the clash |
| `/api/*` | REST and whitelisted methods |
| `/files/*`, `/private/*` | uploads and product images |
| `/logout` | ends the Frappe session |

`/login` deliberately stays with the storefront: it authenticates through
`/api/method/login`, so signing in there produces exactly the session cookie the
desk needs.

Add `FRAPPE_SITE_NAME` as well if the bench is multi-tenant and the site isn't
named after the host you point at.

Two limits worth knowing. The desk's realtime features (live notifications) need
websockets, which a serverless proxy can't carry, and every desk request pays one
extra network hop. Day-to-day desk work is fine; heavy bulk operations are better
run against the bench directly.

Your Frappe site must allow the Vercel domain in its CORS settings, and the
`hira` and `square_payment` apps must be installed for products and card
payments to come from the server.

---

## Project structure

```
HiraStore/
├── api/[...path].js          # Vercel → Frappe reverse proxy
├── scripts/build-catalog.mjs # spreadsheet export → src/data/catalog.json
├── src/
│   ├── lib/
│   │   ├── backend.ts        # backend router: Frappe first, demo fallback
│   │   ├── demoDb.ts         # the in-browser store
│   │   ├── frappe.tsx        # drop-in replacement for frappe-react-sdk hooks
│   │   ├── config.ts         # base paths, shipping rules, mode override
│   │   └── api.ts            # ERPNext Item field helpers
│   ├── data/catalog.json     # generated — do not edit by hand
│   ├── app/…                 # one folder per route
│   ├── components/           # Navbar, Footer, DemoBadge
│   └── store/                # Zustand cart + wishlist
├── public/catalog_images/    # 290 product photos, named by SKU
└── vercel.json
```

### How the data layer works

Every backend call goes through `backend.call()`. It probes once per page load,
then either talks to Frappe or answers from `demoDb`. If a live backend dies
mid-session the next call falls back rather than showing a broken screen.

`src/lib/frappe.tsx` exposes the same hook names as `frappe-react-sdk`
(`useFrappeGetDocList`, `useFrappeAuth`, …) so pages read the same as before,
but every one of them now has a fallback path. The upstream SDK was removed —
it talks over axios with no fallback, which is why the whole site went blank
whenever the bench was unreachable.

### The catalogue

`npm run catalog` reads `catalog_images/catalog_data.json` (the original
spreadsheet export) and emits Frappe-shaped `Item` records: SKU, name, category,
price, weight, material and description. Products without a photo or a price are
skipped. Names come from the sheet's description column where it has one, and
are composed from the product's real attributes where it doesn't.

The generated file carries a signature. When it changes, a returning visitor's
browser re-seeds automatically — while keeping any products the admin edited.

---

## Pages

| Path | Notes |
|---|---|
| `/` | hero slider, category grid, Most Loved, New Arrivals, testimonials |
| `/shop` | search, category tabs, sort, 24-per-page grid |
| `/product/:id` | gallery, quantity, Add to Cart, Buy Now |
| `/cart` | line items, coupon validation, totals |
| `/wishlist` | saved items, per account |
| `/checkout` | shipping address, coupon, Buy Now bypass |
| `/payment` | Square card form; refuses an order it can't charge for |
| `/order-success` | confirmation |
| `/login`, `/signup`, `/account` | auth + order history |
| `/about` | brand story |
| `/admin` | products, orders, customers, coupons, homepage curation |

Shipping is free over **$100**, otherwise **$5** — in `src/lib/config.ts` for
the cart and checkout, and mirrored in `hira/api/orders.py` on the server, which
is the figure actually charged. If the two ever disagree, checkout refuses the
order rather than billing a total the shopper wasn't shown.

Seeded coupons: `HIRA30` (30%), `WELCOME10` (10%), `FESTIVE20` (20% over $100).

---

## Admin panel

`/admin`, gated on the System Manager role. Product CRUD with image upload,
order list with status updates, customers, coupon codes, and homepage curation
for the Most Loved / New Arrivals rails.

In demo mode Settings gains a **Reset demo data** action that restores the
original catalogue and clears test orders.

Homepage curation publishes to `/files/homepage_config.json` on a live backend
so every visitor sees the same rails; in demo mode it stays local.

---

## ERPNext custom fields

| DocType | Field | Purpose |
|---|---|---|
| Item | `custom_is_featured` | show in Most Loved |
| Item | `custom_item_images` | extra product images (JSON array) |
| Item | `custom_material` | shown on the product page and shop card |
| Item | `custom_short_description` | blurb on the product page |
