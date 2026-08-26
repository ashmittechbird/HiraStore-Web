import frappe
from frappe.utils.password import get_decrypted_password

EMAIL = "info@Thehirastore.com"
SETTINGS = {"doctype": "Email Account", "email_account_name": "Hira Store Outgoing", "email_id": EMAIL, "login_id_is_different": 0, "smtp_server": "smtp.gmail.com", "smtp_port": 587, "use_tls": 1, "use_ssl_for_outgoing": 0, "enable_outgoing": 1, "default_outgoing": 1, "enable_incoming": 0, "always_use_account_email_id_as_sender": 1, "send_unsubscribe_message": 0, "awaiting_password": 1}
existing = frappe.db.get_value("Email Account", {"email_id": EMAIL}, "name")
doc = frappe.get_doc("Email Account", existing) if existing else frappe.get_doc(SETTINGS)
for k, v in SETTINGS.items(): setattr(doc, k, v) if k != "doctype" else None
doc.flags.ignore_validate = True
doc.save(ignore_permissions=True) if existing else doc.insert(ignore_permissions=True)
frappe.db.commit()
print("ACCOUNT:", doc.name, "| existed:", bool(existing))
row = frappe.db.get_value("Email Account", doc.name, ["email_id", "smtp_server", "smtp_port", "use_tls", "enable_outgoing", "default_outgoing", "awaiting_password"], as_dict=True)
print("CONFIG:", dict(row))
print("PASSWORD SET:", bool(get_decrypted_password("Email Account", doc.name, "password", raise_exception=False)))
