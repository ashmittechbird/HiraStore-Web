/**
 * Replaces product photos with full-resolution originals.
 *
 * The photos on the site were pulled out of the inventory workbook, and Excel
 * keeps only a cell-sized thumbnail of anything pasted into it — the median is
 * 271px wide. Shown on a 3x phone screen that is a 2-4x upscale, which is why
 * the shop looks soft. The originals exist (the store's Drive folder holds
 * multi-megabyte camera files), but they are named by random IDs, not by
 * product code.
 *
 * So each original is matched to a product by what it shows: it is compared
 * against every photo already on the site, which is the same picture at a
 * fraction of the resolution. A photo on the wrong product is worse than a
 * blurry one, so nothing is written on a guess:
 *
 *   - every match is scored, and the runner-up is reported alongside it, so a
 *     close call is visible rather than silently decided;
 *   - side-by-side contact sheets (original | current) are rendered for review;
 *   - only matches listed in an approval file are written.
 *
 *   node scripts/import-photos.mjs <folder>                     # match + sheets
 *   node scripts/import-photos.mjs <folder> --approve <file>    # write approved
 *
 * The approval file is one "CODE  original-filename" pair per line, normally
 * the review list this script prints with the bad lines deleted.
 *
 * Written photos are resized to 1600px on the long edge — enough for a 3x phone
 * and a 2x laptop product page — re-encoded as progressive JPEG, rotated per
 * their EXIF orientation, and stripped of metadata. Phone photos carry GPS
 * coordinates; those never reach a public web server.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const srcDir = args.find(a => !a.startsWith('--'));
const approveIdx = args.indexOf('--approve');
const approveFile = approveIdx >= 0 ? args[approveIdx + 1] : null;

/**
 * --aspect 3:4 crops to the shop card's shape instead of keeping the whole
 * frame. Cards are portrait and crop from the centre, so a landscape original
 * with the piece off to one side loses half the piece in the shop grid — a
 * ring photographed on the right edge came out sliced in two. The crop is
 * placed by sharp's attention strategy, which follows the detailed, high-
 * contrast part of the frame (the jewellery) rather than the middle.
 */
const aspect = (() => {
  const i = args.indexOf('--aspect');
  if (i < 0) return null;
  const [w, h] = String(args[i + 1]).split(':').map(Number);
  return w > 0 && h > 0 ? w / h : null;
})();
const sheetDir = (() => {
  const i = args.indexOf('--sheets');
  return i >= 0 ? args[i + 1] : path.join(root, '.photo-review');
})();

if (!srcDir || !fs.existsSync(srcDir)) {
  console.error('usage: node scripts/import-photos.mjs <folder of originals> [--approve <file>] [--sheets <dir>]');
  process.exit(1);
}

const LONG_EDGE = 1600;
const SIG = 24; // signature side, in pixels

const catalogDir = path.join(root, 'public/catalog_images');
const catalog = JSON.parse(fs.readFileSync(path.join(root, 'src/data/catalog.json'), 'utf8'));
const nameOf = new Map(catalog.map(i => [i.image.replace(/\.[^.]+$/, ''), i]));

/**
 * A small, exposure-normalised colour thumbnail. Each channel is centred and
 * scaled by its own spread, so a brighter or warmer copy of the same photo
 * still lands close — Excel's re-encode shifts tone a little.
 */
async function signature(input) {
  const { data } = await sharp(input)
    .rotate()
    .resize(SIG, SIG, { fit: 'fill' })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const out = new Float32Array(data.length);
  for (let c = 0; c < 3; c++) {
    let sum = 0, sq = 0, n = 0;
    for (let i = c; i < data.length; i += 3) { sum += data[i]; sq += data[i] * data[i]; n++; }
    const mean = sum / n;
    const sd = Math.sqrt(Math.max(sq / n - mean * mean, 1));
    for (let i = c; i < data.length; i += 3) out[i] = (data[i] - mean) / sd;
  }
  return out;
}

function distance(a, b) {
  let d = 0;
  for (let i = 0; i < a.length; i++) d += Math.abs(a[i] - b[i]);
  return d / a.length;
}

