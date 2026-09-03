"""Coupon validation for the storefront.

Two reasons this can't go through frappe.client.get_list:

1. Guests can't read `Coupon Code`, so a logged-out shopper could never apply one.
2. ERPNext keeps the discount on the linked **Pricing Rule**, not on the Coupon
   Code itself. The storefront was reading `discount_percentage` straight off the
   coupon doc, where that field does not exist — so every coupon resolved to a
   0% discount even when it validated.

This resolves the rule, applies the date and minimum-spend checks server-side,
and returns the money amount the cart should subtract.
"""

import json

import frappe
from frappe.utils import flt, nowdate


@frappe.whitelist(allow_guest=True)
def validate_coupon(code=None, subtotal=0):
    code = (code or "").strip()
    if not code:
        frappe.throw("Enter a coupon code")

    # A negative subtotal would yield a negative discount, which reads as a
    # credit downstream. The cart total can never be below zero.
    subtotal = max(0.0, flt(subtotal))

    row = frappe.db.get_value(
        "Coupon Code",
        {"coupon_code": code},
        ["name", "coupon_code", "valid_from", "valid_upto", "pricing_rule", "maximum_use", "used"],
        as_dict=True,
    )
    if not row:
        frappe.throw("Invalid coupon code")

    today = nowdate()
    if row.valid_from and str(row.valid_from) > today:
        frappe.throw("This coupon isn't active yet")
    if row.valid_upto and str(row.valid_upto) < today:
        frappe.throw("This coupon code has expired")
    if row.maximum_use and flt(row.used) >= flt(row.maximum_use):
        frappe.throw("This coupon has already been fully redeemed")

    percentage = 0.0
    minimum = 0.0
    if row.pricing_rule:
        rule = frappe.db.get_value(
            "Pricing Rule", row.pricing_rule, ["discount_percentage", "min_amt"], as_dict=True
        )
        if rule:
            percentage = flt(rule.discount_percentage)
            minimum = flt(rule.min_amt)

    if minimum and subtotal < minimum:
        frappe.throw(f"Minimum order ${minimum:.0f} required for this code")

    discount = round(subtotal * percentage / 100.0, 2)

    return {
        "code": row.coupon_code,
        "discount_percentage": percentage,
        "minimum_amount": minimum,
        "discount": discount,
    }


@frappe.whitelist(allow_guest=True)
def list_public_coupons():
    """Active coupons, for the offers panel in the account area."""
    today = nowdate()
    rows = frappe.get_all(
        "Coupon Code",
        fields=["name", "coupon_code", "description", "valid_upto", "pricing_rule"],
        limit_page_length=20,
        ignore_permissions=True,
    )
    out = []
    for r in rows:
        if r.valid_upto and str(r.valid_upto) < today:
            continue
        pct = min_amt = 0
        if r.pricing_rule:
            rule = frappe.db.get_value(
                "Pricing Rule", r.pricing_rule, ["discount_percentage", "min_amt"], as_dict=True
            )
            if rule:
                pct = flt(rule.discount_percentage)
                min_amt = flt(rule.min_amt)
        out.append({
            # Both spellings: the storefront reads "code", while the admin
            # table and ERPNext itself use "coupon_code" / "name".
            "name": r.name,
            "coupon_code": r.coupon_code,
            "code": r.coupon_code,
            "description": r.description or "",
            "discount_percentage": pct,
            "minimum_amount": min_amt,
        })
    return out


SEED = [
    {"code": "HIRA30", "pct": 30, "min": 0, "desc": "30% off sitewide - summer edit"},
    {"code": "WELCOME10", "pct": 10, "min": 0, "desc": "10% off your first order"},
    {"code": "FESTIVE20", "pct": 20, "min": 100, "desc": "20% off orders over $100"},
]


def seed_coupons():
    """Create the coupons the storefront advertises, with their Pricing Rules."""
    company = frappe.db.get_value("Company", {}, "name")
    created = skipped = 0

    for s in SEED:
        if frappe.db.exists("Coupon Code", {"coupon_code": s["code"]}):
            skipped += 1
            continue

        rule = frappe.get_doc({
            "doctype": "Pricing Rule",
            "title": f"Coupon {s['code']}",
            "apply_on": "Transaction",
            "price_or_product_discount": "Price",
            "selling": 1,
            "coupon_code_based": 1,
            "rate_or_discount": "Discount Percentage",
            "discount_percentage": s["pct"],
            "min_amt": s["min"],
            "company": company,
            "currency": frappe.db.get_value("Company", company, "default_currency") or "USD",
            "valid_from": "2025-01-01",
            "valid_upto": "2030-12-31",
        })
        rule.flags.ignore_permissions = True
        rule.insert(ignore_permissions=True)

        coupon = frappe.get_doc({
            "doctype": "Coupon Code",
            "coupon_name": s["code"],
            "coupon_code": s["code"],
            "coupon_type": "Promotional",
            # ERPNext checks used >= maximum_use when a Sales Order carries the
            # code, and 0 >= 0 is true — a maximum of 0 blocks every redemption
            # rather than meaning unlimited. Give promotional codes headroom.
            "maximum_use": 100000,
            "pricing_rule": rule.name,
            "description": s["desc"],
            "valid_from": "2025-01-01",
            "valid_upto": "2030-12-31",
        })
        coupon.flags.ignore_permissions = True
        coupon.insert(ignore_permissions=True)
        created += 1

    frappe.db.commit()
    print(f"coupons: {created} created, {skipped} already present")
    for c in frappe.get_all("Coupon Code", fields=["coupon_code", "pricing_rule"]):
        print("  ", c.coupon_code, "->", c.pricing_rule)
