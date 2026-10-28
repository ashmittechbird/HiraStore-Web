import { test, expect } from '@playwright/test';
import { createHash, randomBytes } from 'node:crypto';
import { ADMIN, PREFIX, apiSession, call, freshStorage, newPassword, shopper, signIn, watchErrors } from './helpers';

/** Accounts, the wishlist and booking a video call. */

test.beforeEach(async ({ page }) => { await freshStorage(page); });

test('a new shopper can sign up and is told to check their email', async ({ page }) => {
  await page.goto('/signup');
  await page.getByRole('textbox', { name: 'Your name' }).fill('E2E Newcomer');
  await page.getByRole('textbox', { name: 'your@email.com' }).first().fill(`${PREFIX}-new-${Date.now().toString(36)}@example.com`);
  await page.getByRole('button', { name: 'Create Account' }).click();
  await expect(page.getByText('Check your email!')).toBeVisible();
});

test('signing up twice with one email is refused', async ({ page }) => {
  await page.goto('/signup');
  await page.getByRole('textbox', { name: 'Your name' }).fill('E2E Twice');
  await page.getByRole('textbox', { name: 'your@email.com' }).first().fill(shopper().email);
  await page.getByRole('button', { name: 'Create Account' }).click();
  await expect(page.getByRole('alert').or(page.locator('.auth-error'))).toContainText('already has an account');
  await expect(page.getByText('Check your email!')).toHaveCount(0);
});

test('a wrong password is refused without signing in', async ({ page }) => {
  await page.goto('/login');
  await page.getByRole('textbox', { name: 'Email or Username' }).fill(shopper().email);
  await page.getByRole('textbox', { name: /^Password/ }).fill('definitely-wrong-1');
  await page.getByRole('button', { name: 'Sign In' }).click();
  await expect(page.getByRole('alert').or(page.getByText(/invalid|incorrect/i)).first()).toBeVisible();
  await expect(page).toHaveURL(/\/login/);
});

test('signing in shows the account; signing out ends it', async ({ page }) => {
  const watch = watchErrors(page);
  const who = shopper();
  await signIn(page, who);
  await page.goto('/account');
  await expect(page.getByText(who.email).first()).toBeVisible();
  await expect(page.getByRole('heading', { name: 'My Orders' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'No orders yet' })).toBeVisible();

  // A shopper is not offered the admin panel.
  await expect(page.getByRole('link', { name: 'Admin Panel' })).toHaveCount(0);

  await page.getByRole('button', { name: 'My Offers' }).click();
  await expect(page.getByText(/HIRA30|WELCOME10|FESTIVE20/).first()).toBeVisible();

  await page.getByRole('button', { name: 'Sign Out' }).click();
  await expect(page).toHaveURL(/\/$/);                        // home again, signed out
  await page.goto('/account');
  await expect(page).toHaveURL(/\/login/);
  watch.expectClean();
});