const isImage = f => /\.(jpe?g|png|webp|heic|heif|tiff?)$/i.test(f);

function walk(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else if (isImage(e.name)) out.push(p);
  }
  return out;
}

// ── reference set: what is on the site now ──────────────────────────────────
const refs = [];
for (const f of fs.readdirSync(catalogDir)) {
  if (!isImage(f)) continue;
  const code = f.replace(/\.[^.]+$/, '');
  try {
    const meta = await sharp(path.join(catalogDir, f)).metadata();
    if ((meta.width || 0) < 50 || (meta.height || 0) < 50) continue; // the grey slivers
    refs.push({ code, file: f, sig: await signature(path.join(catalogDir, f)), w: meta.width, h: meta.height });
  } catch { /* unreadable — skip */ }
}

// ── originals ───────────────────────────────────────────────────────────────
const seenHash = new Map();
const originals = [];
const undecodable = [];
for (const p of walk(srcDir).sort()) {
  const buf = fs.readFileSync(p);
  const h = crypto.createHash('sha1').update(buf).digest('hex');
  if (seenHash.has(h)) { console.log(`  duplicate skipped: ${path.basename(p)} = ${path.basename(seenHash.get(h))}`); continue; }
  seenHash.set(h, p);
  try {
    const meta = await sharp(buf).rotate().metadata();
    originals.push({ path: p, file: path.basename(p), sig: await signature(buf), w: meta.autoOrient?.width ?? meta.width, h: meta.autoOrient?.height ?? meta.height, mb: buf.length / 1048576 });
  } catch (e) {
    // sharp's prebuilt libvips reads HEIC headers but cannot decode iPhone
    // (HEVC) image data — convert those to JPEG first and point this at both.
    undecodable.push(`${path.basename(p)}  (${String(e.message).split('\n').pop().slice(0, 60)})`);
  }
}
if (undecodable.length) {
  console.log(`\n  could not decode ${undecodable.length} file(s) — convert them to JPEG and re-run:`);
  undecodable.forEach(u => console.log('    ' + u));
}

// ── match ───────────────────────────────────────────────────────────────────
const results = originals.map(o => {
  const scored = refs.map(r => ({ r, d: distance(o.sig, r.sig) })).sort((a, b) => a.d - b.d);
  const [best, second] = scored;
  return { o, best: best.r, d: best.d, runnerUp: second.r, d2: second.d, margin: second.d / Math.max(best.d, 1e-6) };
});

// Two originals claiming one product means at least one of them is wrong.
const claims = new Map();
for (const r of results) claims.set(r.best.code, (claims.get(r.best.code) || 0) + 1);

const verdict = r => {
  if (claims.get(r.best.code) > 1) return 'CONTESTED';
  if (r.d < 0.35 && r.margin > 1.6) return 'strong';
  if (r.d < 0.55 && r.margin > 1.25) return 'likely';
  return 'WEAK';
};

results.sort((a, b) => a.best.code.localeCompare(b.best.code));
console.log(`\noriginals: ${originals.length}   site photos compared against: ${refs.length}\n`);
console.log('  ' + 'code'.padEnd(11) + 'verdict'.padEnd(11) + 'dist'.padStart(6) + 'margin'.padStart(8) + '   original'.padEnd(46) + 'size   now on site');
for (const r of results) {
  const it = nameOf.get(r.best.code);
  console.log('  ' + r.best.code.padEnd(11) + verdict(r).padEnd(11) + r.d.toFixed(2).padStart(6) + r.margin.toFixed(2).padStart(8) +
    '   ' + r.o.file.slice(0, 42).padEnd(43) + `${r.o.w}x${r.o.h}`.padEnd(11) + `${r.best.w}x${r.best.h}  ${(it?.item_name || '').slice(0, 30)}`);
}

// ── contact sheets ──────────────────────────────────────────────────────────
fs.mkdirSync(sheetDir, { recursive: true });
const TILE = 300, LABEL = 46, PER_SHEET = 8;
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

