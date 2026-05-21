# The Hira Store

A luxury demi-fine jewelry e-commerce storefront built with React + Vite, backed by Frappe/ERPNext for inventory, orders, and customers.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Vite, React Router v6 |
| State | Zustand (cart, wishlist) |
| Backend | Node.js `server.js` — auth API + ERPNext proxy |
| ERP | Frappe/ERPNext 15 (`hira-bench`, port 8001) |
| Payment | Square Web Payments SDK (`square_payment` Frappe app) |
| Styling | Inline CSS-in-JS per component |
| Deployment | Frappe www pages + React SPA served at `/store/` |

---

## Project Structure

```
HiraStore/
├── src/
│   ├── app/
│   │   ├── page.tsx          # Homepage — hero, bestsellers, new arrivals
│   │   ├── shop/             # Full catalog with search, filters, sort
│   │   ├── product/[id]/     # Product detail — gallery, qty, Add to Cart, Buy Now
│   │   ├── cart/             # Cart (Zustand + localStorage) with coupon support
│   │   ├── wishlist/         # Saved items with Add to Cart + Buy Now
│   │   ├── checkout/         # Shipping address form (supports Buy Now flow)
│   │   ├── payment/          # Square card payment step
│   │   ├── order-success/    # Order confirmation
│   │   ├── login/            # Frappe session login
│   │   ├── signup/           # New user + ERPNext Customer creation
│   │   ├── account/          # User account & order history
│   │   ├── about/            # Brand story
│   │   └── admin/            # Admin panel (ERPNext dashboard)
│   ├── components/
│   │   ├── Navbar.tsx        # Sticky nav with cart/wishlist badge counts
│   │   └── Footer.tsx
│   ├── store/
│   │   ├── cart.ts           # Zustand cart store (persisted to localStorage)
│   │   └── wishlist.ts       # Zustand wishlist store (persisted to localStorage)
│   └── lib/
│       └── api.ts            # ERPNext item field helpers (image, price, name, etc.)
├── catalog_images/           # Local product image assets
├── server.js                 # Node.js dev server (port 5500)
├── vite.config.ts
└── package.json
```

---

## Pages & Features

### Homepage (`/store/`)
- Auto-advancing hero slider with Ken Burns zoom
- Trust bar (Premium Quality, Skin Friendly, Free Shipping, Cash on Delivery)
- Shop by Category grid (5 categories with circular images)
- **Most Loved Pieces** — fetches `custom_is_featured` items from ERPNext
- **New Arrivals** — latest items by creation date
- Philosophy quote section
- Promo banners, seasonal offer banner with discount code
- Polaroid-style testimonials carousel (auto-scroll)
- Instagram UGC grid

### Shop (`/store/shop`)
- Fetches up to 500 live items from ERPNext (`is_sales_item = 1, disabled = 0`)
- Search (debounced, searches name + category + material)
- Category filter tabs (All, Earrings, Necklaces, Rings, Bracelets, Pendants, Bangles, Sets, Accessories)
- Sort by: Featured / Price Low-High / Price High-Low / Name A-Z
- Paginated grid (24 per page, Load More)
- Cursor sparkle animation (desktop)
- Scroll progress bar
- Heritage / Our Story section

### Product Cards (Shop, Homepage, Wishlist — unified design)
All product cards across the site share identical behavior:
- Click card → navigate to product detail page
- Hover → slide-up actions panel with **Add to Cart** + **Quick View**
- **Add to Cart**: turns green on add; becomes a **+/− quantity stepper** when item is already in cart
- **Quick View modal**: multi-image gallery with thumbnail strip, full product info, stepper, **Buy Now**
- Cart badge (teal pill showing in-cart quantity) on the image
- Promo badge (New / Bestseller / Trending / Limited)
- Wishlist heart button (always visible, filled red when saved)
- Stars rating display

### Product Detail (`/store/product/:id`)
- Vertical thumbnail strip (left) + large main image with click-to-zoom
- Category badge, Featured badge
- Material + weight details
- Quantity selector (+/− up to 10)
- **Add to Cart** button (turns green, shows checkmark)
- **Buy Now** button — skips cart, goes directly to checkout
- In-cart stepper replaces Add to Cart when item is already in cart
- Add to / Remove from Wishlist
- Trust badges (Premium Quality, Free shipping, 30-day returns, 1-year warranty)

### Cart (`/store/cart`)
- Line items with image, name, qty stepper, remove
- Coupon code validation against ERPNext `Coupon Code` doctype
- Subtotal / Shipping (free over $15) / Discount / Total
- Checkout requires login — redirects to `/login?return=/checkout`

### Wishlist (`/store/wishlist`)
- Persistent across sessions (localStorage)
- Same card design as shop: Add to Cart stepper, **Buy Now**, remove from wishlist

### Checkout (`/store/checkout`)
- Requires login
- Pre-fills name/email from Frappe user session
- Pre-fills saved address from `localStorage`
- Coupon code support
- **Supports Buy Now flow**: if `sessionStorage.hs_buynow` is set, uses that single item instead of the full cart — real cart is untouched
- Saves shipping details to `localStorage` for next visit

