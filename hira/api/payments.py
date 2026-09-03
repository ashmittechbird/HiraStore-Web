"""Checkout: the only way an order gets created.

The storefront takes card payments and nothing else, so this module is the whole
of checkout. It owns the sequence that keeps money and orders in step:

    price the basket here  ->  save a draft order  ->  charge the card
                           ->  submit the order

Each step exists because of the way the alternatives fail:

* Pricing is redone from the Item records and Pricing Rules. The browser's
  numbers are read only to check the shopper is charged the total they were
  shown; a request that claims a $600 necklace costs $1 is refused, not obeyed.
* The order is saved as a draft **before** the charge, and committed, so a
  successful payment always has somewhere to land. Charging first and saving
  afterwards means any save failure leaves a customer who has paid for an order
  that does not exist.
* The order is submitted **after** the charge. A declined card therefore leaves
  a draft, never a confirmed order.
* If submitting fails despite a captured payment, the charge is refunded
  automatically. Nobody is left paying for nothing.

Talking to Square is `square_payment`'s job, not this module's. Everything here
is about what the customer owes.
"""

import frappe
from frappe.utils import flt

from hira.api.orders import _as_dict, _as_list, build_draft_order, quote

# The customer is shown a total before they press Pay. If our own arithmetic
# disagrees by more than a cent, something has changed underneath them — a price
# edit, an expired coupon — and charging either figure is wrong.
TOTAL_TOLERANCE = 0.01


@frappe.whitelist(allow_guest=True)
def get_payment_config():
    """What the checkout page needs to know before it renders.

    Guest-readable: the page is reachable before sign-in, and the Square
    identifiers it returns are public by design. The access token is not part of
    this and never leaves the server.

    Fronting `square_payment` behind this method keeps the storefront unaware of
    which gateway is installed — swapping providers is then a change here rather
    than a change in the browser.
    """
    try:
        from square_payment.api import get_config
    except ImportError:
        return {"available": False, "reason": "gateway_not_installed"}

    config = get_config()
    if not config:
        return {"available": False, "reason": "gateway_not_configured"}

    return {
        "available": True,
        "provider": "square",
        "app_id": config["app_id"],
        "location_id": config["location_id"],
        "environment": config["environment"],
        "currency": config["currency"],
    }


def _existing_order_for(idempotency_key):
    """The order a previous run of this same attempt already produced.

    A double-clicked Pay button, or a browser retrying a request whose response
    was lost, arrives here twice with one key. Square would return the original
    payment rather than charging again; this makes sure we return the original
    order rather than booking a second one.
    """
    if not idempotency_key:
        return None

    log = frappe.db.get_value(
        "Square Payment Log",
        {"idempotency_key": idempotency_key, "status": "Completed"},
        ["payment_id", "reference_name", "receipt_url"],
        as_dict=True,
    )
    if not log or not log.reference_name:
        return None
    if not frappe.db.exists("Sales Order", log.reference_name):
        return None

    return {
        "order_id": log.reference_name,
        "payment_id": log.payment_id,
        "receipt_url": log.receipt_url,
        "payment_method": "Square (Card)",
        "repeat": True,
    }


