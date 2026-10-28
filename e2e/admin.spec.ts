import { test, expect, type Page } from '@playwright/test';
import { ADMIN, PREFIX, apiSession, call, signIn, watchErrors } from './helpers';

/** The owner's side: the admin panel, against the live records on the bench. */

async function openAdmin(page: Page) {
  await signIn(page, { email: ADMIN.usr, password: ADMIN.pwd });
  await page.goto('/admin');
  await expect(page.getByText('Total Revenue')).toBeVisible();
}

async function section(page: Page, name: string) {
  await page.locator('.sb-nav').getByRole('button', { name: new RegExp(`^${name}`) }).click();
}

test('dashboard: totals, recent orders and the way back to the shop', async ({ page }) => {
  const watch = watchErrors(page);
  await openAdmin(page);
  await expect(page.getByText('Total Products')).toBeVisible();
  await expect(page.getByText('Total Orders')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Recent Orders' })).toBeVisible();
  // The navbar offers the panel to the owner.
  await expect(page.getByRole('link', { name: 'Admin Panel' }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'View Site' })).toHaveAttribute('href', '/');
  watch.expectClean();
});

test('sidebar works from the keyboard', async ({ page }) => {
  await openAdmin(page);
  const products = page.locator('.sb-nav').getByRole('button', { name: /^Products/ });
  await products.focus();
  await page.keyboard.press('Enter');
  await expect(products).toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('textbox', { name: 'Search products…' })).toBeVisible();
});

test('products: the catalogue is listed and searchable', async ({ page }) => {
  await openAdmin(page);
  await section(page, 'Products');
  const search = page.getByRole('textbox', { name: 'Search products…' });
  await search.fill('THSN023');
  await expect(page.getByText('Bridal Kemp Jadau majestic necklace').first()).toBeVisible();

  await page.getByRole('button', { name: 'Add Product' }).click();
  await expect(page.getByRole('heading', { name: /Add (New )?Product/ })).toBeVisible();
  await page.keyboard.press('Escape');
});

test('homepage: saving publishes the selection the home page reads', async ({ page, request }) => {
  await openAdmin(page);
  await section(page, 'Homepage');
  await expect(page.getByRole('heading', { name: 'Most Loved Pieces' })).toBeVisible();
  // Saving with nothing ticked keeps the default picks, and creates the file
  // the storefront looks for — so the shop stops logging a 404 for it.
  await page.getByRole('button', { name: 'Save Homepage' }).click();
  await expect(page.getByText(/saved/i).first()).toBeVisible();
  const cfg = await request.get('/files/homepage_config.json');
  expect(cfg.status()).toBe(200);
  const body = await cfg.json();
  expect(Array.isArray(body.ml) && Array.isArray(body.na)).toBe(true);
});

test('orders: listed with customer, amount and status, and searchable', async ({ page }) => {
  await openAdmin(page);
  await section(page, 'Orders');
  const rows = page.locator('table tbody tr');
  await expect(rows.first()).toBeVisible();
  const firstId = (await rows.first().locator('td').first().textContent())!.trim();
  expect(firstId).toMatch(/^SAL-ORD-/);
  await page.getByRole('textbox', { name: 'Search by order ID or customer…' }).fill(firstId);
  await expect(rows).toHaveCount(1);
});

test('customers are listed', async ({ page }) => {
  await openAdmin(page);
  await section(page, 'Customers');
  await expect(page.getByRole('heading', { name: 'All Customers' })).toBeVisible();
  await expect(page.locator('table tbody tr').first()).toBeVisible();
});

test('video calls: a new request shows up and its status can be changed', async ({ page, baseURL }) => {
  const guest = await apiSession(baseURL!);
  const name = `${PREFIX} Admin Check ${Date.now().toString(36)}`;
  const made = await call(guest, 'hira.api.bookings.create_booking', {
    customer_name: name, phone: '+1 408 555 0199', email: `${PREFIX}-admin@example.com`,
    preferred_date: new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 10),
    preferred_time: '', notes: 'admin e2e',
  });
  expect(made.status).toBe(200);
  const ref = made.body.message.booking_id as string;
  await guest.dispose();

  await openAdmin(page);
  await section(page, 'Video Calls');
  const row = page.locator('table tbody tr').filter({ hasText: ref });
  await expect(row).toContainText(name);
  await row.getByRole('combobox').selectOption('Confirmed');
  await expect(page.getByText('Status updated')).toBeVisible();

  await page.reload();
  await section(page, 'Video Calls');
  await expect(page.locator('table tbody tr').filter({ hasText: ref }).getByRole('combobox')).toHaveValue('Confirmed');
});

test('offers: coupons are listed; one can be created and deleted', async ({ page, baseURL }) => {
  await openAdmin(page);
  await section(page, 'Offers');
  await expect(page.locator('table tbody tr').filter({ hasText: 'HIRA30' })).toBeVisible();

  const code = 'E2EUI' + Date.now().toString(36).toUpperCase().slice(-5);
  await page.getByRole('textbox', { name: 'SAVE20' }).fill(code);
  const nums = page.getByRole('spinbutton');
  await nums.nth(0).fill('15');
  await nums.nth(1).fill('50');                                    // minimum order
  const until = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);
  await page.locator('input[type=date]').nth(1).fill(until);
  await page.getByRole('button', { name: 'Create Coupon Code' }).click();
  const row = page.locator('table tbody tr').filter({ hasText: code });
  await expect(row).toBeVisible();

  // The new code works at the till, minimum included.
  const guest = await apiSession(baseURL!);
  const priced = await call(guest, 'hira.api.coupons.validate_coupon', { code, subtotal: 100 }, 'GET');
  expect(priced.body.message?.discount).toBe(15);
  const under = await call(guest, 'hira.api.coupons.validate_coupon', { code, subtotal: 40 }, 'GET');
  expect(JSON.stringify(under.body)).toContain('Minimum order $50');
  await guest.dispose();

  await row.getByRole('button', { name: 'Delete' }).click();
  await page.getByRole('button', { name: 'Delete', exact: true }).last().click();
  await expect(page.locator('table tbody tr').filter({ hasText: code })).toHaveCount(0);
});

test('settings show the live backend', async ({ page }) => {
  await openAdmin(page);
  await section(page, 'Settings');
  await expect(page.getByText('Frappe / ERPNext')).toBeVisible();
});
