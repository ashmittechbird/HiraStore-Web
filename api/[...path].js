/**
 * Frappe reverse proxy for Vercel.
 *
 * Serves the whole backend under this domain, same-origin:
 *
 *   /api/*      REST + whitelisted methods used by the storefront
 *   /files/*    public files (product images, homepage_config.json)
 *   /private/*  private files, behind Frappe's own permission checks
 *   /assets/*   Frappe/ERPNext desk assets  (the storefront's own bundles
 *               live under /static/* so the two don't collide)
 *   /app/*      the ERPNext desk UI
 *   /logout      ends the Frappe session
 *
 * Same-origin matters: Frappe's session cookie is what authenticates both the
 * storefront and the desk, and a cross-origin call would have it dropped as
 * third-party.
 *
 * With FRAPPE_URL unset this answers immediately rather than hanging — JSON for
 * API paths, a short explanatory page for the desk — and the storefront reads
 * that as "no backend" and serves its bundled catalogue.
 */

const BACKEND = process.env.FRAPPE_URL || process.env.VITE_FRAPPE_URL || '';

/**
 * Multi-tenant benches pick the site from the Host header. Set FRAPPE_SITE_NAME
 * when the site is not named after the host you're pointing at (e.g. a bench
 * reached by IP that serves `hirastore.local`).
 */
const SITE_NAME = process.env.FRAPPE_SITE_NAME || '';

// Hop-by-hop headers, and anything the runtime must recalculate.
const STRIP_REQUEST = new Set(['host', 'connection', 'content-length', 'accept-encoding']);
const STRIP_RESPONSE = new Set([
  'content-encoding', 'content-length', 'transfer-encoding', 'connection', 'keep-alive',
]);

// Requests arrive here already rewritten to /api/<original>, so match both forms.
const DESK_PATHS = /^\/(api\/)?(app|assets)(\/|$|\?)/;

function notConfigured(req, res) {
  const wantsHtml = DESK_PATHS.test(req.url) && (req.headers.accept || '').includes('text/html');

  if (!wantsHtml) {
    res.status(503).json({
      error: 'no_backend',
      message:
        'No Frappe backend is configured. Set FRAPPE_URL in the Vercel project ' +
        'environment to connect one; until then the storefront runs on its bundled catalogue.',
    });
    return;
  }

  res.status(503).setHeader('content-type', 'text/html; charset=utf-8');
  res.send(`<!doctype html>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Backend not connected</title>
<style>
  body{margin:0;min-height:100vh;display:grid;place-items:center;background:#fdfbf6;
       font:16px/1.6 'DM Sans',system-ui,sans-serif;color:#25454a;padding:24px}
  .c{max-width:520px}
  h1{font:400 28px/1.3 'Playfair Display',Georgia,serif;color:#005969;margin:0 0 12px}
  p{color:#5b7a80;font-size:14.5px;margin:0 0 14px}
  code{background:#f2fafb;border:1px solid #e0f0f2;border-radius:5px;padding:2px 6px;
       font:13px ui-monospace,Menlo,monospace;color:#005969}
  a{color:#005969}
</style>
<div class="c">
  <h1>The admin backend isn't connected yet</h1>
  <p>This address serves the ERPNext desk, which needs a running Frappe site behind it.
     No backend is configured for this deployment.</p>
  <p>To connect one, set <code>FRAPPE_URL</code> in the Vercel project's environment
     variables to a publicly reachable Frappe address, then redeploy. A private LAN
     address will not work — Vercel has to be able to reach it over the internet.</p>
  <p><a href="/">← Back to the store</a></p>
</div>`);
}

export default async function handler(req, res) {
  if (!BACKEND) return notConfigured(req, res);

  // vercel.json routes /files/* and /app/* etc. here as /api/<original path>.
  // Strip that wrapper so Frappe sees its own routes unchanged.
  const incoming = req.url.replace(/^\/api\/(?=(files|private|assets|app|logout)(\/|$))/, '/');

  const base = new URL(BACKEND);
  const target = new URL(incoming, BACKEND);
  target.protocol = base.protocol;
  target.host = base.host;
  target.port = base.port;

  const headers = {};
  for (const [k, v] of Object.entries(req.headers)) {
    if (!STRIP_REQUEST.has(k.toLowerCase())) headers[k] = v;
  }
  headers.host = SITE_NAME || base.host;

  let body;
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    body = typeof req.body === 'string' || Buffer.isBuffer(req.body)
      ? req.body
      : req.body != null
        ? JSON.stringify(req.body)
        : undefined;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);

  try {
    const upstream = await fetch(target.toString(), {
      method: req.method,
      headers,
      body,
      // Let the browser follow redirects so Frappe's own login flow works.
      redirect: 'manual',
      signal: controller.signal,
    });

    upstream.headers.forEach((value, key) => {
      const k = key.toLowerCase();
      if (STRIP_RESPONSE.has(k) || k === 'set-cookie') return;
      // Rewrite absolute redirects back onto this domain so the desk's login
      // round-trip doesn't bounce the user to the bench's own hostname.
      if (k === 'location') {
        try {
          const loc = new URL(value, BACKEND);
          if (loc.host === base.host) return res.setHeader('location', loc.pathname + loc.search);
        } catch { /* relative Location — pass through */ }
      }
      res.setHeader(key, value);
    });

    // Session cookies are the whole point of proxying; keep every one, and drop
    // any Domain attribute so they bind to this host instead of the bench's.
    const cookies = typeof upstream.headers.getSetCookie === 'function'
      ? upstream.headers.getSetCookie()
      : [upstream.headers.get('set-cookie')].filter(Boolean);
    if (cookies.length) {
      res.setHeader('set-cookie', cookies.map(c => c.replace(/;\s*Domain=[^;]*/i, '')));
    }

    res.status(upstream.status);
    res.send(Buffer.from(await upstream.arrayBuffer()));
  } catch (e) {
    const aborted = e?.name === 'AbortError';
    res.status(504).json({
      error: aborted ? 'backend_timeout' : 'backend_unreachable',
      message: aborted
        ? 'The Frappe backend did not respond in time.'
        : `Could not reach the Frappe backend: ${e?.message || e}`,
    });
  } finally {
    clearTimeout(timeout);
  }
}
