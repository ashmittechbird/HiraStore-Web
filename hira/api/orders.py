"""Order building for the storefront.

Nothing here is whitelisted, on purpose. An order is only ever created as the
result of a captured card payment, so the single entry point is
`hira.api.payments.create_card_order`. An order-creating endpoint that doesn't
take money hands anyone a way to book stock for free — which is exactly what the
old Cash on Delivery endpoint did.

Everything the browser sends is a request, not a fact. Line prices, the coupon
discount and the shipping charge are all recomputed here from the catalogue and
the Pricing Rules; the numbers in the request are used only to check the shopper
is charged the total they were shown.
"""

import json

import frappe
from frappe.utils import add_days, flt, nowdate

# Mirrors FREE_SHIPPING_OVER / SHIPPING_FLAT in src/lib/config.ts. Change one and
# change the other: checkout compares its total against this one and refuses the
# order when they disagree, so a drift here shows up as "your total changed"
# rather than as a wrong charge.
FREE_SHIPPING_OVER = 100.0
SHIPPING_FLAT = 5.0

MAX_QTY_PER_LINE = 20


def _as_dict(value):
    if isinstance(value, str):
        return json.loads(value or "{}")
    return value or {}


def _as_list(value):
    if isinstance(value, str):
        return json.loads(value or "[]")
    return value or []


def shipping_for(subtotal):
    """Flat rate below the free-shipping threshold, nothing above it."""
    return 0.0 if flt(subtotal) >= FREE_SHIPPING_OVER else SHIPPING_FLAT


def _ensure_customer(customer_info, user):
    """Find or create the ERPNext Customer for this shopper."""
    email = (customer_info.get("email") or user or "").strip().lower()
    name = (customer_info.get("fullName") or email or "Guest").strip()

    existing = frappe.db.get_value("Customer", {"customer_name": name}, "name")
    if existing:
        return existing

    if email:
        linked = frappe.db.get_value("Contact", {"email_id": email}, "name")
        if linked:
            party = frappe.db.get_value(
                "Dynamic Link",
                {"parent": linked, "link_doctype": "Customer"},
                "link_name",
            )
            if party:
                return party

    doc = frappe.get_doc({
        "doctype": "Customer",
        "customer_name": name,
        "customer_type": "Individual",
        "customer_group": frappe.db.get_value("Customer Group", {"is_group": 0}, "name") or "All Customer Groups",
        "territory": frappe.db.get_value("Territory", {"is_group": 0}, "name") or "All Territories",
    })
    doc.insert(ignore_permissions=True)

    if email:
        contact = frappe.get_doc({
            "doctype": "Contact",
            "first_name": name,
            "email_ids": [{"email_id": email, "is_primary": 1}],
            "links": [{"link_doctype": "Customer", "link_name": doc.name}],
        })
        contact.insert(ignore_permissions=True)

    return doc.name


def _price_items(items):
    """Build the order lines, pricing every one from the catalogue.

    The browser sends a price with each line because the cart renders from it,
    but that number must never reach the order — anyone can edit the request and
    buy a $600 necklace for $1. The rate is looked up from the Item record here,
    and the client's figure is ignored entirely.

    The same lookup rejects codes that don't exist or aren't for sale, so a
    hidden product (out of stock, or a photo still showing a price tag) can't be
    ordered by anyone who knows its code.
    """
    lines = []
    for it in items:
        code = (it.get("id") or it.get("item_code") or "").strip()
        if not code:
            frappe.throw("A cart line is missing its product code.")

        row = frappe.db.get_value(
            "Item", code, ["name", "standard_rate", "disabled", "is_sales_item"], as_dict=True
        )
        if not row:
            frappe.throw(f"{code} is no longer available.")
        if row.disabled or not row.is_sales_item:
            frappe.throw(f"{code} is not available to buy at the moment.")

        rate = flt(row.standard_rate)
        if rate <= 0:
            frappe.throw(f"{code} has no price set. Please contact us to order it.")

        qty = flt(it.get("qty") or 1)
        if qty <= 0:
            frappe.throw("Quantity must be at least 1.")
        if qty > MAX_QTY_PER_LINE:
            frappe.throw(f"Please order at most {int(MAX_QTY_PER_LINE)} of any single piece.")

        lines.append({
            "item_code": row.name,
            "qty": qty,
            "rate": rate,
            "delivery_date": add_days(nowdate(), 7),
        })

    if not lines:
        frappe.throw("Your cart is empty.")
    return lines


