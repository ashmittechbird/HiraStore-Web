/**
 * Where to send someone after they sign in or sign up.
 *
 * `?return=` comes from the URL, so it is attacker-controlled. On a shop with a
 * login page an open redirect is a phishing route: send a customer
 * `…/login?return=<somewhere else>`, they sign in on the real site, and land on
 * a lookalike asking for their card.
 *
 * Checking the string is where this goes wrong. `startsWith('/')` lets through
 * `//evil.example`, which is protocol-relative and leaves the site. Adding
 * `!startsWith('//')` still lets through `/\evil.example`, because browsers
 * normalise backslashes to forward slashes in URLs — that is the bypass behind
 * React Router's own open-redirect advisory (GHSA-wrjc-x8rr-h8h6).
 *
 * So don't inspect the string. Resolve it against a base the result must match:
 * anything that escapes — an absolute URL, either slash spelling, a
 * `javascript:` URL — resolves to a different origin and is refused. Only the
 * path, query and hash survive, so the redirect cannot leave this site.
 */
const SENTINEL = 'https://return-path.invalid';

export function safeReturnPath(search: string, fallback = '/account'): string {
  const raw = new URLSearchParams(search).get('return');
  if (!raw) return fallback;

  let url: URL;
  try {
    url = new URL(raw, SENTINEL);
  } catch {
    return fallback;
  }

  if (url.origin !== SENTINEL) return fallback;
  return url.pathname + url.search + url.hash;
}