for (let s = 0; s * PER_SHEET < results.length; s++) {
  const page = results.slice(s * PER_SHEET, (s + 1) * PER_SHEET);
  const W = TILE * 2 + 30, H = (TILE + LABEL) * page.length;
  const layers = [];
  for (let i = 0; i < page.length; i++) {
    const r = page[i];
    const y = i * (TILE + LABEL);
    const left = await sharp(r.o.path).rotate().resize(TILE, TILE, { fit: 'contain', background: '#ffffff' }).jpeg().toBuffer();
    const right = await sharp(path.join(catalogDir, r.best.file)).resize(TILE, TILE, { fit: 'contain', background: '#ffffff' }).jpeg().toBuffer();
    layers.push({ input: left, left: 0, top: y + LABEL });
    layers.push({ input: right, left: TILE + 30, top: y + LABEL });
    const txt = `${r.best.code}  ${verdict(r)}  d=${r.d.toFixed(2)} m=${r.margin.toFixed(2)}`;
    const sub = `${r.o.file.slice(0, 40)}  ->  ${(nameOf.get(r.best.code)?.item_name || '').slice(0, 34)}`;
    layers.push({
      input: Buffer.from(`<svg width="${W}" height="${LABEL}"><rect width="100%" height="100%" fill="#f2f2f2"/>` +
        `<text x="8" y="19" font-family="Arial" font-size="16" font-weight="bold" fill="${verdict(r) === 'strong' ? '#14632f' : '#a3341c'}">${esc(txt)}</text>` +
        `<text x="8" y="38" font-family="Arial" font-size="12" fill="#333">${esc(sub)}</text></svg>`),
      left: 0, top: y,
    });
  }
  const out = path.join(sheetDir, `review-${String(s + 1).padStart(2, '0')}.jpg`);
  await sharp({ create: { width: W, height: H, channels: 3, background: '#ffffff' } }).composite(layers).jpeg({ quality: 80 }).toFile(out);
}
console.log(`\ncontact sheets (original | current site photo): ${sheetDir}`);

// ── write approved matches ──────────────────────────────────────────────────
if (!approveFile) {
  console.log('\nNothing written. Review the sheets, then re-run with --approve <file>.');
  process.exit(0);
}

const byFile = new Map(originals.map(o => [o.file, o]));
const approved = fs.readFileSync(approveFile, 'utf8').split(/\r?\n/)
  .map(l => l.replace(/#.*$/, '').trim()).filter(Boolean)
  .map(l => l.split(/\s+/));

let written = 0;
for (const [code, file] of approved) {
  const o = byFile.get(file);
  const target = nameOf.get(code)?.image || `${code}.jpeg`;
  if (!o) { console.error(`  no original named ${file} — skipped ${code}`); continue; }
  const before = fs.existsSync(path.join(catalogDir, target)) ? (await sharp(path.join(catalogDir, target)).metadata()) : null;
  let pipeline = sharp(o.path).rotate();
  if (aspect) {
    // Largest crop of that shape the original can give, capped at LONG_EDGE.
    let h = Math.min(o.h, LONG_EDGE);
    let w = Math.round(h * aspect);
    if (w > o.w) { w = o.w; h = Math.round(w / aspect); }
    pipeline = pipeline.resize(w, h, { fit: 'cover', position: sharp.strategy.attention });
  } else {
    pipeline = pipeline.resize(LONG_EDGE, LONG_EDGE, { fit: 'inside', withoutEnlargement: true });
  }
  await pipeline
    .jpeg({ quality: 82, progressive: true, mozjpeg: true })
    .toFile(path.join(catalogDir, target));
  const after = await sharp(path.join(catalogDir, target)).metadata();
  const kb = fs.statSync(path.join(catalogDir, target)).size / 1024;
  console.log(`  ${code.padEnd(10)} ${before ? `${before.width}x${before.height}` : 'none'} -> ${after.width}x${after.height}  ${kb.toFixed(0)}KB`);
  written++;
}
console.log(`\nwrote ${written} photos. Run \`npm run photos:audit\` and \`npm run catalog\`.`);
