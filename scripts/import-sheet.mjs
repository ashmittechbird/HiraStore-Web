/**
 * Reads the master inventory workbook and writes a compact
 * `catalog_images/catalog_sheet.json` for the site build to consume.
 *
 * The .xlsx is ~44MB (it carries the product photos) and lives outside the
 * repo, so only the cell data is committed. Re-run this whenever the workbook
 * changes, then `npm run catalog`.
 *
 *   node scripts/import-sheet.mjs ["C:/path/to/Hira Inventory - Apr 25.xlsx"]
 *
 * The workbook has one sheet per intake period and the columns move between
 * them — Product ID sits in column 7 on the launch sheet and column 3 by
 * Nov 24, some sheets carry a Description and others don't. So columns are
 * resolved by header text, never by position. Sheets are read in workbook
 * order, which is chronological, and a later sheet wins for any product that
 * appears twice.
 *
 * Formula cells are read as their cached results, so prices arrive as the
 * numbers the sheet displays.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ExcelJS from 'exceljs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const home = process.env.USERPROFILE || process.env.HOME || '';

const CANDIDATES = [
  process.env.HIRA_SHEET,
  process.argv[2],
  path.join(home, 'Downloads', 'Hira Inventory -  April 25 updated.xlsx'),
  path.join(home, 'Downloads', 'Hira jewelry_catalog.xlsx'),
].filter(Boolean);

const sheetPath = CANDIDATES.find(p => fs.existsSync(p));
if (!sheetPath) {
  console.error('Could not find the inventory workbook. Looked in:');
  CANDIDATES.forEach(p => console.error('  ' + p));
  console.error('\nPass the path explicitly:  node scripts/import-sheet.mjs "C:/path/to/file.xlsx"');
  process.exit(1);
}

const norm = s => String(s ?? '').replace(/\s+/g, ' ').trim().toLowerCase();

/** Formula cells arrive as objects; take the cached result. */
function cellValue(cell) {
  let v = cell.value;
  if (v && typeof v === 'object') {
    if ('result' in v) v = v.result;
    else if (v.richText) v = v.richText.map(t => t.text).join('');
    else if ('text' in v) v = v.text;
    else v = null;
  }
  return v ?? null;
}

const str = v => (v === null || v === undefined ? '' : String(v).trim());

/**
 * Map header text to column index.
 *
 * Later duplicates deliberately overwrite earlier ones: the Oct 23 and Dec 23
 * sheets have no "Final Price in $" and instead repeat "Price in $", where the
 * second occurrence is the rounded selling price (185 rather than 185.4375).
 */
function headerMap(row) {
  const map = {};
  row.eachCell({ includeEmpty: true }, (cell, i) => {
    const h = norm(cellValue(cell));
    if (h) map[h] = i;
  });
  return map;
}

function findKey(map, predicate) {
  const key = Object.keys(map).find(predicate);
  return key ? map[key] : undefined;
}

console.log(`reading ${sheetPath}`);
const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile(sheetPath);

/** product_id -> row. Later sheets overwrite earlier ones. */
const byId = new Map();
const perSheet = [];
const skippedRows = [];
const collisions = [];

for (const ws of wb.worksheets) {
  const map = headerMap(ws.getRow(1));

  const col = {
    id: map['product id'],
    description: map['description'],
    category: map['website category'] ?? map['category'],
    status: map['status'],
    qty: map['qty'] ?? map['quantity'],
    weight: findKey(map, k => k.startsWith('weight')),
    // Prefer the explicit final column; otherwise the last "price in $".
    finalPrice: map['final price in $'] ?? findKey(map, k => k.startsWith('price in $')),
    priceInr: map['price'] ?? map['value'] ?? map['rate'],
  };

  if (!col.id) {
    perSheet.push({ name: ws.name, rows: 0, skipped: 'no Product ID column' });
    continue;
  }

  let count = 0;
  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const id = str(cellValue(row.getCell(col.id)));
    if (!id || norm(id) === 'product id') continue;
    // Sheets carry totals rows that land in the Product ID column
    // ("1,54,250.00   1,38,627.50"). A real SKU is a short unbroken code.
    if (!/^[A-Za-z0-9][A-Za-z0-9/_-]{2,19}$/.test(id)) {
      skippedRows.push({ sheet: ws.name, value: id.slice(0, 40) });
      continue;
    }

    // Some SKUs are reused for a genuinely different product — THSA001 is both
    // "Siver anklets" and "Silver Vilakku - Home Décor". Taking the later row
    // silently drops the other, and only one of them matches the photo on disk,
    // so these are reported rather than quietly resolved. A pure reprice of the
    // same item (same description) is fine and stays silent.
    const prior = byId.get(id);
    if (prior) {
      const a = norm(prior.description);
      const b = norm(col.description ? str(cellValue(row.getCell(col.description))) : '');
      if (a && b && a !== b) {
        collisions.push({
          id,
          kept: { sheet: ws.name, desc: b },
          dropped: { sheet: prior.source_sheet, desc: a },
        });
      }
    }

    byId.set(id, {
      product_id: id,
      description: col.description ? str(cellValue(row.getCell(col.description))) : '',
      category: col.category ? str(cellValue(row.getCell(col.category))) : '',
      // Blank means genuinely unknown, not zero — kept raw for the build step.
      weight_raw: col.weight ? str(cellValue(row.getCell(col.weight))) : '',
      final_price_usd: col.finalPrice ? cellValue(row.getCell(col.finalPrice)) : null,
      price_inr: col.priceInr ? cellValue(row.getCell(col.priceInr)) : null,
      status: col.status ? str(cellValue(row.getCell(col.status))) : '',
      qty: col.qty ? cellValue(row.getCell(col.qty)) : null,
      source_sheet: ws.name,
    });
    count++;
  }
  perSheet.push({ name: ws.name, rows: count });
}

const rows = [...byId.values()];
const out = path.join(root, 'catalog_images', 'catalog_sheet.json');
fs.writeFileSync(out, JSON.stringify(rows, null, 1));

console.log('\nper sheet:');
for (const s of perSheet) {
  console.log(`  ${s.name.padEnd(15)} ${s.skipped ? `skipped — ${s.skipped}` : `${s.rows} products`}`);
}

const named = rows.filter(r => r.description).length;
const weighed = rows.filter(r => r.weight_raw).length;
const priced = rows.filter(r => Number(r.final_price_usd) > 0).length;

console.log(`\ncatalog_sheet.json: ${rows.length} unique products`);
console.log(`  named   : ${named}   (${rows.length - named} have no description)`);
console.log(`  weighed : ${weighed}   (${rows.length - weighed} have no weight)`);
console.log(`  priced  : ${priced}   (${rows.length - priced} have no final price)`);

if (skippedRows.length) {
  console.log(`\nignored ${skippedRows.length} non-product row(s):`);
  skippedRows.forEach(s => console.log(`  ${s.sheet}: ${s.value}`));
}

if (collisions.length) {
  console.log(`\n⚠  ${collisions.length} SKU collision(s) — one code used for two different products.`);
  console.log('   The later row was kept; the other is not on the site. Give each a unique code in the sheet.');
  for (const c of collisions) {
    console.log(`   ${c.id}`);
    console.log(`     kept    (${c.kept.sheet}): ${c.kept.desc.slice(0, 52)}`);
    console.log(`     dropped (${c.dropped.sheet}): ${c.dropped.desc.slice(0, 52)}`);
  }
}