def _resolve_discount(coupon_code, subtotal):
    """Money off, resolved from the Pricing Rule rather than from the request.

    An invalid or expired code raises rather than resolving to zero: the shopper
    was shown a discounted total, and quietly charging them the full price
    instead is worse than making them re-check the cart.
    """
    if not coupon_code:
        return 0.0

    from hira.api.coupons import validate_coupon

    return flt(validate_coupon(code=coupon_code, subtotal=subtotal).get("discount"))


def quote(items, coupon_code=None):
    """Authoritative totals for a basket — what the shop will actually charge.

    Returns the priced lines alongside the money so the caller doesn't have to
    price the same cart twice.
    """
    lines = _price_items(items)
    subtotal = flt(sum(flt(l["qty"]) * flt(l["rate"]) for l in lines), 2)

    discount = min(_resolve_discount(coupon_code, subtotal), subtotal)
    shipping = shipping_for(subtotal)

    return {
        "lines": lines,
        "subtotal": subtotal,
        "discount": flt(discount, 2),
        "shipping": flt(shipping, 2),
        "total": flt(subtotal - discount + shipping, 2),
    }


def build_draft_order(customer_info, priced, coupon_code=None, user=None):
    """Insert an unsubmitted Sales Order for a basket already priced by `quote`.

    Deliberately left in draft. The caller charges the card first and submits
    only once the money is captured, so a declined card leaves no phantom order
    and a successful charge always has an order waiting to attach itself to.
    """
    user = user or frappe.session.user
    info = customer_info or {}

    company = frappe.defaults.get_defaults().get("company") or frappe.db.get_value("Company", {}, "name")
    if not company:
        frappe.throw("No company is configured on this site.")

    so = frappe.get_doc({
        "doctype": "Sales Order",
        "customer": _ensure_customer(info, user),
        "company": company,
        "transaction_date": nowdate(),
        "delivery_date": add_days(nowdate(), 7),
        "order_type": "Sales",
        "contact_email": info.get("email") or user,
        "contact_mobile": info.get("phone") or "",
        "coupon_code": coupon_code or None,
        "items": priced["lines"],
    })

    if priced["discount"] > 0:
        so.apply_discount_on = "Grand Total"
        so.discount_amount = priced["discount"]

    if priced["shipping"] > 0:
        so.append("taxes", {
            "charge_type": "Actual",
            "description": "Shipping",
            "tax_amount": priced["shipping"],
            "account_head": frappe.db.get_value(
                "Account", {"company": company, "account_type": "Chargeable", "is_group": 0}, "name"
            ) or frappe.db.get_value(
                "Account", {"company": company, "root_type": "Expense", "is_group": 0}, "name"
            ),
        })

    # The shopper has no Sales Order permission; the storefront is the authority
    # on what they may buy, and create_card_order has already gated on login.
    so.flags.ignore_permissions = True
    so.insert(ignore_permissions=True)
    return so


@frappe.whitelist()
def get_my_orders():
    """Order history for the signed-in shopper."""
    user = frappe.session.user
    if not user or user == "Guest":
        return []

    names = frappe.get_all(
        "Sales Order",
        filters={"contact_email": user},
        fields=["name"],
        order_by="creation desc",
        limit_page_length=50,
        ignore_permissions=True,
    )
    if not names:
        names = frappe.get_all(
            "Sales Order",
            filters={"owner": user},
            fields=["name"],
            order_by="creation desc",
            limit_page_length=50,
            ignore_permissions=True,
        )

    return [
        frappe.db.get_value(
            "Sales Order",
            n.name,
            [
                "name",
                "transaction_date",
                "grand_total",
                "status",
                "contact_email",
                "custom_payment_method",
                "custom_payment_reference",
                "custom_payment_receipt_url",
            ],
            as_dict=True,
        )
        for n in names
    ]
