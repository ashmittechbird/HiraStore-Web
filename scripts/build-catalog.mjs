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

/** Collapse the sheet's 25 free-text category spellings onto the 8 shop tabs. */
function normalizeCategory(cat) {
  const c = String(cat || '').toLowerCase();
  if (c.includes('ear cuff') || c.includes('earring')) return 'Earrings';
  if (c.includes('necklace') || c.includes('choker')) return 'Necklaces';
  if (c.includes('bracelet')) return 'Bracelets';
  if (c.includes('bangle')) return 'Bangles';
  if (c.includes('pendant')) return 'Pendants';
  if (c.includes('set')) return 'Sets';
  if (c.includes('ring')) return 'Rings';
  return 'Accessories';
}

const SINGULAR = {
  Earrings: 'Earrings',
  Necklaces: 'Necklace',
  Rings: 'Ring',
  Bracelets: 'Bracelet',
  Bangles: 'Bangles',
  Pendants: 'Pendant',
  Sets: 'Jewellery Set',
  Accessories: 'Accessory',
};

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

const TAGGED = taggedPhotos();

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

  const category = normalizeCategory(row.category);
  const description = cleanDescription(row.description);

  items.push({
    name: id,
    // The sheet's description is the product name. Where it has none, fall back
    // to category + code rather than inventing one.
    item_name: description || `${SINGULAR[category] || category} ${id}`,
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
if (skipped.noPhoto.length) console.log(`  skipped (no photo): ${skipped.noPhoto.length} -> ${skipped.noPhoto.slice(0, 6).join(', ')}`);
if (skipped.noPrice.length) console.log(`  skipped (no price): ${skipped.noPrice.join(', ')}`);
