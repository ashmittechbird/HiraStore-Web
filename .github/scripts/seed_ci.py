"""Minimum viable catalogue for the checkout self-test, for CI only.

hira/tests/checkout.py needs at least two enabled, priced sales items - one
below the free-shipping threshold and one above it - plus a company with a
currency, because create_card_order builds a real Sales Order. A bare
`install-app erpnext` gives you none of that, since the setup wizard never ran.

Idempotent: re-running changes nothing.
"""

import sys

import frappe

SITE = sys.argv[1] if len(sys.argv) > 1 else "ci.localhost"

frappe.init(site=SITE, sites_path=".")
frappe.connect()
frappe.set_user("Administrator")
frappe.flags.in_test = True

try:
    if not frappe.db.exists("Company", {"company_name": "Hira CI"}):
        frappe.get_doc(
            {
                "doctype": "Company",
                "company_name": "Hira CI",
                "abbr": "HCI",
                "default_currency": "USD",
                "country": "United States",
            }
        ).insert(ignore_permissions=True)
        print("created company Hira CI")

    company = frappe.db.get_value("Company", {"company_name": "Hira CI"}, "name")
    frappe.db.set_default("company", company)
    frappe.db.set_default("currency", "USD")

    # One item under the free-shipping threshold and one comfortably over it, so
    # the test exercises both shipping branches.
    for code, rate in (("CI-CHEAP", 25.0), ("CI-DEAR", 500.0)):
        if not frappe.db.exists("Item", code):
            frappe.get_doc(
                {
                    "doctype": "Item",
                    "item_code": code,
                    "item_name": code.replace("-", " ").title(),
                    "item_group": "All Item Groups",
                    "stock_uom": "Nos",
                    "is_sales_item": 1,
                    "is_stock_item": 0,
                    "standard_rate": rate,
                }
            ).insert(ignore_permissions=True)
            print(f"created item {code} @ {rate}")

    frappe.db.commit()
    n = frappe.db.count("Item", {"is_sales_item": 1, "disabled": 0})
    print(f"sellable items now: {n}")
    if n < 2:
        raise SystemExit("seeding did not produce two sellable items")
finally:
    frappe.destroy()
