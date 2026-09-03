app_name = "hira"
app_title = "Hira"
app_publisher = "The Hira Store"
app_description = "Storefront API for The Hira Store — products, orders, coupons and video call bookings"
app_email = "info@thehirastore.com"
app_license = "MIT"
# square_payment is required, not optional. The storefront takes card payments
# and nothing else, so a bench without the gateway is a shop that cannot sell.
# Failing at `bench install-app` costs far less than finding out at a customer's
# checkout — BACKEND.md carries both get-app lines.
required_apps = ["erpnext", "square_payment"]

# Custom Item fields and the promotional coupons are created here rather than
# by hand. after_migrate repeats it so a field added in a later release lands
# on every deploy without anyone remembering a step.
after_install = "hira.install.after_install"
after_migrate = "hira.install.after_migrate"
before_uninstall = "hira.install.before_uninstall"

# The storefront is served from its own origin (Vite in development, Vercel in
# production) and reaches Frappe through a same-origin proxy, so no CORS entry
# is needed here. See the README if you serve it from a different host.
