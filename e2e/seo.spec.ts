import { test, expect } from '@playwright/test';
import { feed } from './helpers';

/**
 * What search engines, link previews and AI assistants see.
 *
 * Two views of every page: the running app (what Google renders), and the raw
 * HTML from the server with no JavaScript at all (what WhatsApp, Instagram and
 * most AI crawlers read). Both must name the page, price and photo correctly.
 */

const SITE = 'https://hirastore.techbirdit.in';

function ldBlocks(html: string): Array<Record<string, any>> {
  // One block may hold a single object or an array of them; both are valid.
  return [...html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)]
    .flatMap(m => [JSON.parse(m[1])].flat());
}

const meta = (html: string, attr: string, key: string) =>
  html.match(new RegExp(`<meta ${attr}="${key.replace(/[.:]/g, '\\$&')}" content="([^"]*)"`))?.[1];

test.describe('in the running app', () => {
  test('every page has its own title, description and canonical', async ({ page }) => {
    const pages: Array<[string, RegExp, string]> = [
      ['/', /^The Hira Store \| Everyday Fine Jewelry$/, `${SITE}/`],
      ['/shop', /^Shop All Jewelry \| The Hira Store$/, `${SITE}/shop/`],
      ['/shop?cat=Earrings', /^Earrings \| Handcrafted Jewelry \| The Hira Store$/, `${SITE}/shop/?cat=Earrings`],
      ['/about', /^Our Story \| The Hira Store$/, `${SITE}/about/`],
      ['/help', /^Shipping, Returns & Size Guide \| The Hira Store$/, `${SITE}/help/`],
    ];
    const seen = new Set<string>();
    for (const [path, title, canonical] of pages) {
      await page.goto(path);
      await expect(page, path).toHaveTitle(title);
      await expect(page.locator('link[rel=canonical]'), path).toHaveAttribute('href', canonical);
      const desc = await page.locator('meta[name=description]').getAttribute('content');
      expect(desc!.length, path).toBeGreaterThan(50);
      expect(seen.has(desc!), `${path} repeats another page's description`).toBe(false);
      seen.add(desc!);
      await expect(page.locator('meta[name=robots][content*=noindex]'), path).toHaveCount(0);
    }
  });

  test('a product page describes the product to Google', async ({ page, baseURL }) => {
    const item = (await feed(baseURL!)).find(i => i.custom_item_images)!;
    await page.goto('/product/' + item.name);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(item.item_name);
    await expect(page).toHaveTitle(`${item.item_name} | ${item.item_group.replace(/^Accessories - /, '')} | The Hira Store`);
    await expect(page.locator('link[rel=canonical]')).toHaveAttribute('href', `${SITE}/product/${item.name}/`);
    await expect(page.locator('meta[property="og:type"]')).toHaveAttribute('content', 'product');
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', new RegExp(`^${SITE}/catalog_images/${item.name}\\.jpeg`));
    await expect(page.locator('meta[property="product:price:amount"]')).toHaveAttribute('content', item.standard_rate.toFixed(2));

    const blocks = ldBlocks(await page.content());
    const products = blocks.filter(b => b['@type'] === 'Product');
    expect(products, 'exactly one Product once the app has taken over').toHaveLength(1);
    const p = products[0];
    expect(p.sku).toBe(item.name);
    expect(p.name).toBe(item.item_name);
    expect(p.offers.price).toBe(item.standard_rate.toFixed(2));
    expect(p.offers.priceCurrency).toBe('USD');
    expect(p.offers.availability).toBe('https://schema.org/InStock');
    expect(p.image.length).toBeGreaterThanOrEqual(2);
    const crumbs = blocks.find(b => b['@type'] === 'BreadcrumbList')!;
    expect(crumbs.itemListElement.map((c: any) => c.name)).toEqual(['Home', 'Shop', expect.any(String), item.item_name]);
  });

  test('private and empty pages are kept out of search results', async ({ page }) => {
    for (const path of ['/cart', '/login', '/signup', '/wishlist', '/checkout', '/payment', '/update-password', '/shop?search=ring', '/no-such-page', '/product/NOPE-404']) {
      await page.goto(path);
      await expect(page.locator('meta[name=robots]'), path).toHaveAttribute('content', /noindex/);
      await expect(page.locator('link[rel=canonical]'), path).toHaveCount(0);
    }
  });

  test('one h1 per page, and every product photo has alt text', async ({ page }) => {
    for (const path of ['/', '/shop', '/product/THSN023', '/about', '/help']) {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      await expect(page.locator('h1'), path).toHaveCount(1);
      const noAlt = await page.locator('img[src*="catalog_images"]').evaluateAll(imgs =>
        imgs.filter(i => !(i.getAttribute('alt') || '').trim()).map(i => i.getAttribute('src')));
      expect(noAlt, path).toEqual([]);
    }
  });
});

