/**
 * Generates src/data/catalog.json from the catalogue spreadsheet export.
 *
 * Source of truth is `catalog_images/catalog_sheet.json`, written by
 * scripts/import-sheet.mjs straight from the master .xlsx. Run that first if
 * the sheet has changed.
 *
 * The output is shaped exactly like a Frappe `Item` doc so the storefront can
 * consume it through the same code path as the live ERPNext backend.
 *
 * Nothing here invents product data. Where the sheet is blank — no description,
 * no weight — the field stays empty and the UI omits it, rather than filling in
 * a plausible-sounding guess.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE_URL = (process.env.SITE_URL || 'https://hirastore.techbirdit.in').replace(/\/+$/, '');

const sheetPath = path.join(root, 'catalog_images', 'catalog_sheet.json');
if (!fs.existsSync(sheetPath)) {
  console.error('catalog_sheet.json not found. Run:  node scripts/import-sheet.mjs');
  process.exit(1);
}
const sheet = JSON.parse(fs.readFileSync(sheetPath, 'utf8'));

// Photos live in public/catalog_images, named by Product ID (THSE001.jpeg).
const imageFiles = new Map();
for (const f of fs.readdirSync(path.join(root, 'public/catalog_images'))) {
  imageFiles.set(f.replace(/\.[^.]+$/, ''), f);
}

/**
 * Extra gallery photos: THSN023.2.jpeg, THSN023.3.jpeg, … sit beside the main
 * THSN023.jpeg and are shown after it on the product page. Drop the file in,
 * rebuild — no other bookkeeping.
 *
 * A dot, not a dash: the sheet has real codes like "THSC001-2", so a dash
 * suffix would one day hand a product another product's photo. Product codes
 * never contain a dot.
 */
function galleryFor(id) {
  const out = [];
  for (let n = 2; n <= 9; n++) {
    const f = imageFiles.get(`${id}.${n}`);
    if (f) out.push(f);
  }
  return out;
}

/**
 * Pixel dimensions, read from the file header — JPEG SOF marker or PNG IHDR.
 *
 * No dependency: this runs in the catalogue build, and pulling an image library
 * in to read two integers would be the larger cost.
 */
function imageSize(file) {
  const b = fs.readFileSync(file);

  if (b.length > 24 && b[0] === 0x89 && b[1] === 0x50) {
    return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
  }

  if (b.length > 4 && b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i < b.length - 9) {
      if (b[i] !== 0xff) { i++; continue; }
      const marker = b[i + 1];
      // SOF0..SOF15 carry the frame header; DHT/JPG/DAC do not.
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { h: b.readUInt16BE(i + 5), w: b.readUInt16BE(i + 7) };
      }
      const len = b.readUInt16BE(i + 2);
      if (len <= 0) break;
      i += 2 + len;
    }
  }

  return null;
}

/**
 * Below this on either side, the file is not a photograph.
 *
 * Fifteen products shipped with a 165x4 pixel grey sliver — an export that had
 * gone wrong — and eleven of them were on sale, including necklaces at $450 and
 * $525. Nothing caught it: the file existed, so the build counted it as a photo
 * and the page rendered a 4-pixel line where the product should be.
 *
 * Deliberately far below any real photo rather than near it. The catalogue has
 * genuine thumbnails down to 111x166, and a threshold chosen to look tidy would
 * have pulled fifty saleable products out of the shop to catch fifteen broken
 * ones. Nothing legitimate is anywhere near 50 pixels.
 */
const MIN_PHOTO_PX = 50;

/**
 * The sheet's own category, tidied but never reinterpreted.
 *
 * This used to collapse all 25 spellings onto eight shop tabs, which quietly
 * threw away most of what the sheet says: anklets, toe rings, hip belts, arm
 * cuffs, watch sliders, bags, charms, hair accessories and home articles all
 * became the single word "Accessories", and no customer could find any of them.
 *
 * Only typing artifacts are fixed — stray whitespace, the missing space in
 * "Accessories -Ring", and case. Singular and plural of one word are one
 * category, so "Necklace" / "Necklaces" / "necklace" merge; two different words
 * never do.
 */
