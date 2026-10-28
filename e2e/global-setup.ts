import fs from 'node:fs';
import type { FullConfig } from '@playwright/test';
import { ADMIN, AUTH_DIR, SHOPPER_FILE, apiSession, call, newPassword } from './helpers';

/**
 * Makes the test shopper: a Website User with the Customer role and a random
 * password, created through the admin API exactly as the desk would. Also
 * refuses to start against anything but a local bench — these tests create and
 * delete accounts and bookings.
 */
export default async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0].use.baseURL as string;
  if (!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(baseURL)) {
    throw new Error(`refusing to run the browser tests against ${baseURL} — local bench only`);
  }

  const admin = await apiSession(baseURL, ADMIN);
  const ping = await call(admin, 'frappe.auth.get_logged_user', {}, 'GET');
  if (ping.body.message !== 'Administrator') {
    throw new Error('the bench is not answering as Administrator — is it running on :8001? (see BACKEND.md)');
  }

  const stamp = Date.now().toString(36);
  const who = { email: `e2e-ui-${stamp}@example.com`, password: newPassword(), name: 'E2E Shopper' };
  const made = await call(admin, 'frappe.client.insert', {
    doc: {
      doctype: 'User',
      email: who.email,
      first_name: 'E2E',
      last_name: 'Shopper',
      user_type: 'Website User',
      send_welcome_email: 0,
      new_password: who.password,
      roles: [{ role: 'Customer' }],
    },
  });
  if (made.status !== 200) throw new Error('could not create the test shopper: ' + JSON.stringify(made.body).slice(0, 300));
  await admin.dispose();

  fs.mkdirSync(AUTH_DIR, { recursive: true });
  fs.writeFileSync(SHOPPER_FILE, JSON.stringify(who));
}
