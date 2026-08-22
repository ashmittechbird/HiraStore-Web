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

const items = [];
const seen = new Set();
const skipped = { noPhoto: [], noPrice: [] };

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
    disabled: isSellable(row.status) ? 0 : 1,
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
console.log(`  categories: ${[...new Set(items.map(i => i.item_group))].sort().join(', ')}`);
if (skipped.noPhoto.length) console.log(`  skipped (no photo): ${skipped.noPhoto.length} -> ${skipped.noPhoto.slice(0, 6).join(', ')}`);
if (skipped.noPrice.length) console.log(`  skipped (no price): ${skipped.noPrice.join(', ')}`);
