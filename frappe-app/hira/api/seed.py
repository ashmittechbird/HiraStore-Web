"""One-shot catalogue import.

Idempotent: re-running updates existing Items rather than erroring, so it is
safe to run again after regenerating the catalogue.
"""

import json
import os

import frappe

CUSTOM_FIELDS = [
    {"fieldname": "custom_material", "label": "Material", "fieldtype": "Data"},
    {"fieldname": "custom_short_description", "label": "Short Description", "fieldtype": "Small Text"},
    {"fieldname": "custom_is_featured", "label": "Is Featured", "fieldtype": "Check"},
    {"fieldname": "custom_item_images", "label": "Item Images (JSON)", "fieldtype": "Small Text"},
]


def ensure_custom_fields():
    for cf in CUSTOM_FIELDS:
        if frappe.db.exists("Custom Field", {"dt": "Item", "fieldname": cf["fieldname"]}):
            continue
        frappe.get_doc({
            "doctype": "Custom Field",
            "dt": "Item",
            "fieldname": cf["fieldname"],
            "label": cf["label"],
            "fieldtype": cf["fieldtype"],
            "insert_after": "item_group",
        }).insert(ignore_permissions=True)
    frappe.db.commit()


def ensure_item_group(name):
    if frappe.db.exists("Item Group", name):
        return
    frappe.get_doc({
        "doctype": "Item Group",
        "item_group_name": name,
        "parent_item_group": "All Item Groups",
        "is_group": 0,
    }).insert(ignore_permissions=True)


def seed_catalog(path=None):
    path = path or os.path.join(frappe.utils.get_bench_path(), "sites", "catalog.json")
    with open(path, encoding="utf-8") as fh:
        items = json.load(fh)

    ensure_custom_fields()

    for group in sorted({i["item_group"] for i in items}):
        ensure_item_group(group)
    frappe.db.commit()

    created = updated = 0
    for row in items:
        code = row["name"]
        values = {
            "item_name": row["item_name"][:140],
            "item_group": row["item_group"],
            "standard_rate": row["standard_rate"],
            "image": row["image"],
            "custom_material": row.get("custom_material", ""),
            "custom_short_description": row.get("custom_short_description", ""),
            "custom_is_featured": row.get("custom_is_featured", 0),
            "weight_per_unit": row.get("weight_per_unit", 0),
            "disabled": row.get("disabled", 0),
        }

        if frappe.db.exists("Item", code):
            doc = frappe.get_doc("Item", code)
            for k, v in values.items():
                setattr(doc, k, v)
            doc.save(ignore_permissions=True)
            updated += 1
        else:
            doc = frappe.get_doc({
                "doctype": "Item",
                "item_code": code,
                "stock_uom": "Nos",
                # Non-stock keeps the import free of warehouses and opening entries;
                # the storefront only needs price and presentation.
                "is_stock_item": 0,
                "is_sales_item": 1,
                "is_purchase_item": 0,
                "include_item_in_manufacturing": 0,
                "weight_uom": "Gram" if row.get("weight_per_unit") else None,
                **values,
            })
            doc.insert(ignore_permissions=True)
            created += 1

        if (created + updated) % 50 == 0:
            frappe.db.commit()

    frappe.db.commit()
    print(f"seeded: {created} created, {updated} updated, {len(items)} total")
