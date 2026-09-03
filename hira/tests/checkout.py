"""Checkout self-test — run it on the server after deploying.

    bench --site your-site.local execute hira.tests.checkout.run

Square's own call is the one thing stubbed out; a real charge needs real
credentials and would move real money. Everything around it is exercised for
real, against this site's actual catalogue: pricing, coupons, shipping, the
draft-then-charge-then-submit ordering, the custom fields, idempotency, and the
cleanup when a card is declined.

That boundary is deliberate. The interesting failures in a checkout are almost
never in the HTTP call to the gateway — they are in what the shop believes it is
owed, and in what it does when the charge doesn't go the happy way.

A real checkout commits as it goes — that is the point of saving the draft
before charging — so this cannot simply roll back at the end. It tracks every
order, payment log and customer it creates and deletes them explicitly, leaving
the site as it found it.
"""

import json
import uuid

import frappe
from frappe.utils import flt

from hira.api import payments
from hira.api.orders import FREE_SHIPPING_OVER, SHIPPING_FLAT

TEST_EMAIL = "checkout-selftest@thehirastore.test"

passed, failed = [], []


def ok(name, detail=""):
    passed.append(name)
    print(f"  PASS  {name}" + (f" — {detail}" if detail else ""))


def bad(name, detail=""):
    failed.append(f"{name}: {detail}")
    print(f"  FAIL  {name}" + (f" — {detail}" if detail else ""))


def section(title):
    print(f"\n── {title} " + "─" * max(0, 56 - len(title)))


class FakeGateway:
    """Stands in for square_payment.api, recording what it was asked to charge."""

    def __init__(self, decline=False):
        self.decline = decline
        self.charges = []
        self.refunds = []

    def is_configured(self):
        return True

    def charge(self, amount_cents, source_id, idempotency_key=None, **kw):
        self.charges.append({"amount_cents": amount_cents, "key": idempotency_key, **kw})
        if self.decline:
            frappe.throw("Your card was declined. Please try a different card.")

        # Unique per charge, like a real one. Deriving it from a counter that
        # the tests reset made two charges share an id, and checkout's
        # duplicate-payment guard then correctly matched an unrelated order.
        payment_id = "TEST_PAY_" + uuid.uuid4().hex[:12].upper()

        # The real gateway writes a Square Payment Log here, and checkout's
        # double-click guard reads it. A stub that skips it would make that
        # guard look broken when it isn't.
        log = frappe.get_doc({
            "doctype": "Square Payment Log",
            "status": "Completed",
            "payment_id": payment_id,
            "amount": flt(amount_cents) / 100.0,
            "currency": "USD",
            "environment": "selftest",
            "idempotency_key": idempotency_key,
            "reference_doctype": kw.get("reference_doctype"),
            "reference_name": kw.get("reference_name"),
        })
        log.flags.ignore_permissions = True
        log.insert(ignore_permissions=True)
        frappe.db.commit()

        return {
            "payment_id": payment_id,
            "status": "COMPLETED",
            "receipt_url": "https://example.invalid/receipt",
            "card_brand": "VISA",
            "card_last4": "1111",
            "amount": flt(amount_cents) / 100.0,
            "currency": "USD",
        }

    def refund(self, payment_id, amount_cents, **kw):
        self.refunds.append(payment_id)
        return f"TEST_REFUND_{payment_id}"

    def install(self):
        """Patch the names payments.create_card_order imports at call time."""
        import square_payment.api as real

        self._saved = (real.charge, real.refund, real.is_configured)
        real.charge, real.refund, real.is_configured = self.charge, self.refund, self.is_configured

    def restore(self):
        import square_payment.api as real

        real.charge, real.refund, real.is_configured = self._saved


def _two_items():
    """A cheap item and a dear one, so shipping is exercised both ways."""
    rows = frappe.get_all(
        "Item",
        filters={"disabled": 0, "is_sales_item": 1, "standard_rate": [">", 0]},
        fields=["name", "standard_rate"],
        order_by="standard_rate asc",
        limit_page_length=400,
    )
    if len(rows) < 2:
        frappe.throw("Not enough priced items to test with — seed the catalogue first.")

    cheap = next((r for r in rows if flt(r.standard_rate) < FREE_SHIPPING_OVER), rows[0])
    dear = next((r for r in reversed(rows) if flt(r.standard_rate) >= FREE_SHIPPING_OVER), rows[-1])
    return cheap, dear


def _cart(item, qty=1, claimed_price=None):
    return json.dumps([{"id": item.name, "qty": qty, "price": claimed_price if claimed_price is not None else item.standard_rate}])


def _customer():
    return json.dumps({"fullName": "Checkout Selftest", "email": TEST_EMAIL, "phone": "9999999999"})


def _place(gateway, cart, **kw):
    result = payments.create_card_order(customer=_customer(), cart_items=cart, source_id="cnon:test", **kw)
    created_orders.add(result["order_id"])
    return result


created_orders = set()