test('a shopper cannot open the admin panel', async ({ page }) => {
  await signIn(page, shopper());
  await page.goto('/admin');
  await expect(page.getByText('Total Revenue')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Products' })).toHaveCount(0);
});

test('wishlist: save a piece, see it, move it to the cart, remove it', async ({ page }) => {
  await page.goto('/product/THSE001');
  await page.getByRole('button', { name: 'Add to Wishlist' }).click();
  await page.goto('/wishlist');
  await expect(page.getByText('1 item saved')).toBeVisible();
  const card = page.getByRole('listitem').filter({ hasText: 'Pure silver earrings with pink meenakari details' });
  await card.getByRole('button', { name: 'Add to Cart' }).click();
  await page.goto('/cart');
  await expect(page.getByText('1 item').first()).toBeVisible();

  await page.goto('/wishlist');
  await page.getByRole('button', { name: /^Remove .* from wishlist$/ }).click();
  await expect(page.getByRole('heading', { name: 'Your wishlist is empty' })).toBeVisible();
});

test('the shop card heart adds to the wishlist too', async ({ page }) => {
  await page.goto('/shop');
  const first = page.getByRole('list', { name: 'Products' }).getByRole('listitem').first();
  const name = (await first.getByRole('heading', { level: 3 }).textContent())!.trim();
  await first.getByRole('button', { name: `Add ${name} to wishlist` }).click();
  await page.goto('/wishlist');
  await expect(page.getByRole('heading', { level: 3, name })).toBeVisible();
});

test.describe('video call booking', () => {
  test('a booking is checked, then received with a reference', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('group', { name: 'Contact The Hira Store' }).getByRole('button', { name: 'Book a Video Call' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('heading', { name: 'Book a Video Call' })).toBeVisible();

    // Missing name and phone.
    await dialog.getByRole('button', { name: 'Request a Call' }).click();
    await expect(dialog.getByRole('alert')).toBeVisible();

    await dialog.getByRole('textbox', { name: /Name/ }).fill(`${PREFIX} Booker`);
    await dialog.getByRole('textbox', { name: /Phone/ }).fill('+1 408 555 0123');
    await dialog.getByRole('textbox', { name: /Email/ }).fill(`${PREFIX}-booker@example.com`);
    const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
    await dialog.locator('input[type=date]').fill(tomorrow);
    await dialog.getByRole('combobox').selectOption({ index: 1 });
    await dialog.getByRole('textbox', { name: /looking for/ }).fill('Everyday earrings');
    await dialog.getByRole('button', { name: 'Request a Call' }).click();

    await expect(dialog.getByRole('heading', { name: 'Request received' })).toBeVisible();
    await expect(dialog.getByText(/^VCB-/)).toBeVisible();
    await dialog.getByRole('button', { name: 'Done' }).click();
    await expect(dialog).toHaveCount(0);
  });

  test('the WhatsApp button opens a chat with the store', async ({ page }) => {
    await page.goto('/');
    const wa = page.getByRole('group', { name: 'Contact The Hira Store' }).getByRole('link', { name: 'Chat on WhatsApp' });
    await expect(wa).toHaveAttribute('href', /^https:\/\/wa\.me\/\d{10,}/);
    await expect(wa).toHaveAttribute('target', '_blank');
  });
});

test.describe('passwords', () => {
  test('the link in the sign-up email sets a password and signs the shopper in', async ({ page, baseURL }) => {
    const email = `${PREFIX}-link-${Date.now().toString(36)}@example.com`;
    await page.goto('/signup');
    await page.getByRole('textbox', { name: 'Your name' }).fill('E2E Linker');
    await page.getByRole('textbox', { name: 'your@email.com' }).first().fill(email);
    await page.getByRole('button', { name: 'Create Account' }).click();
    await expect(page.getByText('Check your email!')).toBeVisible();

    // Stand in for the email: give the account a known set-password key,
    // stored the way Frappe stores the one it mails (sha256 of the key).
    const key = randomBytes(16).toString('hex');
    const admin = await apiSession(baseURL!, ADMIN);
    const now = new Date(Date.now() - new Date().getTimezoneOffset() * 60_000).toISOString().replace('T', ' ').slice(0, 19);
    const set = await call(admin, 'frappe.client.set_value', {
      doctype: 'User', name: email,
      fieldname: { reset_password_key: createHash('sha256').update(key).digest('hex'), last_reset_password_key_generated_on: now },
    });
    expect(set.status).toBe(200);
    await admin.dispose();

    const password = newPassword();
    await page.goto(`/update-password?key=${key}`);
    await expect(page.getByRole('heading', { name: 'Choose your password' })).toBeVisible();
    await page.getByLabel('New password').fill(password);
    await page.getByLabel('Confirm password').fill(password + 'x');
    await page.getByRole('button', { name: 'Save and sign in' }).click();
    await expect(page.getByText('The two passwords don’t match')).toBeVisible();

    await page.getByLabel('Confirm password').fill(password);
    await page.getByRole('button', { name: 'Save and sign in' }).click();
    await expect(page).toHaveURL(/\/account$/);
    await expect(page.getByText(email).first()).toBeVisible();

    // And the password works from then on.
    await page.getByRole('button', { name: 'Sign Out' }).click();
    await expect(page).toHaveURL(/\/$/);
    await signIn(page, { email, password });
  });

  test('a used or made-up link says it has expired and offers a new one', async ({ page }) => {
    await page.goto('/update-password?key=not-a-real-key');
    await page.getByLabel('New password').fill('Long-enough-pass-1');
    await page.getByLabel('Confirm password').fill('Long-enough-pass-1');
    await page.getByRole('button', { name: 'Save and sign in' }).click();
    await expect(page.getByRole('heading', { name: 'This link has expired' })).toBeVisible();
    await page.getByRole('link', { name: 'Email me a new link' }).click();
    await expect(page.getByRole('heading', { name: 'Reset your password' })).toBeVisible();
  });

  test('forgot password answers the same whether or not the account exists', async ({ page }) => {
    for (const email of [shopper().email, `${PREFIX}-nobody@example.com`]) {
      await page.goto('/login');
      await page.getByRole('button', { name: 'Forgot password?' }).click();
      await page.getByRole('textbox', { name: 'Email', exact: true }).fill(email);
      await page.getByRole('button', { name: 'Send reset link' }).click();
      // Frappe allows only a few reset requests an hour from one address, so
      // back-to-back test runs meet its limit; that refusal is right too.
      await expect(
        page.getByRole('status').filter({ hasText: 'has an account with us, a link to choose a new password is on its way' })
          .or(page.getByRole('alert').filter({ hasText: /rate limit|too many requests/i })),
      ).toBeVisible();
    }
  });
});
