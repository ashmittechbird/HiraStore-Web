# Copyright (c) 2026, The Hira Store and contributors
# For license information, please see license.txt

import re

import frappe
from frappe.model.document import Document


class VideoCallBooking(Document):
    def validate(self):
        self.customer_name = (self.customer_name or "").strip()
        if not self.customer_name:
            frappe.throw("Please provide a name for this booking.")

        # A booking is worthless without a number the store can actually ring.
        digits = re.sub(r"\D", "", self.phone or "")
        if len(digits) < 7:
            frappe.throw("Enter a valid phone number.")

        if self.email:
            self.email = self.email.strip().lower()

        if not self.status:
            self.status = "New"
