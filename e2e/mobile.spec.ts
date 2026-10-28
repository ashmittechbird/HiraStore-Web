import { test, expect } from '@playwright/test';
import { freshStorage, shopper, signIn, watchErrors } from './helpers';

/** On a phone, where most of the shop's visitors arrive from Instagram. */

test.beforeEach(async ({ page }) => { await freshStorage(page); });

test('no page scrolls sideways', async ({ page }) => {
  for (const path of ['/', '/shop', '/product/THSN023', '/cart', '/about', '/help', '/wishlist', '/login', '/signup']) {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, `${path} is ${overflow}px wider than the screen`).toBeLessThanOrEqual(1);
  }
});

test('the menu opens and leads to a category', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Menu' }).click();
  const link = page.getByRole('link', { name: 'Earrings', exact: true }).filter({ visible: true }).first();
  await link.click();
  await expect(page).toHaveURL(/\/shop\?cat=Earrings/);
});

test('a shopper can find a piece and get to payment on a phone', async ({ page }) => {
  const watch = watchErrors(page);
  await signIn(page, shopper());
  await page.goto('/shop');
  const first = page.getByRole('list', { name: 'Products' }).getByRole('listitem').first();
  await first.getByRole('link').first().click();
  await expect(page).toHaveURL(/\/product\//);
  await page.getByRole('button', { name: 'Add to Cart' }).first().click();

  await page.goto('/cart');
  await page.getByRole('button', { name: 'Proceed to Checkout' }).click();
  await expect(page.getByRole('heading', { name: 'Shipping Address' })).toBeVisible();
  await page.getByRole('textbox', { name: '+1 (555) 000-0000' }).fill('+1 408 555 0100');
  await page.getByRole('textbox', { name: 'Street address' }).fill('1 Test Lane');
  await page.getByRole('textbox', { name: 'City' }).fill('San Jose');
  await page.getByRole('textbox', { name: 'State' }).fill('CA');
  await page.getByRole('textbox', { name: '12345' }).fill('95112');
  await page.getByRole('button', { name: /Continue to Payment/ }).click();
  await expect(page).toHaveURL(/\/payment$/);
  watch.expectClean();
});

test('the video-call button is reachable and its form fits the screen', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('group', { name: 'Contact The Hira Store' }).getByRole('button', { name: 'Book a Video Call' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  const box = await dialog.boundingBox();
  const vw = page.viewportSize()!.width;
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(vw + 1);
});
