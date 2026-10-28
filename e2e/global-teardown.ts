import fs from 'node:fs';
import type { APIRequestContext, FullConfig } from '@playwright/test';
import { ADMIN, AUTH_DIR, PREFIX, apiSession, call } from './helpers';

async function names(admin: APIRequestContext, doctype: string, filters: unknown[]): Promise<string[]> {
  const r = await call(admin, 'frappe.client.get_list', { doctype, filters, fields: ['name'], limit_page_length: 0 });
  return (r.body.message || []).map((row: { name: string }) => row.name);
}

async function remove(admin: APIRequestContext, doctype: string, name: string) {
  await call(admin, 'frappe.client.delete', { doctype, name });
}

/** Deletes every account, booking and coupon the run created, then the password file. */
export default async function globalTeardown(config: FullConfig) {
  const baseURL = config.projects[0].use.baseURL as string;
  const admin = await apiSession(baseURL, ADMIN);

  for (const user of await names(admin, 'User', [['name', 'like', `${PREFIX}-%@example.com`]])) {
    // A contact linked to the user has to go first, or the user can't be deleted.
    for (const c of await names(admin, 'Contact', [['user', '=', user]])) await remove(admin, 'Contact', c);
    await remove(admin, 'User', user);
  }

  for (const b of await names(admin, 'Video Call Booking', [['customer_name', 'like', `${PREFIX}%`]])) {
    await remove(admin, 'Video Call Booking', b);
  }

  // Coupons made by the admin test, and any discount rule left behind with them.
  for (const c of await names(admin, 'Coupon Code', [['coupon_code', 'like', 'E2EUI%']])) await remove(admin, 'Coupon Code', c);
  for (const r of await names(admin, 'Pricing Rule', [['title', 'like', 'Coupon%E2EUI%']])) await remove(admin, 'Pricing Rule', r);

  await admin.dispose();
  fs.rmSync(AUTH_DIR, { recursive: true, force: true });
}
