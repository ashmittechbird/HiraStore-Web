# Backend

The Frappe/ERPNext app that powers this storefront lives on the **`frappe-app`
branch of this repository**, as its own root so `bench get-app` can install it
directly.

```bash
bench get-app hira https://github.com/ashmittechbird/HiraStore-Web.git --branch frappe-app
bench --site your-site.local install-app hira
bench --site your-site.local migrate
bench set-config -g webserver_port 8001
```

The app name comes **before** the URL. `bench get-app <url> hira` fails with
"hira not found under frappe or erpnext GitHub accounts".

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

The app also ships a readiness check that runs on the server itself:

```bash
bench --site your-site.local execute hira.api.health.check
```
