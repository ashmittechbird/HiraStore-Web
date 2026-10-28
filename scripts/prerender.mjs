#!/usr/bin/env node
/**
 * Static HTML for every page a search engine or link preview should see.
 *
 *   node scripts/prerender.mjs        # after `vite build --mode vercel`
 *
 * The store is a single-page app: every URL used to answer with the same empty
 * index.html, titled "The Hira Store", with a canonical pointing at the home
 * page. Google got there eventually by running the JavaScript; WhatsApp and
 * Instagram previews, and the AI crawlers, never run it — so a shared product
 * link arrived with the home page's title and photo, and nobody but Google
 * could see a single product.
 *
 * This writes dist/<path>/index.html for the home page, /shop, /about, /help
 * and each product on sale, from the built index.html. Each carries the page's
 * own title, description, canonical, preview image and schema.org data, plus a
 * plain-HTML copy of its content inside #root. A browser running the app hides
 * that copy (see index.html) and React replaces it on mount, so shoppers see
 * nothing different.
 *
 * nginx serves these through `try_files $uri $uri/ /index.html`: /product/X
 * redirects to /product/X/, which is why canonicals end in a slash. Anything
 * not written here still falls through to the app as before.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  SITE_NAME, DEFAULT_TITLE, DEFAULT_DESCRIPTION, DEFAULT_IMAGE, CONTACT_EMAIL, INSTAGRAM_URL,
  canonicalUrl, absoluteUrl, displayCategory, productDescription, productTitle,
  organizationLd, websiteLd, breadcrumbLd, productLd,
} from '../src/lib/structuredData.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const read = f => JSON.parse(fs.readFileSync(path.join(root, f), 'utf8'));

const templatePath = path.join(dist, 'index.html');
if (!fs.existsSync(templatePath)) {
  console.error('prerender: dist/index.html not found — run vite build first');
  process.exit(1);
}
const template = fs.readFileSync(templatePath, 'utf8');

// Only the root-based build is served at the paths these pages describe. The
// Frappe build lives under /assets/hirastore/store/ and has its own routing.
if (!/src="\/static\//.test(template)) {
  console.log('prerender: skipped — this build is not served from the site root');
  process.exit(0);
}

const catalog = read('src/data/catalog.json');
const versions = read('src/data/photo-versions.json');
const onSale = catalog.filter(i => !i.disabled);

const esc = s => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const money = n => '$' + Number(n || 0).toLocaleString('en-US');
const photo = f => `/catalog_images/${f}${versions[f] ? `?v=${versions[f]}` : ''}`;
const productPath = code => `/product/${encodeURIComponent(code)}/`;
const categoryPath = group => `/shop/?cat=${encodeURIComponent(group)}`;

function photosOf(item) {
  const files = [item.image || `${item.name}.jpeg`];
  try {
    for (const f of JSON.parse(item.custom_item_images || '[]')) if (f) files.push(f);
  } catch { /* a malformed gallery costs nothing but the extras */ }
  return [...new Set(files)].map(photo);
}

const groups = [...new Set(onSale.map(i => i.item_group))]
  .map(g => ({ group: g, label: displayCategory(g), items: onSale.filter(i => i.item_group === g) }))
  .sort((a, b) => b.items.length - a.items.length || a.label.localeCompare(b.label));

// ── page assembly ───────────────────────────────────────────────────────────

function setTag(html, re, replacement) {
  if (!re.test(html)) throw new Error(`prerender: template is missing ${re}`);
  return html.replace(re, replacement);
}

