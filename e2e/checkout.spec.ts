import { test, expect, type Page, type Route } from '@playwright/test';
import { feed, freshStorage, money, shopper, signIn, watchErrors } from './helpers';

/**
 * Basket to confirmation.
 *
 * Card payments go through Square, which needs live credentials no test run
 * should hold. So the browser side is exercised here with Square's SDK and the
 * charge endpoint stood in for — and the request the store sends is checked
 * field by field — while the server side of the same charge (pricing, coupons,
 * a tampered total, a declined card, a double click) is covered against the
 * real code by `bench execute hira.tests.checkout.run`.
 */

const CHEAP = 'THSE001';           // $65: under the free-shipping line

async function addToCart(page: Page, code: string, qty = 1) {
  await page.goto('/product/' + code);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  for (let i = 1; i < qty; i++) await page.getByRole('button', { name: '+' }).click();
  await page.getByRole('button', { name: 'Add to Cart' }).first().click();
}

/** Total shown in the order summary, as a number. */
async function summaryTotal(page: Page) {
  const row = page.locator('text=/^Total$/').locator('xpath=..');
  return money(await row.textContent());
}

/** Stands in for Square: a configured sandbox gateway and a card form that tokenizes. */
async function fakeSquare(page: Page, charge: (route: Route, body: Record<string, string>) => Promise<void>) {
  await page.route('**/api/method/hira.api.payments.get_payment_config*', r => r.fulfill({
    json: { message: { available: true, app_id: 'sandbox-sq0idb-TEST', location_id: 'LTEST', environment: 'sandbox' } },
  }));
  await page.route('https://sandbox.web.squarecdn.com/v1/square.js', r => r.fulfill({
    contentType: 'application/javascript',
    body: `window.Square = { payments: async () => ({ card: async () => ({
      attach: async el => { el.innerHTML = '<div data-testid="fake-card">card form</div>'; },
      tokenize: async () => ({ status: 'OK', token: 'cnon:card-nonce-ok' }),
    }) }) };`,
  }));
  await page.route('**/api/method/hira.api.payments.create_card_order', async r => {
    await charge(r, JSON.parse(r.request().postData() || '{}'));
  });
}

async function fillShipping(page: Page) {
  await page.getByRole('textbox', { name: '+1 (555) 000-0000' }).fill('+1 408 555 0100');
  await page.getByRole('textbox', { name: 'Street address' }).fill('1 Test Lane');
  await page.getByRole('textbox', { name: 'City' }).fill('San Jose');
  await page.getByRole('textbox', { name: 'State' }).fill('CA');
  await page.getByRole('textbox', { name: '12345' }).fill('95112');
}

test.beforeEach(async ({ page }) => { await freshStorage(page); });

test('cart: add, change quantity, remove, clear', async ({ page }) => {
  const watch = watchErrors(page);
  await addToCart(page, CHEAP);
  await page.goto('/cart');
  await expect(page.getByText('1 item').first()).toBeVisible();
  await expect(page.getByText('$65.00').first()).toBeVisible();

  await page.getByRole('button', { name: '+' }).click();
  await expect(page.getByText('2 items').first()).toBeVisible();
  await expect(page.getByText('$130.00').first()).toBeVisible();

  await page.getByRole('button', { name: '−' }).click();
  await expect(page.getByText('1 item').first()).toBeVisible();

  await page.getByRole('button', { name: 'Remove' }).click();
  await expect(page.getByText(/your cart is empty/i).first()).toBeVisible();
  watch.expectClean();
});

test('cart survives a reload and the badge counts it', async ({ page }) => {
  await addToCart(page, CHEAP, 2);
  await page.reload();
  await page.goto('/cart');
  await expect(page.getByText('2 items').first()).toBeVisible();
});

test('shipping is $5 under $100 and free from $100', async ({ page }) => {
  await addToCart(page, CHEAP);
  await page.goto('/cart');
  await expect(page.getByText(/Add \$35\.00 more for free shipping/)).toBeVisible();
  expect(await summaryTotal(page)).toBe(70);

  await page.getByRole('button', { name: '+' }).click();          // $130
  await expect(page.getByText(/Add \$[0-9.]+ more for free shipping/)).toHaveCount(0);
  expect(await summaryTotal(page)).toBe(130);
});