@frappe.whitelist()
def create_card_order(
    customer=None,
    cart_items=None,
    coupon_code=None,
    source_id=None,
    idempotency_key=None,
    expected_total=None,
    **kwargs,
):
    """Charge the card and book the order. The storefront's only order entry point."""
    user = frappe.session.user
    if not user or user == "Guest":
        frappe.throw("Please sign in before placing an order.", frappe.PermissionError)

    already = _existing_order_for(idempotency_key)
    if already:
        return already

    try:
        from square_payment.api import charge, is_configured, refund
    except ImportError:
        frappe.throw(
            "Card payments aren't set up on this site yet. "
            "Please contact us and we'll take your order directly."
        )

    if not is_configured():
        frappe.throw(
            "Card payments aren't available right now. "
            "Please contact us and we'll take your order directly."
        )

    info = _as_dict(customer)
    items = _as_list(cart_items)
    if not items:
        frappe.throw("Your cart is empty.")

    # ── what the customer actually owes ──────────────────────────────────────
    priced = quote(items, coupon_code)

    if expected_total is not None and abs(flt(expected_total) - priced["total"]) > TOTAL_TOLERANCE:
        frappe.throw(
            f"Your basket total has changed to ${priced['total']:.2f}. "
            "Please go back to your cart and check it before paying."
        )

    if priced["total"] <= 0:
        frappe.throw("An order must come to more than zero.")

    # ── draft order first, so a captured payment always has a home ───────────
    so = build_draft_order(info, priced, coupon_code=coupon_code, user=user)

    # ERPNext recomputes the total from the lines, taxes and discount. If its
    # figure disagrees with ours, charge neither — a silent mismatch here would
    # bill the customer one amount and record another.
    booked = flt(so.grand_total, 2)
    if abs(booked - priced["total"]) > TOTAL_TOLERANCE:
        frappe.db.rollback()
        frappe.log_error(
            title="Checkout total mismatch",
            message=(
                f"quote={priced['total']} grand_total={booked}\n"
                f"subtotal={priced['subtotal']} discount={priced['discount']} "
                f"shipping={priced['shipping']} coupon={coupon_code}"
            ),
        )
        frappe.throw("We couldn't work out your total. Please contact us and we'll take your order directly.")

    frappe.db.commit()

    # ── charge ───────────────────────────────────────────────────────────────
    try:
        payment = charge(
            amount_cents=int(round(booked * 100)),
            source_id=source_id,
            idempotency_key=idempotency_key,
            reference_doctype="Sales Order",
            reference_name=so.name,
            buyer_email=info.get("email") or user,
            note=f"The Hira Store order {so.name}",
        )
    except Exception:
        # Nothing was captured. Clear the draft so it doesn't read as a real
        # order, then let the shopper see why their card was refused.
        _discard_draft(so.name)
        raise

    # Two requests that arrive together both clear the guard above, and Square
    # answers the second from its own idempotency cache — same payment, no
    # second charge. Without this the shop would book two orders against it.
    twin = frappe.db.get_value(
        "Sales Order",
        {"custom_payment_reference": payment["payment_id"], "docstatus": 1, "name": ["!=", so.name]},
        "name",
    )
    if twin:
        _discard_draft(so.name)
        return {
            "order_id": twin,
            "payment_id": payment["payment_id"],
            "receipt_url": payment.get("receipt_url"),
            "payment_method": "Square (Card)",
            "repeat": True,
        }

    # ── confirm ──────────────────────────────────────────────────────────────
    try:
        so.reload()
        so.custom_payment_method = "Square (Card)"
        so.custom_payment_reference = payment["payment_id"]
        so.custom_payment_status = payment["status"]
        so.custom_payment_receipt_url = payment.get("receipt_url")
        if payment.get("card_last4"):
            so.custom_payment_card = f"{payment.get('card_brand') or 'Card'} ****{payment['card_last4']}"
        so.flags.ignore_permissions = True
        so.save(ignore_permissions=True)
        so.submit()
        frappe.db.commit()
    except Exception:
        # The money is already ours and the order cannot be confirmed. Give it
        # back rather than keeping a payment with nothing behind it.
        frappe.db.rollback()
        frappe.log_error(
            title=f"Order {so.name} could not be confirmed after payment {payment['payment_id']}",
            message=frappe.get_traceback(),
        )
        refunded = refund(
            payment["payment_id"],
            amount_cents=int(round(booked * 100)),
            currency=payment.get("currency"),
            reason=f"Order {so.name} could not be confirmed",
        )
        _discard_draft(so.name)
        frappe.throw(
            "Your card was charged but we couldn't confirm the order, so the payment has been "
            + ("refunded automatically. " if refunded else "flagged for an immediate refund. ")
            + f"Nothing has been shipped. Please contact us quoting {payment['payment_id']}."
        )

    return {
        "order_id": so.name,
        "payment_id": payment["payment_id"],
        "receipt_url": payment.get("receipt_url"),
        "payment_method": "Square (Card)",
        "card": payment.get("card_last4"),
        "total": booked,
    }


def _discard_draft(name):
    """Remove an unpaid draft order, without masking the failure that caused it."""
    try:
        frappe.db.rollback()
        if frappe.db.exists("Sales Order", name):
            frappe.delete_doc("Sales Order", name, ignore_permissions=True, force=True, delete_permanently=True)
            frappe.db.commit()
    except Exception:
        # A stranded draft is untidy, not harmful — it was never submitted and
        # no money is attached to it. Never let cleanup replace the real error.
        frappe.log_error(title=f"Could not discard draft order {name}", message=frappe.get_traceback())
