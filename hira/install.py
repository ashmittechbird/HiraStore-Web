"""One-time setup that runs on `bench install-app hira`.

Everything the storefront needs that isn't a DocType file: the custom Item
fields the product feed reads, the promotional coupons the homepage advertises,
and the site defaults that make a decoupled frontend work.

All of it is idempotent — `after_migrate` runs it again on every deploy, so a
field added in a later release lands without anyone remembering a manual step.
"""

import frappe

# Fields the storefront reads that stock ERPNext has no equivalent for.
ITEM_CUSTOM_FIELDS = [
    {
        "fieldname": "custom_material",
        "label": "Material",
        "fieldtype": "Data",
        "insert_after": "item_group",
        "description": "Shown on the product page, e.g. 'Pure Silver'.",
    },
    {
        "fieldname": "custom_short_description",
        "label": "Short Description",
        "fieldtype": "Small Text",
        "insert_after": "custom_material",
        "description": "The product name and blurb shown in the shop.",
    },
    {
        "fieldname": "custom_is_featured",
        "label": "Is Featured",
        "fieldtype": "Check",
        "insert_after": "custom_short_description",
        "description": "Show in the 'Most Loved' rail on the homepage.",
    },
    {
        "fieldname": "custom_item_images",
        "label": "Item Images (JSON)",
        "fieldtype": "Small Text",
        "insert_after": "custom_is_featured",
        "description": "Extra product photos as a JSON array of URLs.",
    },
]

# The codes the storefront advertises. Percentages live on a Pricing Rule.
DEFAULT_COUPONS = [
    {"code": "HIRA30", "pct": 30, "min": 0, "desc": "30% off sitewide"},
    {"code": "WELCOME10", "pct": 10, "min": 0, "desc": "10% off your first order"},
    {"code": "FESTIVE20", "pct": 20, "min": 100, "desc": "20% off orders over $100"},
]


def after_install():
    setup()


def after_migrate():
    setup()


def setup():
    ensure_item_fields()
    ensure_coupons()
    frappe.db.commit()


def ensure_item_fields():
    from frappe.custom.doctype.custom_field.custom_field import create_custom_field

    for spec in ITEM_CUSTOM_FIELDS:
        if frappe.db.exists("Custom Field", {"dt": "Item", "fieldname": spec["fieldname"]}):
            continue
        create_custom_field("Item", spec, ignore_validate=True)


def ensure_coupons():
    """Create the advertised codes, each with the Pricing Rule that carries the
    discount.

    `maximum_use` must be greater than zero: ERPNext validates
    `used >= maximum_use` when a Sales Order names a coupon, so a maximum of 0
    means the code can never be redeemed rather than meaning unlimited. Leaving
    it at the default silently breaks every discounted order.
    """
    company = frappe.db.get_value("Company", {}, "name")
    if not company:
        # No company yet — the setup wizard hasn't run. after_migrate will
        # pick this up on the next deploy.
        return

    currency = frappe.db.get_value("Company", company, "default_currency") or "USD"

    for c in DEFAULT_COUPONS:
        if frappe.db.exists("Coupon Code", {"coupon_code": c["code"]}):
            continue

        rule = frappe.get_doc({
            "doctype": "Pricing Rule",
            "title": f"Coupon {c['code']}",
            "apply_on": "Transaction",
            "price_or_product_discount": "Price",
            "selling": 1,
            "coupon_code_based": 1,
            "rate_or_discount": "Discount Percentage",
            "discount_percentage": c["pct"],
            "min_amt": c["min"],
            "company": company,
            "currency": currency,
            "valid_from": "2025-01-01",
            "valid_upto": "2035-12-31",
        })
        rule.flags.ignore_permissions = True
        rule.insert(ignore_permissions=True)

        coupon = frappe.get_doc({
            "doctype": "Coupon Code",
            "coupon_name": c["code"],
            "coupon_code": c["code"],
            "coupon_type": "Promotional",
            "maximum_use": 100000,
            "pricing_rule": rule.name,
            "description": c["desc"],
            "valid_from": "2025-01-01",
            "valid_upto": "2035-12-31",
        })
        coupon.flags.ignore_permissions = True
        coupon.insert(ignore_permissions=True)


def before_uninstall():
    """Leave business data alone; only drop what this app introduced."""
    for spec in ITEM_CUSTOM_FIELDS:
        name = frappe.db.get_value("Custom Field", {"dt": "Item", "fieldname": spec["fieldname"]})
        if name:
            frappe.delete_doc("Custom Field", name, ignore_permissions=True, force=True)
    frappe.db.commit()
