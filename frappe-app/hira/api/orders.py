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
        "items": [
            {
                "item_code": it.get("id") or it.get("item_code"),
                "qty": flt(it.get("qty") or 1),
                "rate": flt(it.get("price") or it.get("rate") or 0),
                "delivery_date": add_days(nowdate(), 7),
            }
            for it in items
        ],
    })

    discount = flt(discount)
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
