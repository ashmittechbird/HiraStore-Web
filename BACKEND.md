# Backend

Everything lives in [TechbirdIT/HiraStore](https://github.com/TechbirdIT/HiraStore),
on three branches. Each is a root, because `bench get-app` clones a repository
and expects `<app>/hooks.py` at the top of it — an app in a subdirectory is
invisible to it.

| Branch | Holds | Installed with |
|---|---|---|
| `master` | the React storefront | Vercel, from the repo root |
| `frappe-app` | the `hira` app — catalogue, coupons, checkout, bookings | `bench get-app` |
| `square-pay` | the `square_payment` app — Square card payments | `bench get-app` |

`square_payment` goes first: `hira` lists it in `required_apps`, so installing
`hira` without it fails immediately rather than at a customer's checkout.

```bash
bench get-app square_payment https://github.com/TechbirdIT/HiraStore.git --branch square-pay
bench get-app hira https://github.com/TechbirdIT/HiraStore.git --branch frappe-app

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
README on each app branch.

## Why branches and not folders

The app branches were vendored into a `frappe-app/` folder here once. It was a
copy `bench` could never install, and within a fortnight it had drifted from the
one actually running — still creating its doctype at runtime, missing its
installer. Two copies of a backend is one too many.

An orphan branch gives each app its own root, which is what `bench get-app`
needs, while keeping every part of the project in one repository.

## Changing the backend

The app branches share no history with `master`, so work on them from separate
checkouts rather than switching branches in this one:

```bash
git clone --branch frappe-app https://github.com/TechbirdIT/HiraStore.git hira-backend
git clone --branch square-pay https://github.com/TechbirdIT/HiraStore.git square-pay

cd hira-backend
# edit, then
git commit -am "..."
git push origin HEAD:frappe-app
```

On the server, pull with `bench update --apps hira` or `cd apps/hira && git
pull`, then `bench --site <site> migrate`.

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
