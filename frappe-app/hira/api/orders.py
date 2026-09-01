"""Order placement for the storefront.

The original deployment booked orders through the `square_payment` app. That app
isn't part of this bench, so Cash on Delivery had nowhere to go. This creates a
real ERPNext Sales Order instead, which is what the admin panel and the
customer's order history both read.
"""

import json

import frappe
from frappe.utils import add_days, flt, nowdate


def _as_dict(value):
    if isinstance(value, str):
        return json.loads(value or "{}")
    return value or {}


def _as_list(value):
    if isinstance(value, str):
        return json.loads(value or "[]")
    return value or []


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


MAX_QTY_PER_LINE = 20


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


@frappe.whitelist()
def create_cod_order(
    customer=None,
    cart_items=None,
    coupon_code=None,
    discount=0,
    shipping=0,
    payment_method="Cash on Delivery",
    **kwargs,
):
    """Book a Sales Order for the signed-in shopper."""
    user = frappe.session.user
    if not user or user == "Guest":
        frappe.throw("Please sign in before placing an order.", frappe.PermissionError)

    info = _as_dict(customer)
    items = _as_list(cart_items)
    if not items:
        frappe.throw("Your cart is empty.")

    customer_name = _ensure_customer(info, user)
    company = frappe.defaults.get_defaults().get("company") or frappe.db.get_value("Company", {}, "name")
    if not company:
        frappe.throw("No company is configured on this site.")

    so = frappe.get_doc({
        "doctype": "Sales Order",
        "customer": customer_name,
        "company": company,
        "transaction_date": nowdate(),
        "delivery_date": add_days(nowdate(), 7),
        "order_type": "Sales",
        "contact_email": info.get("email") or user,
        "contact_mobile": info.get("phone") or "",
        "coupon_code": coupon_code or None,
        "items": _price_items(items),
    })

    # Clamp against the catalogue-priced subtotal so a large discount cannot
    # drive the total below zero, whatever the browser claimed.
    # so.items are SalesOrderItem docs, not dicts — attribute access only.
    line_total = sum(flt(l.qty) * flt(l.rate) for l in so.items)
    discount = max(0.0, min(flt(discount), line_total))
    if discount > 0:
        so.apply_discount_on = "Grand Total"
        so.discount_amount = discount

    shipping = flt(shipping)
    if shipping > 0:
        so.append("taxes", {
            "charge_type": "Actual",
            "description": "Shipping",
            "tax_amount": shipping,
            "account_head": frappe.db.get_value(
                "Account", {"company": company, "account_type": "Chargeable", "is_group": 0}, "name"
            ) or frappe.db.get_value(
                "Account", {"company": company, "root_type": "Expense", "is_group": 0}, "name"
            ),
        })

    # The shopper has no Sales Order permission; the storefront is the authority
    # on what they're allowed to buy, and it has already gated on login.
    so.flags.ignore_permissions = True
    so.insert(ignore_permissions=True)
    so.submit()

    frappe.db.commit()

    return {"order_id": so.name, "payment_id": payment_method.upper().replace(" ", "_")}


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
            ["name", "transaction_date", "grand_total", "status", "contact_email"],
            as_dict=True,
        )
        for n in names
    ]
