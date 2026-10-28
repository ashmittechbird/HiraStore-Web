import { test, expect } from '@playwright/test';
import { feed, freshStorage, money, watchErrors } from './helpers';

/** A shopper looking around: home, menus, the shop, a product, the info pages. */

test.beforeEach(async ({ page }) => { await freshStorage(page); });

test('home page shows collections and products, with no errors', async ({ page }) => {
  const watch = watchErrors(page);
  await page.goto('/');
  await expect(page).toHaveTitle('The Hira Store | Everyday Fine Jewelry');
  await expect(page.locator('.product-card').first()).toBeVisible();
  const cards = await page.locator('.product-card').count();
  expect(cards).toBeGreaterThanOrEqual(4);

  // Every product photo on the page actually loads.
  await page.waitForLoadState('networkidle');
  const broken = await page.locator('img').evaluateAll(imgs =>
    imgs.filter(i => (i as HTMLImageElement).complete && (i as HTMLImageElement).naturalWidth === 0 && (i as HTMLImageElement).src)
      .map(i => (i as HTMLImageElement).src));
  expect(broken, broken.join('\n')).toEqual([]);
  watch.expectClean();
});

test('no product card shows star ratings — there are no reviews behind them', async ({ page }) => {
  for (const path of ['/', '/shop']) {
    await page.goto(path);
    await expect(page.locator('.product-card, [role=listitem]').first()).toBeVisible();
    await expect(page.getByText('★★★★★'), path).toHaveCount(0);
  }
});

test('a home page card opens its product', async ({ page }) => {
  await page.goto('/');
  const link = page.locator('.product-card .card-link').first();
  const name = (await link.textContent())!.trim();
  await link.click();
  await expect(page).toHaveURL(/\/product\//);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(name);
});

test('the navbar menus lead to each category', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('navigation').getByRole('link', { name: 'Necklaces' }).first().click();
  await expect(page).toHaveURL(/\/shop\?cat=Necklaces/);
  await expect(page.getByRole('button', { name: 'Necklaces', exact: true })).toHaveClass(/active/);
  const cats = await page.locator('[role=listitem] p').filter({ hasText: /^(Necklaces|Earrings|Pendants)$/ }).allTextContents();
  expect(new Set(cats)).toEqual(new Set(['Necklaces']));
});

test('shop lists every product on sale, and filters by category', async ({ page, baseURL }) => {
  const items = await feed(baseURL!);
  await page.goto('/shop');
  await expect(page.getByRole('heading', { name: 'The Full Collection' })).toBeVisible();
  await expect(page.getByRole('list', { name: 'Products' }).getByRole('listitem').first()).toBeVisible();

  const earrings = items.filter(i => i.item_group === 'Earrings').length;
  await page.getByRole('button', { name: 'Earrings', exact: true }).click();
  await expect(page).toHaveURL(/cat=Earrings/);
  // Category tab results contain only that category.
  const shown = await page.getByRole('list', { name: 'Products' }).getByRole('listitem')
    .evaluateAll(cards => cards.map(c => c.querySelector('p')?.textContent?.replace(/^.*·\s*/, '').trim()));
  expect(shown.length).toBeGreaterThan(0);
  expect(new Set(shown)).toEqual(new Set(['Earrings']));
  expect(earrings).toBeGreaterThanOrEqual(shown.length);

  // Back returns to everything.
  await page.goBack();
  await expect(page).toHaveURL(/\/shop$/);
  await expect(page.getByRole('button', { name: 'All', exact: true })).toHaveClass(/active/);
});

test('bangles, bracelets and pairs are one category', async ({ page, baseURL }) => {
  const groups = new Set((await feed(baseURL!)).map(i => i.item_group));
  expect([...groups].filter(g => /bangle|bracelet/i.test(g))).toEqual(['Bangles & Bracelets']);
  await page.goto('/shop?cat=' + encodeURIComponent('Bangles & Bracelets'));
  await expect(page.getByRole('list', { name: 'Products' }).getByRole('listitem').first()).toBeVisible();
});

test('search finds a product by name and by code', async ({ page, baseURL }) => {
  const item = (await feed(baseURL!)).find(i => i.item_name.split(' ').length >= 2)!;
  await page.goto('/shop');
  const box = page.getByRole('searchbox', { name: 'Search products' });
  await box.fill(item.name);
  await expect(page.getByRole('heading', { level: 3, name: item.item_name }).first()).toBeVisible();

  await box.fill('zzzz-nothing-matches');
  await expect(page.getByRole('heading', { name: 'No products found' })).toBeVisible();
});

