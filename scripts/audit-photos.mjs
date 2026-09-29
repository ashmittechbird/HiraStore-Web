/**
 * Checks every served product photo against the workbook, by content.
 *
 * `extract-photos.mjs` compares dimensions, which is enough to fill a gap but
 * not to prove a photo belongs to the product it is filed under. This hashes
 * the bytes instead, so it can say exactly which product each picture really
 * is — and it turns out the original extraction shifted a number of them onto
 * the wrong codes. THSNC003, a hair ornament, was serving a photograph of
 * THSE064's fish earrings.
 *
 * Every image in the workbook is anchored to a spreadsheet row, and that row
 * carries the Product ID, so the workbook knows the truth. For each photo on
 * disk this prints one of:
 *
 *   ok        the bytes match the workbook image for that same code
 *   WRONG     the bytes are the workbook image for a different code
 *   stale     no workbook image matches; the file predates the workbook or was
 *             edited by hand
 *   missing   the workbook has a photo for this code but nothing is on disk
 *
 *   node scripts/audit-photos.mjs           # report
 *   node scripts/audit-photos.mjs --write   # repair the WRONG ones
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import ExcelJS from 'exceljs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const home = process.env.USERPROFILE || process.env.HOME || '';
const WRITE = process.argv.includes('--write');

const CANDIDATES = [
  process.env.HIRA_SHEET,
  process.argv.find(a => a.endsWith('.xlsx')),
  path.join(home, 'Downloads', 'Hira Inventory -  April 25 updated (1).xlsx'),
  path.join(home, 'Downloads', 'Hira Inventory -  April 25 updated.xlsx'),
].filter(Boolean);

const sheetPath = CANDIDATES.find(p => fs.existsSync(p));
if (!sheetPath) {
  console.error('Could not find the inventory workbook.');
  process.exit(1);
}

const norm = s => String(s ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
const sha = buf => crypto.createHash('sha1').update(Buffer.from(buf)).digest('hex');

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

function imageSize(buf) {
  const b = Buffer.from(buf);
  if (b.length > 24 && b[0] === 0x89 && b[1] === 0x50) return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
  if (b.length > 4 && b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i < b.length - 9) {
      if (b[i] !== 0xff) { i++; continue; }
      const m = b[i + 1];
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) {
        return { h: b.readUInt16BE(i + 5), w: b.readUInt16BE(i + 7) };
      }
      const len = b.readUInt16BE(i + 2);
      if (len <= 0) break;
      i += 2 + len;
    }
  }
  return null;
}
const isPhoto = d => !!d && d.w >= 50 && d.h >= 50;

const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile(sheetPath);

const media = new Map();
for (const m of wb.model.media || []) media.set(Number(m.index), m);

/** code -> {buffer, hash, dims, sheet}  and  hash -> [codes] */
const byCode = new Map();
const byHash = new Map();
/** code -> sheet row, for the description/category cross-check */
const rowOf = new Map();

for (const ws of wb.worksheets) {
  const headers = {};
  ws.getRow(1).eachCell({ includeEmpty: true }, (cell, i) => {
    const h = norm(cellValue(cell));
    if (h) headers[h] = i;
  });
  const idCol = headers['product id'];
  if (!idCol) continue;
  const descCol = headers['description'];
  const catCol = headers['website category'] ?? headers['category'];

  const codeAtRow = new Map();
  for (let r = 2; r <= ws.rowCount; r++) {
    const id = str(cellValue(ws.getRow(r).getCell(idCol)));
    if (!id || norm(id) === 'product id') continue;
    if (!/^[A-Za-z0-9][A-Za-z0-9/_-]{2,19}$/.test(id)) continue;
    codeAtRow.set(r, id);
    rowOf.set(id, {
      description: descCol ? str(cellValue(ws.getRow(r).getCell(descCol))) : '',
      category: catCol ? str(cellValue(ws.getRow(r).getCell(catCol))) : '',
      sheet: ws.name,
      row: r,
    });
  }

  for (const img of ws.getImages()) {
    const m = media.get(Number(img.imageId));
    if (!m || !m.buffer) continue;
    const top = Math.floor(img.range?.tl?.row ?? 0) + 1;
    const bottom = Math.max(top, Math.ceil(img.range?.br?.row ?? top));
    let code = null;
    for (let r = top; r <= bottom; r++) if (codeAtRow.has(r)) { code = codeAtRow.get(r); break; }
    if (!code || !/^[A-Za-z0-9_-]+$/.test(code)) continue;

    const h = sha(m.buffer);
    byCode.set(code, { buffer: m.buffer, hash: h, dims: imageSize(m.buffer), sheet: ws.name });
    if (!byHash.has(h)) byHash.set(h, []);
    if (!byHash.get(h).includes(code)) byHash.get(h).push(code);
  }
}

const dir = path.join(root, 'public/catalog_images');
const onDisk = new Map();
for (const f of fs.readdirSync(dir)) onDisk.set(f.replace(/\.[^.]+$/, ''), f);

const wrong = [];
const stale = [];
const missing = [];
let ok = 0;

for (const [code, file] of [...onDisk].sort()) {
  const buf = fs.readFileSync(path.join(dir, file));
  const h = sha(buf);
  const want = byCode.get(code);

  if (want && want.hash === h) { ok++; continue; }

  const owners = (byHash.get(h) || []).filter(c => c !== code);
  if (owners.length) {
    wrong.push({ code, file, actually: owners, canFix: !!want && isPhoto(want.dims), want });
  } else {
    stale.push({ code, file, hasWorkbook: !!want, dims: imageSize(buf) });
  }
}

for (const [code, got] of byCode) {
  if (!onDisk.has(code) && isPhoto(got.dims)) missing.push(code);
}

console.log(`workbook photos: ${byCode.size}   on disk: ${onDisk.size}`);
console.log(`\n  ok      : ${ok}   (bytes match the workbook for that code)`);

console.log(`\n  WRONG   : ${wrong.length}   (serving another product's photograph)`);
for (const w of wrong) {
  const t = rowOf.get(w.code);
  const o = rowOf.get(w.actually[0]);
  console.log(`    ${w.code.padEnd(10)} is really ${w.actually.join('/')}`);
  console.log(`        filed as : ${(t?.category || '?').padEnd(24)} ${String(t?.description || '').slice(0, 52)}`);
  console.log(`        photo is : ${(o?.category || '?').padEnd(24)} ${String(o?.description || '').slice(0, 52)}`);
  console.log(`        ${w.canFix ? `repairable from the workbook (${w.want.dims.w}x${w.want.dims.h})` : 'NO usable workbook photo for this code'}`);
}

console.log(`\n  stale   : ${stale.length}   (no workbook image matches these bytes)`);
for (const s of stale.slice(0, 40)) {
  console.log(`    ${s.code.padEnd(10)} ${s.dims ? `${s.dims.w}x${s.dims.h}`.padEnd(12) : 'unreadable  '}${s.hasWorkbook ? 'workbook has a different photo for this code' : 'not in the workbook at all'}`);
}
if (stale.length > 40) console.log(`    ...and ${stale.length - 40} more`);

console.log(`\n  missing : ${missing.length}   ${missing.slice(0, 20).join(' ')}`);

if (!WRITE) {
  console.log('\nNothing written. Re-run with --write to repair the WRONG ones.');
  process.exit(0);
}

let fixed = 0;
for (const w of wrong) {
  if (!w.canFix) continue;
  fs.writeFileSync(path.join(dir, w.file), Buffer.from(w.want.buffer));
  fixed++;
}
console.log(`\nrepaired ${fixed} photos. Run \`npm run catalog\`.`);