function render({ title, description, url, image, type = 'website', jsonLd = [], meta = {}, body }) {
  const fullTitle = title ? `${title} | ${SITE_NAME}` : DEFAULT_TITLE;
  const img = absoluteUrl(image || DEFAULT_IMAGE);
  let html = template;
  html = setTag(html, /<title>[^<]*<\/title>/, `<title>${esc(fullTitle)}</title>`);
  html = setTag(html, /<meta name="description" content="[^"]*" \/>/, `<meta name="description" content="${esc(description)}" />`);
  html = setTag(html, /<link rel="canonical" href="[^"]*" \/>/, `<link rel="canonical" href="${esc(url)}" />`);
  html = setTag(html, /<meta property="og:type" content="[^"]*" \/>/, `<meta property="og:type" content="${type}" />`);
  html = setTag(html, /<meta property="og:title" content="[^"]*" \/>/, `<meta property="og:title" content="${esc(fullTitle)}" />`);
  html = setTag(html, /<meta property="og:description" content="[^"]*" \/>/, `<meta property="og:description" content="${esc(description)}" />`);
  html = setTag(html, /<meta property="og:url" content="[^"]*" \/>/, `<meta property="og:url" content="${esc(url)}" />`);
  html = setTag(html, /<meta name="twitter:title" content="[^"]*" \/>/, `<meta name="twitter:title" content="${esc(fullTitle)}" />`);
  html = setTag(html, /<meta name="twitter:description" content="[^"]*" \/>/, `<meta name="twitter:description" content="${esc(description)}" />`);
  html = setTag(html, /<meta name="twitter:image" content="[^"]*" \/>/, `<meta name="twitter:image" content="${esc(img)}" />`);
  if (image) {
    // The default image's size and alt text describe that image only.
    html = setTag(html, /<meta property="og:image" content="[^"]*" \/>\s*<meta property="og:image:width"[^>]*>\s*<meta property="og:image:height"[^>]*>\s*<meta property="og:image:alt" content="[^"]*" \/>/,
      `<meta property="og:image" content="${esc(img)}" />\n    <meta property="og:image:alt" content="${esc(title || SITE_NAME)}" />`);
  }

  // data-page-* marks what lib/seo.ts clears when the app moves to another page.
  const ldTag = (ld, mark) =>
    `    <script type="application/ld+json"${mark}>${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>`;
  const extra = Object.entries(meta).map(([k, v]) => `    <meta property="${esc(k)}" content="${esc(v)}" data-page-meta />`);
  extra.push(ldTag(organizationLd(), ''), ldTag(websiteLd(), ''));
  for (const ld of jsonLd) extra.push(ldTag(ld, ' data-page-ld'));
  html = setTag(html, /\s*<\/head>/, `\n${extra.join('\n')}\n  </head>`);
  html = setTag(html, /<div id="root"><\/div>/, `<div id="root"><div class="prerender">${body}</div></div>`);
  return html;
}

function write(urlPath, html) {
  const file = path.join(dist, decodeURIComponent(urlPath), 'index.html');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, html);
}

// ── shared fragments ────────────────────────────────────────────────────────

const nav = `<header><p><a href="/">${esc(SITE_NAME)}</a></p><nav aria-label="Main"><ul>` +
  `<li><a href="/shop/">Shop all</a></li>` +
  groups.map(g => `<li><a href="${esc(categoryPath(g.group))}">${esc(g.label)}</a></li>`).join('') +
  `<li><a href="/about/">Our story</a></li><li><a href="/help/">Shipping, returns &amp; sizes</a></li></ul></nav></header>`;

const footer = `<footer><p>${esc(SITE_NAME)} · San Jose, California · ` +
  `<a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a> · <a href="${INSTAGRAM_URL}">Instagram</a></p>` +
  `<p>Free US shipping on orders over $100; $5 below that.</p></footer>`;

const productLink = i =>
  `<li><a href="${esc(productPath(i.name))}">${esc(i.item_name)}</a> — ${money(i.standard_rate)}</li>`;

// ── pages ───────────────────────────────────────────────────────────────────

let count = 0;

// Product pages.
for (const item of onSale) {
  const images = photosOf(item);
  const url = canonicalUrl(`/product/${encodeURIComponent(item.name)}`);
  const label = displayCategory(item.item_group);
  const desc = productDescription(item);
  const own = String(item.custom_short_description || '').trim();
  const siblings = onSale.filter(i => i.item_group === item.item_group && i.name !== item.name).slice(0, 12);

  const details = [
    `<li>Product code: ${esc(item.name)}</li>`,
    item.custom_material ? `<li>Material: ${esc(item.custom_material)}</li>` : '',
    Number(item.weight_per_unit) > 0 ? `<li>Weight: ${esc(item.weight_per_unit)} g</li>` : '',
  ].join('');

  const body = nav + `<main>` +
    `<nav aria-label="Breadcrumb"><a href="/">Home</a> › <a href="/shop/">Shop</a> › ` +
    `<a href="${esc(categoryPath(item.item_group))}">${esc(label)}</a> › <span>${esc(item.item_name)}</span></nav>` +
    `<article><h1>${esc(item.item_name)}</h1>` +
    images.map((src, n) => `<img src="${esc(src)}" alt="${esc(item.item_name)}${n ? ` — view ${n + 1}` : ''}" width="600" loading="${n ? 'lazy' : 'eager'}">`).join('') +
    `<p>${money(item.standard_rate)} · ${esc(label)}</p>` +
    (own && own.toLowerCase() !== String(item.item_name).toLowerCase() ? `<p>${esc(own)}</p>` : '') +
    `<ul>${details}</ul>` +
    `<p>${Number(item.standard_rate) >= 100 ? 'Ships free within the US.' : 'US shipping $5; free on orders over $100.'} Packed by hand in San Jose, California.</p>` +
    `</article>` +
    (siblings.length ? `<section><h2>More ${esc(label.toLowerCase())}</h2><ul>${siblings.map(productLink).join('')}</ul></section>` : '') +
    `</main>` + footer;

  write(`/product/${item.name}/`, render({
    title: productTitle(item),
    description: desc,
    url,
    image: images[0],
    type: 'product',
    meta: { 'product:price:amount': Number(item.standard_rate).toFixed(2), 'product:price:currency': 'USD' },
    jsonLd: [
      productLd(item, images.map(absoluteUrl)),
      breadcrumbLd([
        { name: 'Home', path: '/' },
        { name: 'Shop', path: '/shop' },
        { name: label, path: `/shop?cat=${encodeURIComponent(item.item_group)}` },
        { name: item.item_name, path: `/product/${encodeURIComponent(item.name)}` },
      ]),
    ],
    body,
  }));
  count++;
}

