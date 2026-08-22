/**
 * Reads the master jewellery catalogue spreadsheet and writes a compact
 * `catalog_images/catalog_sheet.json` for the site build to consume.
 *
 * The .xlsx itself is ~42MB (it carries the product photos) and lives outside
 * the repo, so only the cell data is committed. Re-run this whenever the sheet
 * changes, then `npm run catalog`.
 *
 *   node scripts/import-sheet.mjs ["C:/path/to/Hira jewelry_catalog.xlsx"]
 *
 * Formula cells are read as their cached results, so "Final Price in $" comes
 * through as the number the sheet actually displays.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ExcelJS from 'exceljs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const DEFAULT_PATHS = [
  process.env.HIRA_SHEET,
  process.argv[2],
  path.join(process.env.USERPROFILE || process.env.HOME || '', 'Downloads', 'Hira jewelry_catalog.xlsx'),
].filter(Boolean);

const sheetPath = DEFAULT_PATHS.find(p => fs.existsSync(p));
if (!sheetPath) {
  console.error('Could not find the catalogue spreadsheet. Looked in:');
  DEFAULT_PATHS.forEach(p => console.error('  ' + p));
  console.error('\nPass the path explicitly:  node scripts/import-sheet.mjs "C:/path/to/file.xlsx"');
  process.exit(1);
}

const SHEET_NAME = 'All Products 26';

// Column positions in the sheet, 1-indexed.
const COL = {
  sno: 1,
  weight: 3,
  priceInr: 4,
  productId: 7,
  finalPriceUsd: 8,
  status: 9,
  category: 10,
  description: 11,
};

/** Formula cells arrive as objects; take the cached result. */
function cell(row, index) {
  const v = row.getCell(index).value;
  if (v === null || v === undefined) return null;
  if (typeof v === 'object') {
    if ('result' in v) return v.result ?? null;
    if ('richText' in v) return v.richText.map(t => t.text).join('');
    if ('text' in v) return v.text;
  }
  return v;
}

function str(v) {
  return v === null || v === undefined ? '' : String(v).trim();
}

console.log(`reading ${sheetPath}`);
const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile(sheetPath);

const ws = wb.getWorksheet(SHEET_NAME);
if (!ws) {
  console.error(`Sheet "${SHEET_NAME}" not found. Sheets present: ${wb.worksheets.map(w => w.name).join(', ')}`);
  process.exit(1);
}

const rows = [];
ws.eachRow((row, n) => {
  if (n === 1) return; // header
  const productId = str(cell(row, COL.productId));
  if (!productId || productId.toLowerCase() === 'product id') return;

  rows.push({
    sno: str(cell(row, COL.sno)),
    product_id: productId,
    description: str(cell(row, COL.description)),
    category: str(cell(row, COL.category)),
    // Kept raw: the sheet mixes "22 grams" with bare numbers, and blank means
    // genuinely unknown rather than zero.
    weight_raw: str(cell(row, COL.weight)),
    price_inr: cell(row, COL.priceInr),
    final_price_usd: cell(row, COL.finalPriceUsd),
    status: str(cell(row, COL.status)),
  });
});

const out = path.join(root, 'catalog_images', 'catalog_sheet.json');
fs.writeFileSync(out, JSON.stringify(rows, null, 1));

const named = rows.filter(r => r.description).length;
const weighed = rows.filter(r => r.weight_raw).length;
const priced = rows.filter(r => Number(r.final_price_usd) > 0).length;

console.log(`catalog_sheet.json: ${rows.length} rows`);
console.log(`  named    : ${named}   (${rows.length - named} have no description in the sheet)`);
console.log(`  weighed  : ${weighed}   (${rows.length - weighed} have no weight in the sheet)`);
console.log(`  priced   : ${priced}   (${rows.length - priced} have no final price)`);