function canonicalCategory(cat) {
  const s = String(cat || '').replace(/\s+/g, ' ').trim().replace(/\s*-\s*/g, ' - ');
  if (!s) return '';
  return s.replace(/\b[a-z]/g, c => c.toUpperCase());
}

/** Plural-insensitive key, so Pendant and Pendants group together. */
const categoryKey = s => s.toLowerCase().replace(/s\b/g, '').replace(/[^a-z ]/g, '').trim();

/**
 * One display spelling per category, chosen from the sheet itself.
 *
 * Where a category appears both singular and plural, the plural wins — it is
 * the form a shop tab takes, and both spellings are the sheet's own.
 */
function resolveCategoryNames(rows) {
  const byKey = new Map();
  for (const r of rows) {
    const c = canonicalCategory(r.category);
    if (!c) continue;
    const k = categoryKey(c);
    if (!byKey.has(k)) byKey.set(k, new Map());
    const tally = byKey.get(k);
    tally.set(c, (tally.get(c) || 0) + 1);
  }

  const display = new Map();
  for (const [k, tally] of byKey) {
    const spellings = [...tally.entries()].sort((a, b) => {
      const plural = x => (/s$/i.test(x[0]) ? 1 : 0);
      return plural(b) - plural(a) || b[1] - a[1];
    });
    display.set(k, spellings[0][0]);
  }
  return display;
}

/**
 * Sheet categories the store sells as one section.
 *
 * The rule above keeps two different words apart, and that is right in
 * general — but it split one shelf three ways: "Bangles" (12), "Bracelets" (9)
 * and "Bangle Pair" (2), the last a whole menu entry for two pieces. The store
 * wants them as a single section, so they are grouped here by the same
 * plural-insensitive key the rest of the build uses. The sheet is untouched;
 * each product still carries its own word in its fallback name ("Bangle
 * THSB024", not "Bangles & Bracelets THSB024").
 *
 * Add a line to fold another family together. Keys are categoryKey() output.
 */
const CATEGORY_MERGE = new Map([
  ['bangle', 'Bangles & Bracelets'],
  ['bracelet', 'Bangles & Bracelets'],
  ['bangle pair', 'Bangles & Bracelets'],
]);

/** Singular form for the "<thing> THSE001" fallback name. */
function singularOf(category) {
  return category.replace(/\bRings\b/, 'Ring')
    .replace(/\bNecklaces\b/, 'Necklace')
    .replace(/\bPendants\b/, 'Pendant')
    .replace(/\bBracelets\b/, 'Bracelet')
    .replace(/\bBangles\b/, 'Bangle')
    .replace(/\bEarrings\b/, 'Earrings')
    .replace(/\bSets\b/, 'Set');
}

/**
 * Material, only where the sheet's own description states it.
 *
 * The sheet has no material column and never says "sterling" — that wording
 * came from an earlier generated catalogue, not from the business. Anything not
 * stated is left blank and the product page hides the row.
 */
function deriveMaterial(desc) {
  const d = String(desc || '').toLowerCase();
  if (!d) return '';
  const gold = /gold dipped|gold plated|gold polish/.test(d);
  if (/pure silver/.test(d)) return gold ? 'Pure Silver, Gold Dipped' : 'Pure Silver';
  if (/silver/.test(d)) return gold ? 'Silver, Gold Dipped' : 'Silver';
  if (gold) return 'Gold Dipped';
  return '';
}

/** Sentence case, preserving the sheet's own wording. */
function cleanDescription(s) {
  return String(s || '').replace(/\s+/g, ' ').trim().replace(/^./, c => c.toUpperCase());
}

