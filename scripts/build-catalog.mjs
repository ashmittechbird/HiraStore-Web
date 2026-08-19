/**
 * Generates src/data/catalog.json from the bundled spreadsheet export.
 *
 * The output is shaped exactly like a Frappe `Item` doc so the storefront can
 * consume it through the same code path as the live ERPNext backend — when
 * Frappe is unreachable we swap the source, not the rendering logic.
 *
 * Run: node scripts/build-catalog.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const raw = JSON.parse(fs.readFileSync(path.join(root, 'catalog_images/catalog_data.json'), 'utf8'));

// Images live in public/catalog_images, named by Product ID (THSE001.jpeg).
const imageFiles = new Map();
for (const f of fs.readdirSync(path.join(root, 'public/catalog_images'))) {
  imageFiles.set(f.replace(/\.[^.]+$/, ''), f);
}

/** Collapse the spreadsheet's 27 free-text category spellings onto the 8 shop tabs. */
function normalizeCategory(cat) {
  const c = String(cat || '').toLowerCase();
  if (c.includes('ear cuff')) return 'Earrings';
  if (c.includes('earring')) return 'Earrings';
  if (c.includes('necklace') || c.includes('choker')) return 'Necklaces';
  if (c.includes('bracelet')) return 'Bracelets';
  if (c.includes('bangle')) return 'Bangles';
  if (c.includes('pendant')) return 'Pendants';
  if (c.includes('set')) return 'Sets';
  if (c.includes('ring')) return 'Rings';
  if (/anklet|charm|hair|waist|arm|toe|bag|watch|belt|keychain|accessor|article/.test(c)) return 'Accessories';
  return 'Accessories';
}

/** Guess a material from the description — the sheet has no dedicated column. */
function deriveMaterial(desc) {
  const d = String(desc || '').toLowerCase();
  if (d.includes('meenakari')) return 'Sterling Silver · Meenakari';
  if (d.includes('kundan')) return 'Sterling Silver · Kundan';
  if (d.includes('pearl')) return 'Sterling Silver · Pearl';
  if (d.includes('oxidis') || d.includes('oxidiz')) return 'Oxidised Silver';
  if (d.includes('gold')) return 'Gold Plated Silver';
  if (d.includes('stone') || d.includes('gemstone')) return 'Sterling Silver · Gemstone';
  return 'Pure Sterling Silver';
}

const MINOR = new Set(['with', 'and', 'of', 'the', 'a', 'an', 'in', 'on', 'for', 'to']);

/** Title Case that leaves small joining words alone, the way retail copy reads. */
function titleCase(s) {
  return String(s || '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
    .split(' ')
    .map((w, i) => (i > 0 && MINOR.has(w) ? w : w.replace(/^./, c => c.toUpperCase())))
    .join(' ');
}

// Roughly a third of the sheet rows carry no description. Rather than fall back
// to a bare SKU ("Ring THSR017"), compose a name from the attributes we do have,
// keyed off the SKU so it stays identical between builds.
const STYLE = {
  Earrings: ['Jhumka', 'Chandbali', 'Drop', 'Stud', 'Hoop', 'Ear Cuff', 'Chandelier'],
  Necklaces: ['Haram', 'Choker', 'Rani Haar', 'Layered', 'Collar', 'Coin', 'Temple'],
  Rings: ['Statement', 'Stackable', 'Cocktail', 'Band', 'Filigree'],
  Bracelets: ['Cuff', 'Chain', 'Charm', 'Kada', 'Woven'],
  Bangles: ['Textured', 'Engraved', 'Slim', 'Twisted', 'Beaded'],
  Pendants: ['Locket', 'Medallion', 'Charm', 'Talisman'],
  Sets: ['Bridal', 'Festive', 'Everyday', 'Heirloom'],
  Accessories: ['Anklet', 'Hair Pin', 'Toe Ring', 'Charm', 'Waist Chain'],
};

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

function hash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

// A second axis so composed names don't collide across a 90-item category.
const MOTIF = [
  'Meenakari', 'Filigree', 'Temple', 'Antique', 'Hammered',
  'Beaded', 'Pearl', 'Kundan', 'Etched', 'Scalloped',
];

function composeName(id, category, material) {
  const styles = STYLE[category] || STYLE.Accessories;
  const h = hash(id);
  const style = styles[h % styles.length];
  const motif = MOTIF[Math.floor(h / styles.length) % MOTIF.length];
  const finish = material.startsWith('Oxidised')
    ? 'Oxidised Silver'
    : material.startsWith('Gold')
      ? 'Gold Plated'
      : 'Sterling Silver';
  return `${finish} ${motif} ${style} ${SINGULAR[category] || category}`;
}

const rows = raw.all_data.filter(
  r => r.sheet === 'All Products 26' && r.col_7 && r.col_7 !== 'Product ID'
);

const items = [];
const seen = new Set();

for (const r of rows) {
  const rawId = String(r.col_7).trim();
  // A couple of IDs use "THSE033/34" in the sheet but "THSE033_34" on disk.
  const id = imageFiles.has(rawId) ? rawId : rawId.replace(/\//g, '_');
  const file = imageFiles.get(id);
  if (!file) continue;                 // no photo -> not sellable, skip
  if (seen.has(id)) continue;
  seen.add(id);

  const price = parseFloat(String(r.col_8 ?? '').replace(/[^0-9.]/g, ''));
  if (!Number.isFinite(price) || price <= 0) continue;

  const status = String(r.col_9 || '').toLowerCase();
  const soldOut = status.includes('sold') || status.includes('damage') || status.includes('return');

  const desc = titleCase(r.col_11 || '');
  const category = normalizeCategory(r.col_10);
  const material = deriveMaterial(desc);
  const weight = parseFloat(String(r.col_3 ?? '').replace(/[^0-9.]/g, ''));

  items.push({
    name: id,
    item_name: desc || composeName(id, category, material),
    item_group: category,
    standard_rate: Math.round(price * 100) / 100,
    image: file,
    custom_material: material,
    custom_short_description: desc,
    weight_per_unit: Number.isFinite(weight) ? weight : 0,
    custom_is_featured: 0,
    disabled: soldOut ? 1 : 0,
    is_sales_item: 1,
    // Stable pseudo-timestamp so "New Arrivals" ordering is deterministic
    // across reloads instead of shuffling on every render.
    modified: new Date(Date.UTC(2025, 0, 1) + rows.indexOf(r) * 36e5).toISOString(),
  });
}

// Feature a spread across categories rather than the first N of one group,
// so the homepage "Most Loved" rail looks curated instead of all-earrings.
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

const outDir = path.join(root, 'src/data');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'catalog.json'), JSON.stringify(items));

const cats = [...new Set(items.map(i => i.item_group))].sort();
console.log(`catalog.json: ${items.length} items`);
console.log(`  in stock : ${items.filter(i => !i.disabled).length}`);
console.log(`  featured : ${featured.length}`);
console.log(`  categories: ${cats.join(', ')}`);