// The whole catalogue, by category — the one page that links to everything.
write('/shop/', render({
  title: 'Shop All Jewelry',
  description: `Browse ${onSale.length} handcrafted pieces — earrings, necklaces, bangles & bracelets, pendants, rings and more. Free US shipping over $100.`,
  url: canonicalUrl('/shop'),
  jsonLd: [breadcrumbLd([{ name: 'Home', path: '/' }, { name: 'Shop', path: '/shop' }])],
  body: nav + `<main><h1>Shop all jewelry</h1><p>${onSale.length} handcrafted pieces, each one shipped from San Jose, California.</p>` +
    groups.map(g => `<section><h2><a href="${esc(categoryPath(g.group))}">${esc(g.label)}</a> (${g.items.length})</h2><ul>${g.items.map(productLink).join('')}</ul></section>`).join('') +
    `</main>` + footer,
}));
count++;

write('/about/', render({
  title: 'Our Story',
  description: 'The Hira Store began in 2023 as a passion project: handcrafted, ethically sourced silver and fine jewelry made to be worn every day, not saved for special occasions.',
  url: canonicalUrl('/about'),
  body: nav + `<main><h1>Our story</h1>` +
    `<p>We believe elegance is not a luxury reserved for special occasions — it is a feeling you deserve to carry with you every day.</p>` +
    `<p>What started as a passion project in 2023 grew into a business offering beautiful jewelry for every occasion, made from ethically sourced metals and gemstones by artisan partners who are paid fairly.</p>` +
    `<p>Every piece is quality-checked, hypoallergenic and skin-safe, and packed by hand at our studio in San Jose, California.</p>` +
    `<p><a href="/shop/">Browse the collection</a></p></main>` + footer,
}));
count++;

write('/help/', render({
  title: 'Shipping, Returns & Size Guide',
  description: 'Shipping costs and times, our returns policy, and ring, necklace and bangle size charts — everything to know before and after you order from The Hira Store.',
  url: canonicalUrl('/help'),
  body: nav + `<main><h1>Shipping, returns &amp; size guide</h1>` +
    `<h2>Shipping</h2><p>Orders of $100 or more ship free within the United States; below that, shipping is a flat $5. Every piece is packed by hand at our studio in San Jose, California.</p>` +
    `<h2>Returns</h2><p>If a piece arrives damaged or isn't what you ordered, tell us and we will repair, replace or refund it. Unworn pieces in their original packaging can be returned; worn earrings and made-to-order pieces cannot.</p>` +
    `<h2>Sizes</h2><p>Ring sizes follow US sizing against ISO inner diameters; necklace lengths run from collar (12–13 in) to matinee (20–24 in); bangles use Indian sizing from 2-4 (6.0 cm) to 2-12 (7.3 cm).</p>` +
    `<p>Questions? Email <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>.</p></main>` + footer,
}));
count++;

// Home last: it is also the fallback every other route is served, so the
// pages above are built from the untouched template.
const featured = onSale.filter(i => i.custom_is_featured).slice(0, 12);
fs.writeFileSync(templatePath, render({
  title: '',
  description: DEFAULT_DESCRIPTION,
  url: canonicalUrl('/'),
  body: nav + `<main><h1>${esc(SITE_NAME)} — everyday fine jewelry</h1>` +
    `<p>Handcrafted silver and fine jewelry, made to be worn every day: ${onSale.length} pieces across ${groups.length} collections, shipped from San Jose, California. Free US shipping over $100.</p>` +
    `<section><h2>Collections</h2><ul>${groups.map(g => `<li><a href="${esc(categoryPath(g.group))}">${esc(g.label)}</a> — ${g.items.length} pieces</li>`).join('')}</ul></section>` +
    (featured.length ? `<section><h2>Featured</h2><ul>${featured.map(productLink).join('')}</ul></section>` : '') +
    `</main>` + footer,
}));
count++;

console.log(`prerender: ${count} pages (${onSale.length} products, shop, about, help, home)`);
