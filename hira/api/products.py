"""Public product feed for the storefront.

Guests can't read the Item doctype directly, and opening it up would expose
costing fields (valuation_rate, last_purchase_rate) to anyone. This returns
only the fields the storefront renders.
"""

import frappe

PUBLIC_FIELDS = [
    "name",
    "item_name",
    "item_group",
    "standard_rate",
    "image",
    "custom_item_images",
    "custom_material",
    "custom_short_description",
    "custom_is_featured",
    "weight_per_unit",
    "disabled",
]


@frappe.whitelist(allow_guest=True)
def get_public_items(limit=200):
    """Sellable, non-disabled items, newest first."""
    try:
        limit = int(limit)
    except (TypeError, ValueError):
        limit = 200
    limit = max(1, min(limit, 1000))

    return frappe.get_all(
        "Item",
        fields=PUBLIC_FIELDS,
        filters={"disabled": 0, "is_sales_item": 1},
        order_by="modified desc",
        limit_page_length=limit,
        ignore_permissions=True,
    )


@frappe.whitelist(allow_guest=True)
def get_public_item(name):
    """A single item, same field whitelist."""
    if not frappe.db.exists("Item", name):
        frappe.throw("Product not found", frappe.DoesNotExistError)

    doc = frappe.db.get_value("Item", name, PUBLIC_FIELDS, as_dict=True)
    if not doc or doc.get("disabled"):
        frappe.throw("Product not found", frappe.DoesNotExistError)
    return doc
