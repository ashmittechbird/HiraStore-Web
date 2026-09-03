"""Deployment readiness check.

Run on the server after installing or updating the app:

    bench --site your-site.local execute hira.api.health.check

Reports what a storefront actually needs, and says plainly which parts are not
ready rather than printing a reassuring summary. Exits non-zero on a hard
failure so it can gate a deploy script.
"""

import frappe

OK, WARN, FAIL = "OK  ", "WARN", "FAIL"


def _rows():
    """Yield (level, area, detail) for every check."""

    # ── the app itself ──────────────────────────────────────────────────────
    installed = frappe.get_installed_apps()
    yield (OK if "erpnext" in installed else FAIL, "erpnext installed", ", ".join(installed))
    yield (OK if "hira" in installed else FAIL, "hira installed", "")

    if frappe.db.exists("DocType", "Video Call Booking"):
        d = frappe.get_doc("DocType", "Video Call Booking")
        # custom=1 means it was built at runtime and won't travel with the code.
        lvl = OK if not d.custom else WARN
        yield (lvl, "Video Call Booking doctype", f"module {d.module}, custom={d.custom}")
    else:
        yield (FAIL, "Video Call Booking doctype", "missing — run: bench --site <site> migrate")

    # ── company and currency ────────────────────────────────────────────────
    company = frappe.db.get_value("Company", {}, "name")
    if company:
        cur = frappe.db.get_value("Company", company, "default_currency")
        yield (OK, "company", f"{company} ({cur})")
    else:
        yield (FAIL, "company", "none — run the ERPNext setup wizard, then bench migrate")

    if not frappe.db.get_single_value("System Settings", "setup_complete"):
        yield (WARN, "setup wizard", "not marked complete; the desk will redirect to it")

    # ── catalogue ───────────────────────────────────────────────────────────
    total = frappe.db.count("Item")
    sellable = frappe.db.count("Item", {"disabled": 0, "is_sales_item": 1})
    if sellable:
        yield (OK, "catalogue", f"{sellable} sellable of {total} items")
    else:
        yield (FAIL, "catalogue", "no sellable items — run hira.api.seed.seed_catalog")

    priced = frappe.db.sql(
        """select count(*) from tabItem
           where disabled = 0 and is_sales_item = 1 and ifnull(standard_rate, 0) <= 0"""
    )[0][0]
    yield (
        (OK if not priced else WARN),
        "item pricing",
        "every sellable item has a price" if not priced else f"{priced} sellable items priced at 0",
    )

    for field in ("custom_material", "custom_short_description", "custom_is_featured", "custom_item_images"):
        if not frappe.db.exists("Custom Field", {"dt": "Item", "fieldname": field}):
            yield (FAIL, f"Item.{field}", "missing — reinstall the app or run bench migrate")
            break
    else:
        yield (OK, "Item custom fields", "all four present")

    # ── coupons ─────────────────────────────────────────────────────────────
    coupons = frappe.get_all("Coupon Code", fields=["name", "coupon_code", "maximum_use", "pricing_rule"])
    if not coupons:
        yield (WARN, "coupons", "none configured")
    else:
        # maximum_use of 0 blocks every redemption: ERPNext validates
        # used >= maximum_use, and 0 >= 0 is true.
        broken = [c.coupon_code for c in coupons if not c.maximum_use]
        norule = [c.coupon_code for c in coupons if not c.pricing_rule]
        if broken:
            yield (FAIL, "coupon usage limit", f"maximum_use is 0 (never redeemable): {', '.join(broken)}")
        if norule:
            yield (FAIL, "coupon discount", f"no Pricing Rule, so 0% off: {', '.join(norule)}")
        if not broken and not norule:
            yield (OK, "coupons", ", ".join(c.coupon_code for c in coupons))

    # ── guest access ────────────────────────────────────────────────────────
    # The storefront is read by logged-out shoppers; these must answer for Guest.
    for method in (
        "hira.api.products.get_public_items",
        "hira.api.coupons.validate_coupon",
        "hira.api.bookings.create_booking",
        "hira.api.session.get_csrf_token",
        "hira.api.payments.get_payment_config",
    ):
        # frappe.guest_methods holds the function objects themselves, and it is
        # populated as modules import — get_attr does that import for us.
        fn = frappe.get_attr(method)
        allowed = fn in frappe.guest_methods
        yield (
            OK if allowed else FAIL,
            f"guest access {method.split('.')[-1]}",
            "" if allowed else "not guest-whitelisted — logged-out shoppers will see errors",
        )

    # ── email ───────────────────────────────────────────────────────────────
    from hira.api.bookings import can_send_email

    if can_send_email():
        acc = frappe.db.get_value(
            "Email Account", {"enable_outgoing": 1, "default_outgoing": 1, "awaiting_password": 0}, "email_id"
        )
        yield (OK, "outgoing email", f"{acc} — booking confirmations will send")
    else:
        waiting = frappe.db.get_value("Email Account", {"enable_outgoing": 1, "awaiting_password": 1}, "email_id")
        detail = (
            f"{waiting} is set up but has no password — add it in the desk"
            if waiting
            else "no outgoing Email Account; confirmations will not send"
        )
        yield (WARN, "outgoing email", detail)

    # ── payments ────────────────────────────────────────────────────────────
    # Card is the only way to pay, so an unready gateway is a shop that cannot
    # take a single order. Every branch below is a FAIL for that reason.
    if "square_payment" not in installed:
        yield (FAIL, "card payments", "square_payment not installed — no order can be placed")
    elif not frappe.db.exists("DocType", "Square Payment Settings"):
        yield (FAIL, "card payments", "Square Payment Settings missing — run: bench --site <site> migrate")
    else:
        s = frappe.get_single("Square Payment Settings")
        env = (s.square_environment or "sandbox").lower()
        token = s.get_password("square_access_token", raise_exception=False)

        blanks = [
            label
            for label, value in (
                ("App ID", s.square_app_id),
                ("Location ID", s.square_location_id),
                ("Access Token", token),
            )
            if not value
        ]

        if blanks:
            yield (FAIL, "card payments", "not configured — missing " + ", ".join(blanks)
                   + " (desk > Square Payment Settings)")
        elif not s.enabled:
            yield (FAIL, "card payments", "credentials are in but 'Enable Card Payments' is off")
        elif env != "production":
            # Sandbox takes test cards and moves no money. Correct while testing,
            # a disaster if it reaches a live shop unnoticed.
            yield (WARN, "card payments", "configured, but in SANDBOX — no real money is taken")
        else:
            yield (OK, "card payments", f"Square, production, location {s.square_location_id}")

        # Square rejects a charge outright when the amount's currency differs
        # from the location's, and the storefront prices everything in the
        # company currency.
        company_currency = frappe.db.get_value("Company", frappe.db.get_value("Company", {}, "name"), "default_currency")
        gateway_currency = (s.currency or "USD").upper()
        if company_currency and gateway_currency != company_currency:
            yield (FAIL, "payment currency",
                   f"gateway charges in {gateway_currency} but the company sells in {company_currency}")

    # An order endpoint that takes no money lets anyone book stock for free.
    # create_cod_order was exactly that, and it was guest-reachable through the
    # gateway app too. Assert both are gone rather than trusting they are.
    import hira.api.orders as orders_module

    free_order_paths = [
        name
        for module, name in (
            (orders_module, "create_cod_order"),
            (frappe.get_module("square_payment.api") if "square_payment" in installed else None, "process_payment"),
        )
        if module is not None and getattr(module, name, None) in frappe.whitelisted
    ]
    if free_order_paths:
        yield (FAIL, "checkout", "order endpoints that take no payment: " + ", ".join(free_order_paths))
    else:
        yield (OK, "checkout", "an order can only be created by a captured payment")

    # ── site config ─────────────────────────────────────────────────────────
    cc = frappe.conf.get("default_country_code")
    yield (
        (OK if cc else WARN),
        "default_country_code",
        f"{cc}" if cc else "unset, assuming 1 — WhatsApp links to local numbers will fail silently",
    )

    port = frappe.conf.get("webserver_port")
    yield (
        (OK if str(port) == "8001" else WARN),
        "webserver_port",
        f"{port}" + ("" if str(port) == "8001" else " — the storefront proxies to 8001 by default"),
    )

    if frappe.conf.get("developer_mode"):
        yield (WARN, "developer_mode", "on — turn it off on a public server")
    if frappe.conf.get("server_script_enabled"):
        yield (WARN, "server_script_enabled", "on — admin access becomes code execution; turn off in production")


@frappe.whitelist()
def check():
    """Print the readiness report. Raises if anything is a hard failure."""
    results = list(_rows())

    print("\nHira backend readiness\n" + "=" * 62)
    for level, area, detail in results:
        print(f"  {level}  {area}" + (f" — {detail}" if detail else ""))

    fails = [r for r in results if r[0] == FAIL]
    warns = [r for r in results if r[0] == WARN]
    print("=" * 62)
    print(f"  {len(results) - len(fails) - len(warns)} ok, {len(warns)} warnings, {len(fails)} failures\n")

    if fails:
        frappe.throw("Not ready to serve: " + "; ".join(a for _, a, _ in fails))
    return {"ok": True, "warnings": len(warns)}