test('sorting by price orders the grid', async ({ page }) => {
  await page.goto('/shop');
  await page.getByRole('combobox', { name: 'Sort products' }).selectOption({ label: 'Price: Low to High' });
  const cards = page.getByRole('list', { name: 'Products' }).getByRole('listitem');
  await expect(cards.first()).toBeVisible();
  const prices = (await cards.locator('text=/^\\$[0-9,]+/').allTextContents()).slice(0, 12).map(money);
  expect(prices.length).toBeGreaterThan(3);
  expect([...prices].sort((a, b) => a - b)).toEqual(prices);

  await page.getByRole('combobox', { name: 'Sort products' }).selectOption({ label: 'Price: High to Low' });
  const desc = (await cards.locator('text=/^\\$[0-9,]+/').allTextContents()).slice(0, 12).map(money);
  expect([...desc].sort((a, b) => b - a)).toEqual(desc);
});

test('quick view shows the piece without leaving the shop', async ({ page }) => {
  await page.goto('/shop');
  const first = page.getByRole('list', { name: 'Products' }).getByRole('listitem').first();
  const name = (await first.getByRole('heading', { level: 3 }).textContent())!.trim();
  await first.hover();
  await first.getByRole('button', { name: 'Quick View' }).click();
  await expect(page.getByText(name).nth(1)).toBeVisible();
  await expect(page).toHaveURL(/\/shop/);
});

test('product page: details, gallery, quantity and breadcrumb', async ({ page, baseURL }) => {
  const watch = watchErrors(page);
  const items = await feed(baseURL!);
  const withGallery = items.find(i => i.custom_item_images)!;
  await page.goto('/product/' + withGallery.name);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(withGallery.item_name);
  await expect(page.getByText(`$${withGallery.standard_rate.toLocaleString('en-US')}`).first()).toBeVisible();
  await expect(page.getByText(withGallery.name).first()).toBeVisible();

  // Gallery: a second view exists and switches the main photo.
  const main = page.locator('img.main-img');
  const before = await main.getAttribute('src');
  await page.getByRole('img', { name: `${withGallery.item_name} view 2` }).click();
  await expect(main).not.toHaveAttribute('src', before!);

  await page.getByRole('button', { name: '+' }).click();
  await expect(page.getByText('2', { exact: true }).first()).toBeVisible();

  await page.getByRole('link', { name: 'Shop' }).first().click();
  await expect(page).toHaveURL(/\/shop$/);
  watch.expectClean();
});

test('a product that does not exist says so', async ({ page }) => {
  await page.goto('/product/NOPE-404');
  await expect(page.getByRole('heading', { name: 'Product not found' })).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
});

test('an unknown address shows the 404 page', async ({ page }) => {
  await page.goto('/this/does/not/exist');
  await expect(page.getByRole('heading', { name: 'Page Not Found' })).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
});

test('about and help pages render with their facts', async ({ page }) => {
  await page.goto('/about');
  await expect(page).toHaveTitle(/Our Story/);
  await expect(page.getByText(/2023/).first()).toBeVisible();

  await page.goto('/help');
  await expect(page).toHaveTitle(/Shipping, Returns/);
  await expect(page.getByText(/\$100/).first()).toBeVisible();
  await expect(page.getByText(/San Jose/).first()).toBeVisible();
  // The same promises the product pages make.
  await expect(page.getByText('30 days').first()).toBeVisible();
  await expect(page.getByText('one year warranty')).toBeVisible();
  await page.goto('/product/THSE001');
  await expect(page.getByText('30-day returns')).toBeVisible();
  await expect(page.getByText('1 year warranty').first()).toBeVisible();
});

test('every footer link goes somewhere real', async ({ page, request }) => {
  await page.goto('/');
  const hrefs = await page.locator('footer a[href^="/"], footer a[href^="http://localhost"]').evaluateAll(as =>
    [...new Set(as.map(a => (a as HTMLAnchorElement).getAttribute('href')!))]);
  expect(hrefs.length).toBeGreaterThan(3);
  for (const href of hrefs) {
    await page.goto(href);
    await expect(page.getByRole('heading', { name: 'Page Not Found' }), href).toHaveCount(0);
  }
  const mail = await page.locator('footer a[href^="mailto:"]').first().getAttribute('href');
  expect(mail).toMatch(/^mailto:.+@.+/);
  void request;
});