### Payment (`/store/payment`)
- Square Web Payments SDK (card element)
- Reads checkout data from `sessionStorage.hs_checkout`
- Creates ERPNext Sales Order on success
- Clears cart after successful payment

### Admin Panel (`/store/admin`)
- Direct ERPNext API connection (API key/secret stored in `localStorage`)
- Tabs: Products, Orders, Customers, Coupons, Settings
- Product CRUD (enable/disable, mark featured, edit price)
- Order list with status management
- Customer list
- Coupon code management

---

## Buy Now Flow

"Buy Now" allows a customer to purchase a single item immediately without touching their existing cart.

1. Customer clicks **Buy Now** on a product page, Quick View modal, or wishlist card
2. Item (`{ id, name, category, price, image, qty }`) is saved to `sessionStorage` as `hs_buynow`
3. Customer is sent to `/checkout` to fill in their shipping address
4. On submit, checkout uses `hs_buynow` as the order cart and clears it from sessionStorage
5. Payment proceeds normally via Square

**Where Buy Now appears:**
- Product detail page (button below Add to Cart)
- Quick View modal (shop page and homepage)
- Wishlist cards (replaces Quick View button)

---

## Routes

| Path | Description |
|------|-------------|
| `/store/` | Homepage |
| `/store/shop` | Full catalog |
| `/store/product/:id` | Product detail |
| `/store/cart` | Shopping cart |
| `/store/wishlist` | Saved items |
| `/store/checkout` | Shipping address + coupon |
| `/store/payment` | Square card payment |
| `/store/order-success` | Order confirmation |
| `/store/login` | Login |
| `/store/signup` | Sign up |
| `/store/account` | User account & order history |
| `/store/about` | Brand story |
| `/store/admin` | Admin panel |

---

## Getting Started

### Prerequisites

- Node.js 18+
- Frappe bench running at `localhost:8001` (hira-bench)
- ERPNext API key/secret configured in `server.js`
- `square_payment` Frappe app installed on hira-bench

### Local Development (server.js)

> **Important:** Always run builds from the Linux path, not the Windows (`/mnt/c/...`) path — WSL cannot `chmod` on NTFS.

**Linux build directory:** `/home/frappenew_user/hirastore-build/`

```bash
# 1. Sync source from Windows to Linux build dir
rsync -av /mnt/c/Users/ashmi/OneDrive/Desktop/HiraStore/src/ /home/frappenew_user/hirastore-build/src/
rsync -av /mnt/c/Users/ashmi/OneDrive/Desktop/HiraStore/vite.config.ts \
          /mnt/c/Users/ashmi/OneDrive/Desktop/HiraStore/index.html \
          /home/frappenew_user/hirastore-build/

# 2. Build
cd /home/frappenew_user/hirastore-build
npm run build

# 3. Start server
node server.js
```

App runs at: **`http://localhost:5500/store`**

### Frappe Build (deploy to hira-bench)

```bash
cd /home/frappenew_user/hirastore-build
npm run build:frappe

# Copy built assets to Frappe public dir
cp -r dist/* /home/frappenew_user/hira-bench/apps/hira/hira/public/hirastore/
bench --site hirastore.local build
```

App runs at: **`http://localhost:8001/store`**

---

## API (server.js)

`server.js` runs on port 5500 and handles:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/auth/login` | POST | Frappe session login |
| `/api/auth/signup` | POST | Creates Frappe User + ERPNext Customer |
| `/api/auth/logout` | POST | Invalidates session |
| `/api/auth/me` | GET | Current session info |
| `/api/orders/create` | POST | Creates ERPNext Sales Order |
| `/api/customer/orders` | GET | Lists orders for logged-in user |
| `/api/customer/profile` | POST | Updates shipping address |
| `/api/homepage/sections` | GET/POST | Curated homepage product lists |
| `/api/offers` | GET | Active coupon codes |
| `/api/coupon/validate` | POST | Validates coupon + calculates discount |
| `/erp/*` | proxy | Passes requests to ERPNext at port 8001 |

---

## Admin Panel

Access at `/store/admin`. Connects directly to ERPNext using API key/secret stored in `localStorage` (`hs_admin_cfg`).

Default ERPNext credentials (configure in Settings tab):
- **URL:** `http://127.0.0.1:8001`
- **API Key:** `df4ffcff00dcb5d`
- **API Secret:** `054316891a5f19f`

Features: product CRUD, order management, customer list, coupon codes, homepage curation.

---

## Key ERPNext Custom Fields

| DocType | Field | Purpose |
|---------|-------|---------|
| Item | `custom_is_featured` | Show in Most Loved section on homepage |
| Item | `custom_item_images` | Additional product images (JSON array of URLs) |
| Item | `custom_material` | Displayed on product detail + shop card |
| Item | `custom_short_description` | Short blurb on product detail page |

---

## Environment

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `5500` | server.js listen port |
| `ERP_HOST` | `127.0.0.1` | ERPNext host |
| `ERP_PORT` | `8001` | ERPNext port |
| `ERP_API_KEY` | see server.js | ERPNext API key |
| `ERP_API_SECRET` | see server.js | ERPNext API secret |
| `VITE_CATALOG_BASE` | `/catalog_images` | Image base URL for Frappe builds |
