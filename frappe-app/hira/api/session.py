"""CSRF support for the decoupled storefront.

The desk gets its CSRF token from the bootinfo embedded in the page it serves.
The storefront is served by Vite/Vercel, not Frappe, so it has no boot to read
and every POST was rejected. This hands the token to the same-origin frontend
so writes work without turning CSRF protection off.
"""

import frappe


@frappe.whitelist(allow_guest=True)
def get_csrf_token():
    # Guests have no session to protect until they log in; issuing a token for
    # the current session is exactly what the desk does for itself.
    return {"csrf_token": frappe.sessions.get_csrf_token()}


@frappe.whitelist(allow_guest=True)
def whoami():
    user = frappe.session.user
    return {
        "user": None if user == "Guest" else user,
        "csrf_token": frappe.sessions.get_csrf_token(),
    }