test('coupons: a good one discounts, a bad one is refused, a minimum is enforced', async ({ page }) => {
  await addToCart(page, CHEAP);
  await page.goto('/cart');
  const box = page.getByRole('textbox', { name: 'Promo code' });

  await box.fill('NOT-A-CODE');
  await page.getByRole('button', { name: 'Apply' }).click();
  await expect(page.getByText('Invalid coupon code')).toBeVisible();

  await box.fill('FESTIVE20');                                     // $100 minimum
  await page.getByRole('button', { name: 'Apply' }).click();
  await expect(page.getByText(/Minimum order \$100/)).toBeVisible();

  await box.fill(' hira30 ');                                      // case and spaces don't matter
  await page.getByRole('button', { name: 'Apply' }).click();
  await expect(page.getByText('Coupon applied! You save $19.50')).toBeVisible();
  expect(await summaryTotal(page)).toBeCloseTo(65 - 19.5 + 5, 2);
});

test('a coupon follows the basket when the quantity changes', async ({ page }) => {
  await addToCart(page, CHEAP);
  await page.goto('/cart');
  await page.getByRole('textbox', { name: 'Promo code' }).fill('HIRA30');
  await page.getByRole('button', { name: 'Apply' }).click();
  await expect(page.getByText(/You save \$19\.50/)).toBeVisible();

  await page.getByRole('button', { name: '+' }).click();          // $130, so 30% is $39
  await expect(page.getByText(/\$39\.00/).first()).toBeVisible();
  expect(await summaryTotal(page)).toBeCloseTo(130 - 39, 2);
});

test('checkout asks a guest to sign in, then brings them back', async ({ page }) => {
  await addToCart(page, CHEAP);
  await page.goto('/cart');
  await page.getByRole('button', { name: 'Proceed to Checkout' }).click();
  await expect(page).toHaveURL(/\/login\?return=%2Fcheckout|\/login\?return=\/checkout/);
  const who = shopper();
  await page.getByRole('textbox', { name: 'Email or Username' }).fill(who.email);
  await page.getByRole('textbox', { name: /^Password/ }).fill(who.password);
  await page.getByRole('button', { name: 'Sign In' }).click();
  await expect(page).toHaveURL(/\/checkout$/);
  await expect(page.getByRole('heading', { name: 'Shipping Address' })).toBeVisible();
  // The cart was not lost on the way.
  await expect(page.getByText('Pure silver earrings with pink meenakari details').first()).toBeVisible();
});

test('checkout will not continue with the address missing', async ({ page }) => {
  await signIn(page, shopper());
  await addToCart(page, CHEAP);
  await page.goto('/checkout');
  await expect(page.getByRole('main').getByRole('textbox', { name: 'your@email.com' })).toHaveValue(shopper().email);
  await page.getByRole('button', { name: /Continue to Payment/ }).click();
  await expect(page.getByText('Please fill all required fields')).toBeVisible();
  await expect(page).toHaveURL(/\/checkout$/);
});

test('without a card gateway the shop says so and takes no order', async ({ page }) => {
  // The local bench has no Square credentials, which is exactly this state.
  await signIn(page, shopper());
  await addToCart(page, CHEAP);
  await page.goto('/checkout');
  await fillShipping(page);
  await page.getByRole('button', { name: /Continue to Payment/ }).click();
  await expect(page).toHaveURL(/\/payment$/);
  await expect(page.getByText(/Card payments aren.t available right now/)).toBeVisible();
  await expect(page.getByRole('button', { name: /^Pay / })).toBeDisabled();
  await expect(page.getByRole('link', { name: 'Message us on WhatsApp' })).toHaveAttribute('href', /wa\.me\/\d+/);
});

