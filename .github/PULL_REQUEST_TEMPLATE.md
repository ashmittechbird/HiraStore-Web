## What this changes

<!-- One or two sentences. What is different after this merges? -->

## Which branch does this target?

This repo keeps each app on its own rootless branch. Tick the one you are
changing, because the review and deploy path differs:

- [ ] `master` — React storefront, deployed by Vercel
- [ ] `frappe-app` — the `hira` Frappe app, deployed by `deploy.sh` to hira-bench
- [ ] `square-pay` — the `square_payment` Frappe app, same deploy path

## Checks

- [ ] CI is green (`bench integration` — builds a throwaway bench and runs `hira.tests.checkout.run`)
- [ ] For storefront changes: `npm run build` and `npm run typecheck` pass
- [ ] For app changes: no new DocType field or fixture that `after_migrate` will not create idempotently

## Anything that needs doing by hand after merge?

<!-- Config in desk, a DNS record, a secret, a one-off script. Write "none" if
     none - deploys are automated, but business config is not. -->
