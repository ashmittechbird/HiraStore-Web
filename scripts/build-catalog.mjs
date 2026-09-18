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
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

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

/** Singular form for the "<thing> THSE001" fallback name. */
function singularOf(category) {
  return category.replace(/\bRings\b/, 'Ring')
    .replace(/\bNecklaces\b/, 'Necklace')
    .replace(/\bPendants\b/, 'Pendant')
    .replace(/\bBracelets\b/, 'Bracelet')
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

  const category = CATEGORY_NAMES.get(categoryKey(canonicalCategory(row.category))) || 'Uncategorised';
  const description = cleanDescription(row.description);

  items.push({
    name: id,
    // The sheet's description is the product name. Where it has none, fall back
    // to category + code rather than inventing one.
    item_name: description || `${singularOf(category)} ${id}`,
    item_group: category,
    standard_rate: Math.round(price * 100) / 100,
    image: file,
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