def _cleanup():
    """Undo everything the run committed. Reports what it couldn't remove."""
    frappe.db.rollback()
    stranded = []

    for name in sorted(created_orders):
        try:
            if not frappe.db.exists("Sales Order", name):
                continue
            so = frappe.get_doc("Sales Order", name)
            if so.docstatus == 1:
                so.flags.ignore_permissions = True
                so.cancel()
            frappe.delete_doc("Sales Order", name, ignore_permissions=True, force=True, delete_permanently=True)
        except Exception:
            stranded.append(name)

    for log in frappe.get_all("Square Payment Log", filters={"environment": "selftest"}, pluck="name"):
        try:
            frappe.delete_doc("Square Payment Log", log, ignore_permissions=True, force=True, delete_permanently=True)
        except Exception:
            stranded.append(log)

    for doctype, filters in (("Contact", {"email_id": TEST_EMAIL}), ("Customer", {"customer_name": "Checkout Selftest"})):
        for name in frappe.get_all(doctype, filters=filters, pluck="name"):
            try:
                frappe.delete_doc(doctype, name, ignore_permissions=True, force=True, delete_permanently=True)
            except Exception:
                stranded.append(f"{doctype} {name}")

    frappe.db.commit()

    if stranded:
        print(f"\n  NOTE  could not remove: {', '.join(stranded)} — delete these by hand")
    else:
        print("\n  cleaned up: no test orders, payments or customers left behind")


def run():
    print("\nHira checkout self-test\n" + "=" * 62)
    frappe.set_user("Administrator")
    cheap, dear = _two_items()
    print(f"  using {cheap.name} at ${flt(cheap.standard_rate):.2f} and {dear.name} at ${flt(dear.standard_rate):.2f}")

    gw = FakeGateway()
    gw.install()
    try:
        _happy_path(gw, cheap, dear)
        _price_tampering(gw, dear)
        _coupon(gw, dear)
        _total_drift(gw, dear)
        _idempotency(gw, cheap)
        _decline_leaves_nothing(cheap)
        _guest_is_refused(cheap)
        _no_gateway_is_refused(cheap)
    finally:
        gw.restore()
        frappe.set_user("Administrator")
        _cleanup()

    print("=" * 62)
    print(f"  {len(passed)} passed, {len(failed)} failed\n")
    if failed:
        frappe.throw("Checkout self-test failed: " + "; ".join(failed))
    return {"passed": len(passed), "failed": 0}


# ─── the tests ───────────────────────────────────────────────────────────────


def _happy_path(gw, cheap, dear):
    section("A card payment books an order")

    gw.charges.clear()
    result = _place(gw, _cart(dear))
    so = frappe.get_doc("Sales Order", result["order_id"])

    if so.docstatus == 1:
        ok("the order is submitted", so.name)
    else:
        bad("the order is submitted", f"docstatus {so.docstatus}")

    charged = flt(gw.charges[-1]["amount_cents"]) / 100.0
    if abs(charged - flt(so.grand_total)) < 0.01:
        ok("the card is charged the order total", f"${charged:.2f}")
    else:
        bad("the card is charged the order total", f"charged ${charged:.2f}, order ${flt(so.grand_total):.2f}")

    if so.custom_payment_reference and so.custom_payment_method == "Square (Card)":
        ok("the payment is recorded on the order", f"{so.custom_payment_method} {so.custom_payment_reference}")
    else:
        bad("the payment is recorded on the order", "custom_payment_* not set")

    if so.custom_payment_card == "VISA ****1111":
        ok("the card is identifiable for support", so.custom_payment_card)
    else:
        bad("the card is identifiable for support", str(so.custom_payment_card))

    if gw.charges[-1].get("reference_name") == so.name:
        ok("Square gets the order id as its reference", so.name)
    else:
        bad("Square gets the order id as its reference", str(gw.charges[-1].get("reference_name")))

    # Free over the threshold, flat below it — and the customer is charged it.
    section("Shipping is priced by the server, not the browser")
    gw.charges.clear()
    r_cheap = _place(gw, _cart(cheap))
    so_cheap = frappe.get_doc("Sales Order", r_cheap["order_id"])
    expected = flt(cheap.standard_rate) + SHIPPING_FLAT
    if abs(flt(so_cheap.grand_total) - expected) < 0.01:
        ok(f"under ${FREE_SHIPPING_OVER:.0f} pays ${SHIPPING_FLAT:.0f} shipping", f"${flt(so_cheap.grand_total):.2f}")
    else:
        bad(f"under ${FREE_SHIPPING_OVER:.0f} pays ${SHIPPING_FLAT:.0f} shipping",
            f"expected ${expected:.2f}, got ${flt(so_cheap.grand_total):.2f}")

    if abs(flt(so.grand_total) - flt(dear.standard_rate)) < 0.01:
        ok(f"over ${FREE_SHIPPING_OVER:.0f} ships free", f"${flt(so.grand_total):.2f}")
    else:
        bad(f"over ${FREE_SHIPPING_OVER:.0f} ships free",
            f"expected ${flt(dear.standard_rate):.2f}, got ${flt(so.grand_total):.2f}")