test('paying by card: the store sends the right order and confirms it', async ({ page }) => {
  const watch = watchErrors(page);
  let sent: Record<string, string> = {};
  await fakeSquare(page, async (route, body) => {
    sent = body;
    await route.fulfill({ json: { message: { order_id: 'SAL-ORD-TEST-0001', payment_id: 'PAY-TEST-1', payment_method: 'Card (VISA ****1111)' } } });
  });

  await signIn(page, shopper());
  await addToCart(page, CHEAP, 2);                                   // $130, ships free
  await page.goto('/cart');
  await page.getByRole('textbox', { name: 'Promo code' }).fill('HIRA30');
  await page.getByRole('button', { name: 'Apply' }).click();
  await expect(page.getByText(/You save \$39\.00/)).toBeVisible();
  await page.getByRole('button', { name: 'Proceed to Checkout' }).click();
  await fillShipping(page);
  await page.getByRole('button', { name: /Continue to Payment/ }).click();

  await expect(page.getByTestId('fake-card')).toBeVisible();
  await expect(page.getByText(/Sandbox mode/)).toBeVisible();
  const pay = page.getByRole('button', { name: /^Pay \$91\.00/ });
  await expect(pay).toBeEnabled();
  await pay.click();

  await expect(page).toHaveURL(/\/order-success$/);
  await expect(page.getByText('SAL-ORD-TEST-0001')).toBeVisible();
  await expect(page.getByText('$91.00').first()).toBeVisible();

  // What went to the server.
  expect(sent.source_id).toBe('cnon:card-nonce-ok');
  expect(Number(sent.expected_total)).toBeCloseTo(91, 2);
  expect(sent.coupon_code?.trim().toUpperCase()).toBe('HIRA30');
  expect(sent.idempotency_key?.length).toBeGreaterThan(10);
  const cart = JSON.parse(sent.cart_items);
  expect(cart).toEqual([expect.objectContaining({ id: CHEAP, qty: 2 })]);
  const customer = JSON.parse(sent.customer);
  expect(customer).toEqual(expect.objectContaining({ email: shopper().email, city: 'San Jose', zip: '95112' }));

  // The basket is emptied once the order exists.
  await page.goto('/cart');
  await expect(page.getByText(/your cart is empty/i).first()).toBeVisible();
  watch.expectClean();
});

test('a declined card shows the reason, keeps the basket, and can be retried', async ({ page }) => {
  const keys: string[] = [];
  let declines = 1;
  await fakeSquare(page, async (route, body) => {
    keys.push(body.idempotency_key);
    if (declines-- > 0) {
      await route.fulfill({
        status: 417,
        json: {
          exc_type: 'ValidationError',
          _server_messages: JSON.stringify([JSON.stringify({ message: 'Your card was declined. Please try a different card.' })]),
        },
      });
    } else {
      await route.fulfill({ json: { message: { order_id: 'SAL-ORD-TEST-0002', payment_id: 'PAY-TEST-2', payment_method: 'Card' } } });
    }
  });

  await signIn(page, shopper());
  await addToCart(page, CHEAP);
  await page.goto('/checkout');
  await fillShipping(page);
  await page.getByRole('button', { name: /Continue to Payment/ }).click();
  await expect(page.getByTestId('fake-card')).toBeVisible();

  await page.getByRole('button', { name: /^Pay \$70\.00/ }).click();
  await expect(page.getByText('Your card was declined. Please try a different card.')).toBeVisible();
  await expect(page).toHaveURL(/\/payment$/);

  await page.getByRole('button', { name: /^Pay \$70\.00/ }).click();
  await expect(page).toHaveURL(/\/order-success$/);
  // A retry is a new payment attempt, never a replay of the declined one.
  expect(keys).toHaveLength(2);
  expect(keys[0]).not.toBe(keys[1]);
});

test('Buy Now goes straight to checkout with just that piece', async ({ page, baseURL }) => {
  const other = (await feed(baseURL!)).find(i => i.name !== CHEAP && i.standard_rate >= 100)!;
  await signIn(page, shopper());
  await addToCart(page, CHEAP);                                      // already in the basket
  await page.goto('/product/' + other.name);
  await page.getByRole('button', { name: 'Buy Now' }).click();
  await expect(page).toHaveURL(/\/checkout$/);
  await expect(page.getByText(other.item_name).first()).toBeVisible();
  await expect(page.getByText('Pure silver earrings with pink meenakari details')).toHaveCount(0);
});