test.describe('to a crawler that runs no JavaScript', () => {
  test('each product has its own page with name, price, photo and schema', async ({ request, baseURL }) => {
    const items = await feed(baseURL!);
    for (const item of items.slice(0, 25)) {
      const res = await request.get(`/product/${item.name}/`);
      expect(res.status(), item.name).toBe(200);
      const html = await res.text();
      expect(html).toContain(`<title>${item.item_name.replace(/&/g, '&amp;')} |`);
      expect(html).toContain(`<link rel="canonical" href="${SITE}/product/${item.name}/" />`);
      expect(meta(html, 'property', 'og:image')).toMatch(new RegExp(`/catalog_images/${item.name}\\.jpeg`));
      expect(html).toMatch(new RegExp(`<h1>[^<]+</h1>`));
      expect(html).toContain('$' + item.standard_rate.toLocaleString('en-US'));
      const product = ldBlocks(html).find(b => b['@type'] === 'Product')!;
      expect(product.offers.price, item.name).toBe(item.standard_rate.toFixed(2));
    }
  });

  test('the shop page links to every product on sale', async ({ request, baseURL }) => {
    const items = await feed(baseURL!);
    const html = await (await request.get('/shop/')).text();
    const linked = new Set([...html.matchAll(/href="\/product\/([^/"]+)\/"/g)].map(m => decodeURIComponent(m[1])));
    expect([...items.map(i => i.name)].filter(n => !linked.has(n))).toEqual([]);
  });

  test('the home page carries the organisation and site search', async ({ request }) => {
    const html = await (await request.get('/')).text();
    const types = ldBlocks(html).map(b => b['@type']);
    expect(types).toEqual(expect.arrayContaining(['Organization', 'WebSite']));
    expect(meta(html, 'property', 'og:image')).toBe(`${SITE}/site-images/og-default.jpg`);
    expect(html).toMatch(/<h1>The Hira Store/);
  });
});

test.describe('files for crawlers', () => {
  test('robots.txt allows the shop, blocks the private side, and names the sitemap', async ({ request }) => {
    const txt = await (await request.get('/robots.txt')).text();
    expect(txt).toMatch(/^User-agent: \*$/m);
    expect(txt).toMatch(/^Allow: \/$/m);
    for (const p of ['/admin', '/cart', '/checkout', '/account', '/api/']) expect(txt).toContain(`Disallow: ${p}`);
    expect(txt).not.toMatch(/^Disallow: \/$/m);
    expect(txt).toContain(`Sitemap: ${SITE}/sitemap.xml`);
  });

  test('the sitemap lists exactly the products on sale, each with a live page and photo', async ({ request, baseURL }) => {
    const items = await feed(baseURL!);
    const xml = await (await request.get('/sitemap.xml')).text();
    expect(xml).toContain('xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"');
    const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
    const products = locs.filter(l => l.includes('/product/')).map(l => decodeURIComponent(l.split('/product/')[1].replace(/\/$/, '')));
    expect(new Set(products)).toEqual(new Set(items.map(i => i.name)));
    expect(locs.every(l => l.startsWith(SITE + '/'))).toBe(true);

    // Every URL in it answers 200 — a sitemap of dead links is worse than none.
    for (const loc of locs.filter(l => !l.includes('/product/')).concat(locs.filter(l => l.includes('/product/')).slice(0, 40))) {
      const res = await request.get(loc.replace(SITE, ''));
      expect(res.status(), loc).toBe(200);
    }
    const photos = [...xml.matchAll(/<image:loc>[^<]*\/catalog_images\/([^<]+)<\/image:loc>/g)].map(m => m[1]);
    expect(photos.length).toBeGreaterThanOrEqual(items.length);
    for (const p of photos.slice(0, 30)) expect((await request.head('/catalog_images/' + p)).status(), p).toBe(200);
  });

  test('llms.txt and llms-full.txt describe the store and every piece on sale', async ({ request, baseURL }) => {
    const items = await feed(baseURL!);
    const short = await (await request.get('/llms.txt')).text();
    expect(short).toMatch(/^# The Hira Store/);
    expect(short).toContain(`${items.length} pieces`);
    expect(short).toContain('/llms-full.txt');
    const full = await (await request.get('/llms-full.txt')).text();
    const missing = items.filter(i => !full.includes(`/product/${encodeURIComponent(i.name)}/`));
    expect(missing.map(i => i.name)).toEqual([]);
  });

  test('icons, manifest and share image are in place', async ({ request }) => {
    const manifest = await (await request.get('/site.webmanifest')).json();
    expect(manifest.name).toBe('The Hira Store');
    for (const icon of manifest.icons) expect((await request.get(icon.src)).status(), icon.src).toBe(200);
    expect((await request.get('/icon-180.png')).status()).toBe(200);
    expect((await request.get('/favicon.ico')).status()).toBe(200);
    const og = await request.get('/site-images/og-default.jpg');
    expect(og.status()).toBe(200);
    expect((await og.body()).length).toBeLessThan(300_000);
  });
});