def _price_tampering(gw, dear):
    section("A tampered price is ignored")

    gw.charges.clear()
    # The browser claims this costs a dollar.
    result = _place(gw, _cart(dear, claimed_price=1.00))
    so = frappe.get_doc("Sales Order", result["order_id"])
    charged = flt(gw.charges[-1]["amount_cents"]) / 100.0

    if abs(flt(so.items[0].rate) - flt(dear.standard_rate)) < 0.01:
        ok("the order is priced from the catalogue", f"${flt(so.items[0].rate):.2f} not $1.00")
    else:
        bad("the order is priced from the catalogue", f"booked at ${flt(so.items[0].rate):.2f}")

    if charged > 1.5:
        ok("the card is charged the real price", f"${charged:.2f} not $1.00")
    else:
        bad("the card is charged the real price", f"charged ${charged:.2f}")


def _coupon(gw, dear):
    section("Coupons")

    code = frappe.db.get_value("Coupon Code", {"coupon_code": "HIRA30"}, "coupon_code")
    if not code:
        bad("HIRA30 exists", "not found")
        return

    gw.charges.clear()
    result = _place(gw, _cart(dear), coupon_code="HIRA30")
    so = frappe.get_doc("Sales Order", result["order_id"])
    charged = flt(gw.charges[-1]["amount_cents"]) / 100.0

    expected = round(flt(dear.standard_rate) * 0.70, 2)
    if abs(flt(so.grand_total) - expected) < 0.02:
        ok("30% comes off the order", f"${flt(dear.standard_rate):.2f} -> ${flt(so.grand_total):.2f}")
    else:
        bad("30% comes off the order", f"expected ${expected:.2f}, got ${flt(so.grand_total):.2f}")

    if abs(charged - flt(so.grand_total)) < 0.01:
        ok("the discounted total is what gets charged", f"${charged:.2f}")
    else:
        bad("the discounted total is what gets charged", f"charged ${charged:.2f} vs order ${flt(so.grand_total):.2f}")

    # A discount the browser invented must not reach the card.
    gw.charges.clear()
    try:
        _place(gw, _cart(dear), coupon_code="NOT-A-REAL-CODE")
        bad("an invented coupon is refused", "the order went through")
    except frappe.ValidationError:
        ok("an invented coupon is refused")


def _total_drift(gw, dear):
    section("The shopper is never charged a total they weren't shown")

    gw.charges.clear()
    try:
        _place(gw, _cart(dear), expected_total=1.00)
        bad("a stale basket total blocks the charge", "the order went through")
    except frappe.ValidationError:
        ok("a stale basket total blocks the charge")

    if not gw.charges:
        ok("no card is touched when the total disagrees")
    else:
        bad("no card is touched when the total disagrees", f"{len(gw.charges)} charge(s) attempted")


def _idempotency(gw, cheap):
    section("A double-clicked Pay button")

    gw.charges.clear()
    key = str(uuid.uuid4())
    first = _place(gw, _cart(cheap), idempotency_key=key)
    second = _place(gw, _cart(cheap), idempotency_key=key)

    if first["order_id"] == second["order_id"]:
        ok("the second press returns the first order", first["order_id"])
    else:
        bad("the second press returns the first order", f"{first['order_id']} then {second['order_id']}")

    if len(gw.charges) == 1:
        ok("the card is charged once")
    else:
        bad("the card is charged once", f"{len(gw.charges)} charges")


def _decline_leaves_nothing(cheap):
    section("A declined card")

    declining = FakeGateway(decline=True)
    declining.install()
    try:
        before = frappe.db.count("Sales Order")
        try:
            _place(declining, _cart(cheap))
            bad("a declined card places no order", "the order went through")
        except frappe.ValidationError as exc:
            if "declined" in str(exc).lower():
                ok("the shopper is told why", str(exc)[:60])
            else:
                bad("the shopper is told why", str(exc)[:80])

        after = frappe.db.count("Sales Order")
        if after == before:
            ok("no draft order is left behind", f"{after} orders, unchanged")
        else:
            bad("no draft order is left behind", f"{before} -> {after}")
    finally:
        declining.restore()


def _guest_is_refused(cheap):
    section("Permission")

    frappe.set_user("Guest")
    try:
        payments.create_card_order(customer=_customer(), cart_items=_cart(cheap), source_id="cnon:test")
        bad("a signed-out visitor cannot order", "the order went through")
    except frappe.PermissionError:
        ok("a signed-out visitor cannot order")
    except Exception as exc:
        bad("a signed-out visitor cannot order", f"{type(exc).__name__}: {exc}")
    finally:
        frappe.set_user("Administrator")


def _no_gateway_is_refused(cheap):
    section("An unconfigured gateway")

    import square_payment.api as real

    saved = real.is_configured
    real.is_configured = lambda: False
    try:
        payments.create_card_order(customer=_customer(), cart_items=_cart(cheap), source_id="cnon:test")
        bad("checkout stops when no gateway is set up", "the order went through")
    except frappe.ValidationError:
        ok("checkout stops when no gateway is set up")
    finally:
        real.is_configured = saved
