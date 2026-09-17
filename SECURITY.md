# Security

## Reporting

Report suspected vulnerabilities privately to **saurabh.awate@techbirdit.in**.
Please do not open a public issue for anything affecting payments, customer
data or authentication.

## What this project handles

The storefront takes card payments through Square and stores customer and order
records in Frappe/ERPNext. Two properties are load-bearing and worth stating
plainly, because both are enforced in code and covered by the test suite:

1. **An order can only be created by a captured payment.** There is no
   payment-free path to a Sales Order. `hira/api/health.py` asserts this, and
   `hira/tests/checkout.py` proves it against a stubbed gateway.
2. **Prices come from the catalogue, never from the browser.** A tampered cart
   price is ignored and the card is charged the real amount. Shipping is priced
   server-side for the same reason.

If a change would weaken either, it needs explicit review.

## Dependencies

Dependabot is configured in `.github/dependabot.yml`. Security advisories raise
PRs regardless of the major-version ignore rule, which applies only to routine
updates.

Note when triaging: `vite` and `esbuild` are **devDependencies**. The deployed
artifact is a static build, so their dev-server advisories affect developer
machines rather than the storefront. `npm audit --omit=dev` is the number that
reflects production exposure.

## Secrets

Square credentials, the site's database password and the Administrator password
live in the bench's `site_config.json` and in `hira-cicd/etc/` on the server,
mode 0600. None of them belong in this repository.
