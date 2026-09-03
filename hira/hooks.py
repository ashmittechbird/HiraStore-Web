app_name = "hira"
app_title = "Hira"
app_publisher = "The Hira Store"
app_description = "Storefront API for The Hira Store — products, orders, coupons and video call bookings"
app_email = "info@thehirastore.com"
app_license = "MIT"
required_apps = ["erpnext"]

# Custom Item fields and the promotional coupons are created here rather than
# by hand. after_migrate repeats it so a field added in a later release lands
# on every deploy without anyone remembering a step.
after_install = "hira.install.after_install"
after_migrate = "hira.install.after_migrate"
before_uninstall = "hira.install.before_uninstall"

# The storefront is served from its own origin (Vite in development, Vercel in
# production) and reaches Frappe through a same-origin proxy, so no CORS entry
# is needed here. See the README if you serve it from a different host.
