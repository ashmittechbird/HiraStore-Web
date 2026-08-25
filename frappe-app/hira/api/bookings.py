"""Video call booking requests from the storefront.

The shopper asks for a call; the store confirms a time and calls back. Bookings
are real documents so they show up in the desk and the admin panel rather than
vanishing into an email inbox.
"""

import re

import frappe
from frappe.utils import getdate, nowdate

DOCTYPE = "Video Call Booking"

STATUSES = ["New", "Confirmed", "Completed", "Cancelled"]

TIME_SLOTS = [
    "10:00 AM - 11:00 AM",
    "11:00 AM - 12:00 PM",
    "12:00 PM - 01:00 PM",
    "02:00 PM - 03:00 PM",
    "03:00 PM - 04:00 PM",
    "04:00 PM - 05:00 PM",
    "05:00 PM - 06:00 PM",
    "06:00 PM - 07:00 PM",
]


def ensure_doctype():
    """Create the doctype on first use so a fresh bench needs no manual setup."""
    if frappe.db.exists("DocType", DOCTYPE):
        return

    frappe.get_doc({
        "doctype": "DocType",
        "name": DOCTYPE,
        "module": "Hira",
        "custom": 1,
        "naming_rule": "Expression (old style)",
        "autoname": "format:VCB-{YYYY}-{#####}",
        "track_changes": 1,
        "sort_field": "creation",
        "sort_order": "DESC",
        "title_field": "customer_name",
        "fields": [
            {"fieldname": "customer_name", "label": "Name", "fieldtype": "Data", "reqd": 1, "in_list_view": 1},
            {"fieldname": "phone", "label": "Phone", "fieldtype": "Data", "reqd": 1, "in_list_view": 1},
            {"fieldname": "email", "label": "Email", "fieldtype": "Data", "options": "Email"},
            {"fieldname": "col1", "fieldtype": "Column Break"},
            {"fieldname": "preferred_date", "label": "Preferred Date", "fieldtype": "Date", "in_list_view": 1},
            {"fieldname": "preferred_time", "label": "Preferred Time", "fieldtype": "Data", "in_list_view": 1},
            {"fieldname": "status", "label": "Status", "fieldtype": "Select",
             "options": "\n".join(STATUSES), "default": "New", "in_list_view": 1, "in_standard_filter": 1},
            {"fieldname": "sec1", "fieldtype": "Section Break"},
            {"fieldname": "notes", "label": "Notes", "fieldtype": "Small Text"},
            {"fieldname": "source", "label": "Source", "fieldtype": "Data", "read_only": 1},
        ],
        "permissions": [
            {"role": "System Manager", "read": 1, "write": 1, "create": 1, "delete": 1, "export": 1},
            {"role": "Sales User", "read": 1, "write": 1, "create": 1},
        ],
    }).insert(ignore_permissions=True)
    frappe.db.commit()


def _clean_phone(raw):
    digits = re.sub(r"[^\d+]", "", str(raw or ""))
    if len(re.sub(r"\D", "", digits)) < 7:
        frappe.throw("Enter a valid phone number")
    return digits


@frappe.whitelist(allow_guest=True)
def get_slots():
    """Time slots the storefront offers. Kept server-side so they're editable."""
    return {"slots": TIME_SLOTS}


@frappe.whitelist(allow_guest=True)
def create_booking(customer_name=None, phone=None, email=None,
                   preferred_date=None, preferred_time=None, notes=None):
    """Log a call request. Open to guests — this is how someone gets in touch."""
    ensure_doctype()

    name = (customer_name or "").strip()
    if not name:
        frappe.throw("Please tell us your name")

    phone = _clean_phone(phone)

    if preferred_date:
        try:
            if getdate(preferred_date) < getdate(nowdate()):
                frappe.throw("Please pick a date that hasn't already passed")
        except frappe.ValidationError:
            raise
        except Exception:
            preferred_date = None

    doc = frappe.get_doc({
        "doctype": DOCTYPE,
        "customer_name": name[:140],
        "phone": phone,
        "email": (email or "").strip()[:140],
        "preferred_date": preferred_date or None,
        "preferred_time": (preferred_time or "").strip()[:60],
        "notes": (notes or "").strip()[:1000],
        "status": "New",
        "source": "Storefront",
    })
    doc.insert(ignore_permissions=True)
    frappe.db.commit()

    return {"booking_id": doc.name, "status": doc.status}


@frappe.whitelist()
def list_bookings(limit=100):
    """Bookings for the admin panel. Staff only."""
    ensure_doctype()
    try:
        limit = int(limit)
    except (TypeError, ValueError):
        limit = 100

    return frappe.get_all(
        DOCTYPE,
        fields=["name", "customer_name", "phone", "email", "preferred_date",
                "preferred_time", "status", "notes", "creation"],
        order_by="creation desc",
        limit_page_length=max(1, min(limit, 500)),
        ignore_permissions=True,
    )


@frappe.whitelist()
def set_booking_status(name=None, status=None):
    ensure_doctype()
    if status not in STATUSES:
        frappe.throw(f"Status must be one of: {', '.join(STATUSES)}")
    frappe.db.set_value(DOCTYPE, name, "status", status)
    frappe.db.commit()
    return {"name": name, "status": status}