/** The sheet mixes "22 grams" with bare numbers. Blank means unknown, not zero. */
function parseWeight(raw) {
  if (!raw) return 0;
  const m = String(raw).match(/[\d.]+/);
  if (!m) return 0;
  const n = parseFloat(m[0]);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : 0;
}

/** Anything sold, damaged or awaiting repair is not sellable. */
function isSellable(status) {
  const s = String(status || '').toLowerCase();
  if (!s || s === 'none') return true;
  return !/sold|damage|return/.test(s);
}

/**
 * Products whose photo shows a price tag, barcode sticker or supplier code.
 *
 * Hidden rather than deleted: the piece is real and still sells in store, it's
 * the photograph that can't go in front of a customer. Replace the image and
 * remove the line to bring it back.
 */
function taggedPhotos() {
  const file = path.join(root, 'catalog_images', 'photos-with-tags.txt');
  if (!fs.existsSync(file)) return new Set();

  // Split on \r?\n, not \n. On a Windows checkout the file arrives CRLF, and a
  // trailing \r breaks the comment strip below in a way that leaves no trace:
  // `.` in a JS regex excludes \r, so /#.*$/ can never reach the end of the
  // string and quietly matches nothing. Every line then survives whole —
  // "THSN003     # white oval tag" becomes the product code — so nothing
  // matches a real product and all 38 tagged photos went back on sale, with
  // the build still cheerfully reporting a tag list it had loaded.
  const ids = fs.readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .map(l => l.replace(/#.*$/, '').trim())
    .filter(Boolean);

  const malformed = ids.filter(id => !/^[A-Z0-9_/-]+$/i.test(id));
  if (malformed.length) {
    console.error(`photos-with-tags.txt: ${malformed.length} line(s) are not product codes:`);
    malformed.slice(0, 3).forEach(m => console.error(`  ${JSON.stringify(m)}`));
    process.exit(1);
  }

  return new Set(ids);
}

/**
 * Per-product corrections, for rows the sheet gets wrong about their own piece.
 *
 * Applied before anything else reads the row, so a corrected category lands in
 * the menus and a cleared description falls through to the usual generated
 * name — no special cases downstream.
 */
function corrections() {
  const file = path.join(root, 'catalog_images', 'corrections.json');
  if (!fs.existsSync(file)) return { fix: {}, add: [] };
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  return { fix: raw.fix || {}, add: raw.add || [] };
}

const { fix: CORRECTIONS, add: ADDED } = corrections();

// Applied to the sheet rows themselves, before anything reads them, so a
// corrected category is counted in the menus like any other.
for (const row of sheet) {
  const fix = CORRECTIONS[String(row.product_id).trim()];
  if (!fix) continue;
  if (fix.category !== undefined) row.category = fix.category;
  if (fix.description !== undefined) row.description = fix.description;
  if (fix.price !== undefined) row.final_price_usd = fix.price;
  if (fix.weight !== undefined) row.weight_raw = fix.weight;
}

// Products the sheet cannot express, because their code was taken by another
// piece. They behave exactly like sheet rows from here on — including being
// skipped while they have no photograph.
const addedPending = [];
for (const row of ADDED) {
  const id = String(row.product_id).trim();
  if (sheet.some(r => String(r.product_id).trim() === id)) {
    console.error(`corrections.json: "${id}" is already in the sheet — remove it from "add".`);
    process.exit(1);
  }
  sheet.push(row);
  if (!imageFiles.has(id)) addedPending.push(id);
}

const TAGGED = taggedPhotos();
const CATEGORY_NAMES = resolveCategoryNames(sheet);

const items = [];
const seen = new Set();
const skipped = { noPhoto: [], noPrice: [] };
const brokenPhoto = [];

for (const row of sheet) {
  const rawId = String(row.product_id).trim();
  // A couple of IDs read "THSE033/34" in the sheet but "THSE033_34" on disk.
  const id = imageFiles.has(rawId) ? rawId : rawId.replace(/\//g, '_');
  const file = imageFiles.get(id);

  if (!file) { skipped.noPhoto.push(rawId); continue; }
  if (seen.has(id)) continue;

  const price = Number(row.final_price_usd);
  if (!Number.isFinite(price) || price <= 0) { skipped.noPrice.push(rawId); continue; }

  seen.add(id);

  // A file that exists is not the same as a usable photograph.
  const dims = imageSize(path.join(root, 'public/catalog_images', file));
  const photoUnusable = !dims || dims.w < MIN_PHOTO_PX || dims.h < MIN_PHOTO_PX;
  if (photoUnusable) brokenPhoto.push(`${id} (${dims ? `${dims.w}x${dims.h}` : 'unreadable'})`);

  const catKey = categoryKey(canonicalCategory(row.category));
  // The sheet's own word, before any merge — it names the piece in the
  // fallback, so a bangle is still called a bangle inside a combined section.
  const ownCategory = CATEGORY_NAMES.get(catKey) || 'Uncategorised';
  const category = CATEGORY_MERGE.get(catKey) || ownCategory;
  const description = cleanDescription(row.description);

  items.push({
    name: id,
    // The sheet's description is the product name. Where it has none, fall back
    // to category + code rather than inventing one.
    item_name: description || `${singularOf(ownCategory)} ${id}`,
    item_group: category,
    standard_rate: Math.round(price * 100) / 100,
    image: file,
    // Only present when there is something to show, so the seeder can tell
    // "no extra photos here" apart from "clear the gallery an admin set".
    ...(galleryFor(id).length ? { custom_item_images: JSON.stringify([file, ...galleryFor(id)]) } : {}),
    custom_material: deriveMaterial(description),
    custom_short_description: description,
    weight_per_unit: parseWeight(row.weight_raw),
    custom_is_featured: 0,
    // Out of the shop when the piece isn't sellable, when its photo carries a
    // price tag, or when the photo isn't a photo. In stock is not enough — a
    // listing a customer can't see the goods in shouldn't take their money.
    disabled: isSellable(row.status) && !TAGGED.has(id) && !photoUnusable ? 0 : 1,
    is_sales_item: 1,
    // Stable ordering for "New Arrivals" — the sheet's own sequence, reversed
    // so the newest additions surface first.
    modified: new Date(Date.UTC(2025, 0, 1) + (sheet.length - sheet.indexOf(row)) * 36e5).toISOString(),
  });
}

// Feature a spread across categories so the homepage rail looks curated
// rather than all-earrings.
const byCat = new Map();
for (const it of items) {
  if (it.disabled) continue;
  // Only pieces the sheet described. A homepage rail headed "Most Loved" that
  // opens on "Necklace THSN117" undersells the shop, and there are plenty of
  // named pieces to fill twelve slots.
  if (!it.custom_short_description) continue;
  if (!byCat.has(it.item_group)) byCat.set(it.item_group, []);
  byCat.get(it.item_group).push(it);
}
const featured = [];
let round = 0;
while (featured.length < 12 && round < 40) {
  for (const list of byCat.values()) {
    if (list[round] && featured.length < 12) featured.push(list[round]);
  }
  round++;
}
featured.forEach(it => { it.custom_is_featured = 1; });

fs.mkdirSync(path.join(root, 'src/data'), { recursive: true });
fs.writeFileSync(path.join(root, 'src/data/catalog.json'), JSON.stringify(items));

writeSitemap(items);
writeLlmsTxt(items);
writePhotoVersions();

const named = items.filter(i => i.custom_short_description).length;
const weighed = items.filter(i => i.weight_per_unit > 0).length;

console.log(`catalog.json: ${items.length} items`);
console.log(`  in stock  : ${items.filter(i => !i.disabled).length}`);
console.log(`  named     : ${named}  (${items.length - named} fall back to category + code)`);
console.log(`  weighed   : ${weighed}  (${items.length - weighed} show no weight)`);
console.log(`  featured  : ${featured.length}`);
console.log(`  hidden (photo shows a tag): ${items.filter(i => TAGGED.has(i.name)).length} of ${TAGGED.size} listed`);

// A tagged code that matches no product means the photo is still reachable and
// nobody is being told. Skipped items are fine — they never reach the shop —
// but a code that matches nothing at all is a typo, and it fails the build.
{
  const inCatalogue = new Set(items.map(i => i.name));
  const skippedIds = new Set([...skipped.noPhoto, ...skipped.noPrice]);
  const unmatched = [...TAGGED].filter(id => !inCatalogue.has(id) && !skippedIds.has(id));
  if (unmatched.length) {
    console.error(`\n  photos-with-tags.txt lists ${unmatched.length} code(s) that match no product:`);
    console.error(`    ${unmatched.join(', ')}`);
    console.error('  Fix the code or remove the line — as written, that photo still reaches customers.');
    process.exit(1);
  }
}
console.log(`  categories: ${[...new Set(items.map(i => i.item_group))].sort().join(', ')}`);
if (brokenPhoto.length) {
  console.log(`\n  hidden (photo is not a photo): ${brokenPhoto.length}`);
  console.log(`    ${brokenPhoto.join(', ')}`);
  console.log(`    Re-export these and drop them into public/catalog_images to put them back on sale.`);
}
if (addedPending.length) {
  console.log(`\n  waiting on a photo to go on sale: ${addedPending.length}`);
  for (const id of addedPending) {
    const row = ADDED.find(r => r.product_id === id);
    console.log(`    ${id}  $${row.final_price_usd}  ${String(row.description).slice(0, 44)}`);
  }
  console.log(`    Drop <CODE>.jpeg into public/catalog_images and re-run — no other edit needed.`);
}
if (skipped.noPhoto.length) console.log(`  skipped (no photo): ${skipped.noPhoto.length} -> ${skipped.noPhoto.slice(0, 6).join(', ')}`);
if (skipped.noPrice.length) console.log(`  skipped (no price): ${skipped.noPrice.join(', ')}`);

// This file is only half the catalogue. A live shop reads its products from
// ERPNext, so a rebuild that is deployed without reseeding leaves the site
// showing the old names, categories and prices — which is exactly how a pair
// of earrings stayed listed as "Nagas Necklace" under Necklaces long after the
// correction was made here. Said out loud on every build so it cannot be
// forgotten again.
console.log(`
  Deploying this? The backend needs the same data:
    scp src/data/catalog.json <bench-host>:~/frappe-bench/sites/catalog.json
    bench --site <site> execute hira.api.seed.seed_catalog
  Safe to re-run — it updates existing products rather than duplicating them.`);

/**
 * Write public/sitemap.xml from the catalogue that was just built.
 *
 * Hand-maintained, it listed three pages against a literal `TODO_DOMAIN`, so
 * search engines had nothing valid to crawl and not one of the 287 products
 * was discoverable. Generating it here means it can never drift from the
 * catalogue again: every in-stock product is listed, sold-out ones are left
 * out, and the file is rebuilt on every deploy.
 *
 * SITE_URL overrides the domain for a staging build.
 */
function writeSitemap(items) {
  const today = new Date().toISOString().slice(0, 10);

  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;');

  // Trailing slashes throughout: scripts/prerender.mjs writes each page as
  // <path>/index.html, and nginx 301s the bare path to the slashed one. A
  // sitemap full of redirects is one Google reports as errors.
  const url = (loc, priority, changefreq, images = []) =>
    `  <url><loc>${esc(SITE_URL + loc)}</loc><lastmod>${today}</lastmod>` +
    `<changefreq>${changefreq}</changefreq><priority>${priority}</priority>` +
    images.map(i => `<image:image><image:loc>${esc(SITE_URL + i)}</image:loc></image:image>`).join('') +
    `</url>`;

  const lines = [
    url('/', '1.0', 'weekly'),
    url('/shop/', '0.9', 'weekly'),
    url('/about/', '0.6', 'monthly'),
    url('/help/', '0.5', 'monthly'),
  ];

  const onSale = items.filter(i => !i.disabled);

  // One entry per category, so the collection pages are crawled too.
  for (const cat of [...new Set(onSale.map(i => i.item_group).filter(Boolean))].sort()) {
    lines.push(url(`/shop/?cat=${encodeURIComponent(cat)}`, '0.7', 'weekly'));
  }

  // Sold-out pieces are one-of-a-kind and will not come back; indexing them
  // just earns the store dead-end results. Photos ride along so the pieces can
  // turn up in Google Images — for jewellery, as often as not where people look.
  for (const it of onSale) {
    const photos = [it.image, ...JSON.parse(it.custom_item_images || '[]')].filter(Boolean);
    lines.push(url(`/product/${encodeURIComponent(it.name)}/`, '0.8', 'monthly',
      [...new Set(photos)].map(p => `/catalog_images/${p}`)));
  }

  const xml =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" ' +
    'xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n' +
    lines.join('\n') +
    '\n</urlset>\n';

  fs.writeFileSync(path.join(root, 'public/sitemap.xml'), xml);
  console.log(`  sitemap   : ${lines.length} urls -> ${SITE_URL}/sitemap.xml`);
}

/**
 * public/llms.txt and public/llms-full.txt — the store described for AI
 * assistants (llmstxt.org).
 *
 * ChatGPT, Claude, Perplexity and the rest mostly do not run JavaScript, so to
 * them the shop was an empty page. llms.txt is the short version: what the
 * store is, its policies, and where to look. llms-full.txt lists every piece on
 * sale with its price and link, so a question like "silver jhumkas under $50"
 * can be answered from it. Both are rebuilt from the catalogue, so counts and
 * prices cannot go stale the way the hand-written file did ("224 pieces").
 */
function writeLlmsTxt(items) {
  const onSale = items.filter(i => !i.disabled);
  const label = g => (g.startsWith('Accessories - ') ? g.slice('Accessories - '.length) : g);
  const groups = [...new Set(onSale.map(i => i.item_group))]
    .map(g => ({ g, items: onSale.filter(i => i.item_group === g) }))
    .sort((a, b) => b.items.length - a.items.length || label(a.g).localeCompare(label(b.g)));
  const money = n => '$' + Number(n).toLocaleString('en-US');
  const range = list => {
    const p = list.map(i => i.standard_rate);
    const lo = Math.min(...p), hi = Math.max(...p);
    return lo === hi ? money(lo) : `${money(lo)}–${money(hi)}`;
  };

  const head = [
    '# The Hira Store',
    '',
    '> Handcrafted silver and fine jewelry made for everyday wear — earrings, necklaces, ' +
      `bangles and bracelets, pendants, rings and accessories. ${onSale.length} pieces from ` +
      `${range(onSale).replace('–', ' to ')}, shipped from San Jose, California.`,
    '',
    'Prices are in US dollars. Most pieces are one of a kind: once sold, a piece leaves the shop.',
    '',
    '## Policies',
    '- Shipping: free within the US on orders of $100 or more; a flat $5 below that. Packed by hand and dispatched within 2-3 working days.',
    `- Returns: within 30 days of delivery. Damaged or wrong items are repaired, replaced or refunded, return postage paid by the store. Unworn pieces in their original packaging can be returned at the customer's cost; worn earrings and made-to-order pieces cannot. Details: ${SITE_URL}/help/`,
    '- Warranty: one year against manufacturing defects.',
    '- Payment: by card at checkout.',
    '- Video call: shoppers can book a video call to see pieces live before buying.',
    '',
    '## Contact',
    '- Email: info@Thehirastore.com',
    '- Instagram: https://www.instagram.com/thehirastore/',
    '- Studio: San Jose, California, USA',
    '',
    '## Pages',
    `- [Shop all jewelry](${SITE_URL}/shop/): the full catalogue with search, filters and sorting`,
    `- [Our story](${SITE_URL}/about/): who we are and how the pieces are made`,
    `- [Shipping, returns & size guide](${SITE_URL}/help/): ring, necklace and bangle size charts`,
    `- [Every piece on sale](${SITE_URL}/llms-full.txt): name, price, weight and link for each product`,
    '',
    '## Collections',
    ...groups.map(({ g, items: list }) =>
      `- [${label(g)}](${SITE_URL}/shop/?cat=${encodeURIComponent(g)}): ${list.length} ${list.length === 1 ? 'piece' : 'pieces'}, ${range(list)}`),
    '',
  ];
  fs.writeFileSync(path.join(root, 'public/llms.txt'), head.join('\n'));

  const full = [...head, '## Every piece on sale', ''];
  for (const { g, items: list } of groups) {
    full.push(`### ${label(g)}`, '');
    for (const it of list) {
      const own = String(it.custom_short_description || '').trim();
      const desc = own && own.toLowerCase() !== String(it.item_name).toLowerCase() ? ` — ${own}` : '';
      const wt = it.weight_per_unit > 0 ? `, ${it.weight_per_unit} g` : '';
      full.push(`- [${it.item_name}](${SITE_URL}/product/${encodeURIComponent(it.name)}/) (${it.name}): ${money(it.standard_rate)}${wt}${desc}`);
    }
    full.push('');
  }
  fs.writeFileSync(path.join(root, 'public/llms-full.txt'), full.join('\n'));
  console.log(`  llms.txt  : ${groups.length} collections; llms-full.txt lists ${onSale.length} products`);
}

/**
 * A short fingerprint of every product photo, written to
 * src/data/photo-versions.json and appended to each photo URL as ?v=… .
 *
 * The server tells browsers to keep a photo for seven days, and a photo keeps
 * its filename when it is replaced — THSN067.jpeg before and after. So a
 * sharper photo went live and anyone who had looked at that product in the
 * past week went on seeing the old blurry one, with nothing to suggest the
 * deploy had worked. The fingerprint changes exactly when the file does: a
 * replaced photo gets a new URL and is fetched again, and every untouched one
 * stays cached.
 */
function writePhotoVersions() {
  const dir = path.join(root, 'public/catalog_images');
  const versions = {};
  for (const f of fs.readdirSync(dir).sort()) {
    if (!/\.(jpe?g|png|webp)$/i.test(f)) continue;
    versions[f] = crypto.createHash('sha1').update(fs.readFileSync(path.join(dir, f))).digest('hex').slice(0, 8);
  }
  fs.writeFileSync(path.join(root, 'src/data/photo-versions.json'), JSON.stringify(versions));
  console.log(`  photo versions: ${Object.keys(versions).length}`);

  // Pixel widths of every photo that has a small card-size copy beside it
  // (<CODE>.sm.jpeg), so the shop can offer both in a srcset with honest
  // width descriptors — the browser picks by them.
  const widths = {};
  for (const f of Object.keys(versions)) {
    const m = f.match(/^(.+)\.sm\.jpe?g$/i);
    if (!m || !versions[`${m[1]}.jpeg`]) continue;
    const full = imageSize(path.join(dir, `${m[1]}.jpeg`));
    const small = imageSize(path.join(dir, f));
    if (full && small) widths[`${m[1]}.jpeg`] = [full.w, small.w];
  }
  fs.writeFileSync(path.join(root, 'src/data/photo-widths.json'), JSON.stringify(widths));
  console.log(`  card-size copies: ${Object.keys(widths).length}`);
}
