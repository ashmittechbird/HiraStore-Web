/**
 * Pulls product photographs straight out of the master inventory workbook.
 *
 * The catalogue's photos were originally extracted by a different tool that
 * damaged some of them: fifteen products shipped with a 165x4 pixel grey
 * sliver where the product should be, and the build had to hide them. The
 * workbook itself is fine — only four of its 318 images are actually broken —
 * so the pictures were recoverable all along.
 *
 * Each image is anchored to a worksheet row, and that row carries the Product
 * ID, which is what names the file on disk. Columns are resolved by header
 * text exactly as scripts/import-sheet.mjs does, because the Product ID column
 * moves between sheets.
 *
 *   node scripts/extract-photos.mjs            # report only, writes nothing
 *   node scripts/extract-photos.mjs --write    # fill in missing/broken photos
 *   node scripts/extract-photos.mjs --write --force   # also replace good ones
 *
 * Without --force this only ever fills a gap: a product with no photo, or one
 * whose photo is too small to be a photograph. A picture that is already good
 * is left exactly as it is.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ExcelJS from 'exceljs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const home = process.env.USERPROFILE || process.env.HOME || '';

const WRITE = process.argv.includes('--write');
const FORCE = process.argv.includes('--force');

/** Matches the build's own threshold for "this file is not a photograph". */
const MIN_PHOTO_PX = 50;

const CANDIDATES = [
  process.env.HIRA_SHEET,
  process.argv.find(a => a.endsWith('.xlsx')),
  path.join(home, 'Downloads', 'Hira Inventory -  April 25 updated (1).xlsx'),
  path.join(home, 'Downloads', 'Hira Inventory -  April 25 updated.xlsx'),
].filter(Boolean);

const sheetPath = CANDIDATES.find(p => fs.existsSync(p));
if (!sheetPath) {
  console.error('Could not find the inventory workbook. Looked in:');
  CANDIDATES.forEach(p => console.error('  ' + p));
  console.error('\nPass the path explicitly:  node scripts/extract-photos.mjs "C:/path/to/file.xlsx"');
  process.exit(1);
}

const norm = s => String(s ?? '').replace(/\s+/g, ' ').trim().toLowerCase();

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

