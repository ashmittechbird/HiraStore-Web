/**
 * Frappe reverse proxy for Vercel.
 *
 * The storefront talks to its backend at same-origin `/api/method/...` and
 * `/files/...`. In development Vite's proxy handles that; in production on
 * Vercel this function does, which also keeps Frappe's session cookie
 * first-party (a cross-origin call would have it dropped).
 *
 * With FRAPPE_URL unset it answers 503 straight away. The app reads that as
 * "no backend" and serves its bundled catalogue, so a deploy with no
 * environment variables configured is still a fully working storefront.
 */

const BACKEND = process.env.FRAPPE_URL || process.env.VITE_FRAPPE_URL || '';

// Hop-by-hop headers must not be forwarded.
const STRIP_REQUEST = new Set(['host', 'connection', 'content-length', 'accept-encoding']);
const STRIP_RESPONSE = new Set([
  'content-encoding', 'content-length', 'transfer-encoding', 'connection', 'keep-alive',
]);

export default async function handler(req, res) {
  if (!BACKEND) {
    res.status(503).json({
      error: 'no_backend',
      message:
        'No Frappe backend is configured. Set FRAPPE_URL in the Vercel project ' +
        'environment to connect one; until then the storefront runs on its bundled catalogue.',
    });
    return;
  }

  // vercel.json sends /files/* here as /api/files/*, but Frappe serves those at
  // /files/*. Everything else (/api/method/*, /api/resource/*) already matches
  // Frappe's own routes and passes through unchanged.
  const incoming = req.url.startsWith('/api/files/') ? req.url.slice(4) : req.url;

  const base = new URL(BACKEND);
  const target = new URL(incoming, BACKEND);
  target.protocol = base.protocol;
  target.host = base.host;
  target.port = base.port;

  const headers = {};
  for (const [k, v] of Object.entries(req.headers)) {
    if (!STRIP_REQUEST.has(k.toLowerCase())) headers[k] = v;
  }
  // Frappe routes by Host; point it at the site we're proxying to.
  headers.host = base.host;

  let body;
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    body = typeof req.body === 'string' || Buffer.isBuffer(req.body)
      ? req.body
      : req.body != null
        ? JSON.stringify(req.body)
        : undefined;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const upstream = await fetch(target.toString(), {
      method: req.method,
      headers,
      body,
      redirect: 'manual',
      signal: controller.signal,
    });

    upstream.headers.forEach((value, key) => {
      if (STRIP_RESPONSE.has(key.toLowerCase())) return;
      // set-cookie needs append so multiple cookies survive.
      if (key.toLowerCase() === 'set-cookie') return;
      res.setHeader(key, value);
    });

    const cookies = typeof upstream.headers.getSetCookie === 'function'
      ? upstream.headers.getSetCookie()
      : [upstream.headers.get('set-cookie')].filter(Boolean);
    if (cookies.length) res.setHeader('set-cookie', cookies);

    res.status(upstream.status);
    res.send(Buffer.from(await upstream.arrayBuffer()));
  } catch (e) {
    res.status(502).json({
      error: 'backend_unreachable',
      message: `Could not reach the Frappe backend: ${e?.message || e}`,
    });
  } finally {
    clearTimeout(timeout);
  }
}
