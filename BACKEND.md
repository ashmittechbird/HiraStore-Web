# Backend

Two Frappe apps sit behind this storefront:

| App | Where | What it does |
|---|---|---|
| `hira` | **`frappe-app` branch of this repository** | catalogue, coupons, checkout, video call bookings |
| `square_payment` | [TechbirdIT/Square-Pay](https://github.com/TechbirdIT/Square-Pay) | takes card payments through Square |

`square_payment` goes first — `hira` lists it in `required_apps`, so installing
`hira` without it fails immediately rather than at a customer's checkout.

```bash
bench get-app square_payment https://github.com/TechbirdIT/Square-Pay.git --branch develop
bench get-app hira https://github.com/ashmittechbird/HiraStore-Web.git --branch frappe-app

bench --site your-site.local install-app square_payment
bench --site your-site.local install-app hira
bench --site your-site.local migrate
bench set-config -g webserver_port 8001
```

The app name comes **before** the URL. `bench get-app <url> hira` fails with
"hira not found under frappe or erpnext GitHub accounts".

## Card payments

Card is the only way to pay — there is no Cash on Delivery, and no offline card
form. An order is created only as the result of a captured payment.

Add the credentials in the desk, at **Square Payment Settings**:

| Field | From |
|---|---|
| Environment | `sandbox` to test, `production` when live |
| Square App ID | developer.squareup.com/apps → your app |
| Square Location ID | same page, Locations |
| Square Access Token | same page — stored encrypted, never sent to a browser |

Then tick **Enable Card Payments**. Sandbox and production credentials are not
interchangeable; the settings form rejects the obvious mix-ups. Until this is
filled in, checkout tells shoppers card payments are unavailable and points them
at WhatsApp — it never takes an order it cannot charge for.

Full deployment notes, endpoint reference and security rationale are in the
README on that branch.

## Why a branch and not a folder

`bench get-app` clones a repository and expects to find `<app>/hooks.py` at the
root. An app kept in a subdirectory of `main` is invisible to it. An orphan
branch gives the app its own root while keeping both halves of the project in
one repository.

## Changing the backend

The branch has no shared history with `main`, so work on it from a separate
checkout rather than switching branches in this one:

```bash
git clone --branch frappe-app https://github.com/ashmittechbird/HiraStore-Web.git hira-backend
cd hira-backend
# edit, then
git commit -am "..."
git push origin frappe-app
```

On the server, pull it with `bench update --apps hira` or
`cd apps/hira && git pull`, then `bench --site <site> migrate`.

## Verifying a deployment

The storefront's end-to-end suite exercises the live backend:

```bash
BASE=https://your-frappe-host npm run test:e2e
```

The app also ships two checks that run on the server itself. The first reports
what a storefront needs and throws on a hard failure, so a deploy script can
gate on it:

```bash
bench --site your-site.local execute hira.api.health.check
```

The second walks the whole checkout — pricing, coupons, shipping, a tampered
price, a double-clicked Pay button, a declined card — with the gateway stubbed,
then deletes everything it created:

```bash
bench --site your-site.local execute hira.tests.checkout.run
```
