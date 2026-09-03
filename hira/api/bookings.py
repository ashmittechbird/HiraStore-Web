"""Video call booking requests from the storefront.

The shopper asks for a call; the store confirms a time and calls back. Bookings
are real documents so they show up in the desk and the admin panel rather than
vanishing into an email inbox.

The DocType ships with the app, so a fresh bench gets it from bench migrate.

Notifying the customer
----------------------
Two channels, deliberately:

* **Email** — sent automatically on request and again on confirmation, but only
  if the bench has an outgoing Email Account. With none configured this no-ops
  and the API reports `notified: false`, so the UI never claims a message went
  out that didn't.
* **WhatsApp** — `whatsapp_message` builds a pre-filled wa.me link the staff
  member clicks. Sending WhatsApp automatically needs the Business API through a
  paid provider; a click-to-send link needs nothing and is what a small store
  actually does.
"""

import re
from urllib.parse import quote

import frappe
from frappe.utils import get_url, getdate, nowdate

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

STORE_NAME = "The Hira Store"

# WhatsApp needs a country code. Numbers typed without one are assumed to be
# from the store's own country; override per-site with:
#   bench --site <site> set-config default_country_code 91
DEFAULT_COUNTRY_CODE = "1"


def _msisdn(raw):
    """Normalise a phone number to the digits-with-country-code wa.me wants.

    A bare 10-digit number has no country code, and wa.me silently fails on
    those rather than erroring, so the store would think a message went out.
    """
    raw = str(raw or "").strip()
    digits = re.sub(r"\D", "", raw)
    if not digits:
        return ""

    # An explicit + means the country code is already there.
    if raw.startswith("+") or raw.startswith("00"):
        return digits.lstrip("0") if raw.startswith("00") else digits

    cc = str(frappe.conf.get("default_country_code") or DEFAULT_COUNTRY_CODE)

    # Local trunk prefix, e.g. 098765...
    if digits.startswith("0"):
        digits = digits.lstrip("0")

    # Already carries the country code.
    if digits.startswith(cc) and len(digits) > 10:
        return digits

    return cc + digits if len(digits) <= 10 else digits


def _clean_phone(raw):
    digits = re.sub(r"[^\d+]", "", str(raw or ""))
    if len(re.sub(r"\D", "", digits)) < 7:
        frappe.throw("Enter a valid phone number")
    return digits


def _when(doc):
    """Human-readable slot, or an honest 'we'll agree a time'."""
    if doc.get("preferred_date") and doc.get("preferred_time"):
        return f"{frappe.utils.formatdate(doc['preferred_date'], 'd MMMM yyyy')}, {doc['preferred_time']}"
    if doc.get("preferred_date"):
        return frappe.utils.formatdate(doc["preferred_date"], "d MMMM yyyy")
    return "a time that suits you"


def can_send_email():
    """True only when the bench has an outgoing account that can actually send.

    An account still waiting for its password counts as configured in Frappe but
    fails at SMTP time. Treating it as ready would report "notified" for mail
    that never left, which is the one thing this must not do.
    """
    return bool(frappe.db.exists("Email Account", {
        "enable_outgoing": 1,
        "default_outgoing": 1,
        "awaiting_password": 0,
    }))


def _email_customer(doc, kind):
    """Send the request/confirmation email. Returns True only if it was queued."""
    if not doc.get("email") or not can_send_email():
        return False

    first = (doc.get("customer_name") or "there").split(" ")[0]
    when = _when(doc)

    if kind == "confirmed":
        subject = f"Your video call with {STORE_NAME} is confirmed"
        body = f"""<p>Hi {frappe.utils.escape_html(first)},</p>
<p>Your video call is <strong>confirmed</strong> for <strong>{when}</strong>.</p>
<p>One of our jewellery consultants will call you on
<strong>{frappe.utils.escape_html(doc.get('phone') or '')}</strong> at that time. Have a think about
what you'd like to see and we'll bring the pieces to the camera.</p>
<p>Reference: <strong>{doc['name']}</strong></p>
<p>If the time no longer works, just reply to this email.</p>
<p>— {STORE_NAME}</p>"""
    else:
        subject = f"We've got your video call request — {STORE_NAME}"
        body = f"""<p>Hi {frappe.utils.escape_html(first)},</p>
<p>Thank you for asking for a video call. We have your request for <strong>{when}</strong>
and a consultant will contact you shortly to confirm.</p>
<p>Reference: <strong>{doc['name']}</strong></p>
<p>— {STORE_NAME}</p>"""

    try:
        frappe.sendmail(
            recipients=[doc["email"]],
            subject=subject,
            message=body,
            reference_doctype=DOCTYPE,
            reference_name=doc["name"],
            now=False,
        )
        return True
    except Exception:
        frappe.log_error(frappe.get_traceback(), "Video call booking email failed")
        return False


@frappe.whitelist(allow_guest=True)
def get_slots():
    """Time slots the storefront offers. Kept server-side so they're editable."""
    return {"slots": TIME_SLOTS}


@frappe.whitelist(allow_guest=True)
def create_booking(customer_name=None, phone=None, email=None,
                   preferred_date=None, preferred_time=None, notes=None):
    """Log a call request. Open to guests — this is how someone gets in touch."""

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

    notified = _email_customer(doc.as_dict(), "requested")

    return {
        "booking_id": doc.name,
        "status": doc.status,
        # The UI must not promise an email that no backend could send.
        "notified": notified,
        "email_configured": can_send_email(),
    }


@frappe.whitelist()
def list_bookings(limit=100):
    """Bookings for the admin panel. Staff only."""
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
    """Move a booking along, emailing the customer when it's confirmed."""
    if status not in STATUSES:
        frappe.throw(f"Status must be one of: {', '.join(STATUSES)}")

    frappe.db.set_value(DOCTYPE, name, "status", status)
    frappe.db.commit()

    notified = False
    if status == "Confirmed":
        doc = frappe.db.get_value(
            DOCTYPE, name,
            ["name", "customer_name", "phone", "email", "preferred_date", "preferred_time"],
            as_dict=True,
        )
        if doc:
            notified = _email_customer(doc, "confirmed")

    return {
        "name": name,
        "status": status,
        "notified": notified,
        "email_configured": can_send_email(),
    }


@frappe.whitelist()
def whatsapp_message(name=None, kind="confirmed"):
    """A pre-filled wa.me link so staff can confirm on WhatsApp in one click.

    Automatic WhatsApp needs the Business API and a paid provider; this needs
    nothing and reaches the customer on the channel they already use.
    """
    doc = frappe.db.get_value(
        DOCTYPE, name,
        ["name", "customer_name", "phone", "preferred_date", "preferred_time"],
        as_dict=True,
    )
    if not doc:
        frappe.throw("Booking not found")

    digits = _msisdn(doc.get("phone"))
    if not digits:
        frappe.throw("This booking has no usable phone number")

    first = (doc.get("customer_name") or "there").split(" ")[0]
    when = _when(doc)

    if kind == "confirmed":
        text = (
            f"Hi {first}, this is {STORE_NAME}. Your video call is confirmed for {when}. "
            f"We'll call you on WhatsApp at that time. Reference {doc['name']}."
        )
    else:
        text = (
            f"Hi {first}, this is {STORE_NAME}. Thank you for your video call request "
            f"({doc['name']}). Does {when} still suit you?"
        )

    return {
        "phone": digits,
        "text": text,
        "url": f"https://wa.me/{digits}?text={quote(text)}",
    }