/** Pixel dimensions from the file header — JPEG SOF or PNG IHDR. */
function imageSize(buf) {
  const b = Buffer.from(buf);

  if (b.length > 24 && b[0] === 0x89 && b[1] === 0x50) {
    return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
  }

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

const isPhoto = d => !!d && d.w >= MIN_PHOTO_PX && d.h >= MIN_PHOTO_PX;

console.log(`reading ${sheetPath}\n`);
const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile(sheetPath);

const media = new Map();
for (const m of wb.model.media || []) media.set(Number(m.index), m);

/** code -> { buffer, ext, dims, sheet, row }. Later sheets win, as in import-sheet. */
const byCode = new Map();
let anchored = 0;
let unmatched = 0;

for (const ws of wb.worksheets) {
  const headers = {};
  ws.getRow(1).eachCell({ includeEmpty: true }, (cell, i) => {
    const h = norm(cellValue(cell));
    if (h) headers[h] = i;
  });
  const idCol = headers['product id'];
  if (!idCol) continue;

  // Row number -> product code, for this sheet.
  const codeAtRow = new Map();
  for (let r = 2; r <= ws.rowCount; r++) {
    const id = str(cellValue(ws.getRow(r).getCell(idCol)));
    if (!id || norm(id) === 'product id') continue;
    if (!/^[A-Za-z0-9][A-Za-z0-9/_-]{2,19}$/.test(id)) continue;
    codeAtRow.set(r, id);
  }

  for (const img of ws.getImages()) {
    const m = media.get(Number(img.imageId));
    if (!m || !m.buffer) continue;

    // Anchors are zero-based, so worksheet row = tl.row + 1. A picture is
    // usually sized to one cell but can overhang, so the rows it covers are
    // scanned from the top down and the first that names a product wins.
    const top = Math.floor(img.range?.tl?.row ?? 0) + 1;
    const bottom = Math.max(top, Math.ceil(img.range?.br?.row ?? top));

    let code = null;
    for (let r = top; r <= bottom; r++) {
      if (codeAtRow.has(r)) { code = codeAtRow.get(r); break; }
    }
    if (!code) { unmatched++; continue; }

    anchored++;
    byCode.set(code, {
      buffer: m.buffer,
      ext: (m.extension || 'jpeg').toLowerCase(),
      dims: imageSize(m.buffer),
      sheet: ws.name,
      row: top,
    });
  }
}

console.log(`anchored ${anchored} images to ${byCode.size} product codes` +
  (unmatched ? `  (${unmatched} sat on no product row)` : ''));

// ── validate the mapping against photos already known to be right ───────────
//
// If the row anchoring were wrong, photos would land on the wrong products —
// far worse than a missing picture. Every product that already has a good
// photo on disk is a free test case: the workbook image for that code should
// be the same picture, so its dimensions should match.
const dir = path.join(root, 'public/catalog_images');
const onDisk = new Map();
for (const f of fs.readdirSync(dir)) onDisk.set(f.replace(/\.[^.]+$/, ''), f);

// A few sheet rows carry a combined SKU such as "THSE033/34" for a pair listed
// once. It is not a product code the catalogue ever asks for, and writing it
// verbatim would create a directory rather than a file.
for (const code of [...byCode.keys()]) {
  if (!/^[A-Za-z0-9_-]+$/.test(code)) byCode.delete(code);
}

let checked = 0;
let agreed = 0;
const disagreements = [];

for (const [code, got] of byCode) {
  const file = onDisk.get(code);
  if (!file) continue;
  const existing = imageSize(fs.readFileSync(path.join(dir, file)));
  if (!isPhoto(existing) || !isPhoto(got.dims)) continue;
  checked++;
  if (existing.w === got.dims.w && existing.h === got.dims.h) agreed++;
  else disagreements.push({ code, existing, got });
}

const rate = checked ? (agreed / checked) * 100 : 0;
console.log(`mapping check: ${agreed}/${checked} existing photos match the workbook (${rate.toFixed(1)}%)`);
if (disagreements.length) {
  console.log('  differing:');
  for (const d of disagreements.slice(0, 12)) {
    console.log(`    ${d.code.padEnd(9)} on disk ${d.existing.w}x${d.existing.h}   workbook ${d.got.dims.w}x${d.got.dims.h}`);
  }
  if (disagreements.length > 12) console.log(`    ...and ${disagreements.length - 12} more`);
}

// A low agreement rate means the anchoring is not trustworthy on this
// workbook, and writing would scatter wrong photos across the catalogue.
const CONFIDENCE_FLOOR = 90;
if (WRITE && !FORCE && checked >= 20 && rate < CONFIDENCE_FLOOR) {
  console.error(`\nRefusing to write: only ${rate.toFixed(1)}% of known photos matched ` +
    `(need ${CONFIDENCE_FLOOR}%). Wrong photos are worse than missing ones.`);
  process.exit(1);
}

// ── fill the gaps ───────────────────────────────────────────────────────────
const fixes = [];
const additions = [];
const skipped = [];

for (const [code, got] of byCode) {
  if (!isPhoto(got.dims)) { skipped.push({ code, why: 'workbook image is broken too', dims: got.dims }); continue; }

  const file = onDisk.get(code);
  if (!file) { additions.push({ code, got }); continue; }

  const existing = imageSize(fs.readFileSync(path.join(dir, file)));
  if (isPhoto(existing)) {
    if (FORCE) fixes.push({ code, got, existing, file });
    continue;
  }
  fixes.push({ code, got, existing, file });
}

console.log(`\nbroken photos the workbook can repair : ${fixes.length}`);
for (const f of fixes) {
  const was = f.existing ? `${f.existing.w}x${f.existing.h}` : 'unreadable';
  console.log(`  ${f.code.padEnd(9)} ${was.padEnd(10)} -> ${f.got.dims.w}x${f.got.dims.h}  (${f.got.sheet})`);
}

console.log(`products with no photo the workbook can supply : ${additions.length}`);
for (const a of additions.slice(0, 30)) {
  console.log(`  ${a.code.padEnd(9)} ${a.got.dims.w}x${a.got.dims.h}  (${a.got.sheet})`);
}
if (additions.length > 30) console.log(`  ...and ${additions.length - 30} more`);

if (skipped.length) {
  console.log(`broken in the workbook as well : ${skipped.length}`);
  for (const s of skipped) {
    console.log(`  ${s.code.padEnd(9)} ${s.dims ? `${s.dims.w}x${s.dims.h}` : 'unreadable'}  — needs a fresh photograph`);
  }
}

if (!WRITE) {
  console.log('\nNothing written. Re-run with --write to apply.');
  process.exit(0);
}

let written = 0;
for (const { code, got, file } of [...fixes, ...additions]) {
  // The catalogue serves .jpeg for every product; keep that so the build's
  // filename lookup and the committed corrections keep working.
  const target = path.join(dir, file || `${code}.jpeg`);
  fs.writeFileSync(target, Buffer.from(got.buffer));
  written++;
}

console.log(`\nwrote ${written} photos into public/catalog_images`);

// The workbook holds whatever was pasted into it, which is occasionally a
// full-resolution camera file. Nothing here re-encodes — that would mean a
// native image dependency in the catalogue build — but a shopper should not
// be made to download four megabytes for one product, so say which ones need
// shrinking by hand.
const HEAVY_BYTES = 500 * 1024;
const heavy = [...fixes, ...additions]
  .map(({ code, got, file }) => ({ code, bytes: Buffer.from(got.buffer).length, file }))
  .filter(x => x.bytes > HEAVY_BYTES)
  .sort((a, b) => b.bytes - a.bytes);

if (heavy.length) {
  console.log(`\n${heavy.length} of them are large enough to slow a phone down:`);
  for (const h of heavy) {
    console.log(`  ${h.code.padEnd(9)} ${(h.bytes / 1048576).toFixed(1)} MB  — worth resaving around 1200px wide`);
  }
}

console.log('\nRun `npm run catalog` to put the recovered products back on sale.');
