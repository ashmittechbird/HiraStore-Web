# `hira` — the storefront's Frappe app

The storefront calls a handful of endpoints that plain ERPNext doesn't provide.
The original `hira` app was never in this repository, so this is a minimal
rebuild of exactly what the frontend needs — kept here so the backend isn't a
machine that only one person can reproduce.

## Why each endpoint exists

| Endpoint | Why it can't just use ERPNext directly |
|---|---|
| `hira.api.products.get_public_items` | Guests can't read the `Item` doctype, so a logged-out shopper saw an empty shop. Opening `Item` to Guest would also expose `valuation_rate` and `last_purchase_rate`; this returns a safe field list instead. |
| `hira.api.products.get_public_item` | Same permission wall, for a single product page. |
| `hira.api.orders.create_cod_order` | Orders used to go through the `square_payment` app, which isn't installed. This books a real submitted Sales Order and creates the Customer on first purchase. |
| `hira.api.orders.get_my_orders` | Shoppers can't list Sales Orders they don't own; this scopes to their own by contact email. |
| `hira.api.session.get_csrf_token` | The desk reads its CSRF token from the bootinfo in the page Frappe serves. The storefront is served by Vite/Vercel, so it has no boot — every POST failed with `CSRFTokenError`. This hands the token to the same-origin frontend instead of disabling CSRF on the bench. |
| `hira.api.seed.seed_catalog` | Imports the 286 bundled products, so a fresh bench isn't an empty shop. Idempotent — re-run it after regenerating `src/data/catalog.json`. |

## Installing on a bench

```bash
cp -r frappe-app "$BENCH/apps/hira"
cd "$BENCH" && ./env/bin/pip install -e ./apps/hira
printf 'hira\n' >> sites/apps.txt      # ensure the file ends with a newline first
bench --site <site> install-app hira
bench --site <site> execute hira.api.seed.seed_catalog
```

Then serve on the port the storefront proxies to:

```bash
bench set-config -g webserver_port 8001
```

## A note on permissions

`create_cod_order` and the product feeds run with `ignore_permissions`. That is
deliberate: shoppers hold no ERPNext roles, and the storefront is the authority
on what they may buy — it gates checkout on login before calling. Do not widen
these endpoints to accept an arbitrary `customer` or price without revisiting
that, since the rate is currently taken from the request.
