/**
 * Contact channels shown in the floating action bar.
 *
 * The WhatsApp number is whatever the admin saved under Settings → Social
 * Media, so the store can change it without a deploy. It accepts either a bare
 * number or a full wa.me link.
 */

const WHATSAPP_KEY = 'hs_sm_whatsapp';

/**
 * The store's WhatsApp line, in full international form.
 *
 * Baked in so the button works on any deploy without configuration; the admin's
 * Settings value still wins when one is saved. 972-655-6599 is a US number, so
 * it carries country code 1 — WhatsApp needs the country code and no symbols.
 */
const STORE_WHATSAPP = '19726556599';

const DEFAULT_WHATSAPP =
  (import.meta.env.VITE_WHATSAPP_NUMBER as string | undefined) || STORE_WHATSAPP;

/** Digits only — what wa.me expects, country code included, no +. */
export function whatsappNumber(): string {
  const raw = (() => {
    try {
      return localStorage.getItem(WHATSAPP_KEY) || DEFAULT_WHATSAPP || '';
    } catch {
      return DEFAULT_WHATSAPP || '';
    }
  })();
  if (!raw) return '';

  // Accept https://wa.me/9198..., wa.me/9198..., +91 98..., or 9198...
  const fromUrl = raw.match(/wa\.me\/(\d+)/)?.[1];
  const digits = fromUrl ?? raw.replace(/\D/g, '');
  return digits.length >= 8 ? digits : '';
}

/** Deep link that opens WhatsApp with the message pre-filled. */
export function whatsappLink(message?: string): string {
  const num = whatsappNumber();
  if (!num) return '';
  const text = encodeURIComponent(
    message || "Hi! I'd like to know more about your jewellery."
  );
  return `https://wa.me/${num}?text=${text}`;
}

/** Time slots offered for a video call, if the backend doesn't supply its own. */
export const FALLBACK_SLOTS = [
  '10:00 AM - 11:00 AM',
  '11:00 AM - 12:00 PM',
  '12:00 PM - 01:00 PM',
  '02:00 PM - 03:00 PM',
  '03:00 PM - 04:00 PM',
  '04:00 PM - 05:00 PM',
  '05:00 PM - 06:00 PM',
  '06:00 PM - 07:00 PM',
];

// ─── Instagram ───────────────────────────────────────────────────────────────

/**
 * The store's Instagram handle.
 *
 * Baked in for the same reason as the WhatsApp number: the previous value lived
 * only in localStorage under `hs_sm_instagram`, which is per-browser. Setting it
 * in Admin on one laptop linked it for that laptop and nobody else — every
 * visitor saw no Instagram link at all, and it had to be re-entered after any
 * cache clear or on any new device.
 *
 * A saved Admin value still wins, so a handle change needs no deploy.
 */
const STORE_INSTAGRAM = 'thehirastore';

const INSTAGRAM_KEY = 'hs_sm_instagram';

const DEFAULT_INSTAGRAM =
  (import.meta.env.VITE_INSTAGRAM_HANDLE as string | undefined) || STORE_INSTAGRAM;

/**
 * Handle only — no @, no URL, no query string.
 *
 * Accepts whatever Admin holds: a bare handle, a profile URL, or a URL carrying
 * the `?stkn=` share token Instagram appends when you copy a link from the app.
 * That token belongs to the session that copied it and must never be published,
 * so it is stripped here rather than trusted not to appear.
 */
export function instagramHandle(): string {
  const raw = (() => {
    try {
      return localStorage.getItem(INSTAGRAM_KEY) || DEFAULT_INSTAGRAM;
    } catch {
      return DEFAULT_INSTAGRAM;
    }
  })();

  return String(raw || '')
    .trim()
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, '')
    .replace(/[?#].*$/, '')
    .replace(/^@/, '')
    .replace(/\/+$/, '');
}

/** Canonical profile URL. Empty only if the handle has been cleared outright. */
export function instagramUrl(): string {
  const handle = instagramHandle();
  return handle ? `https://www.instagram.com/${handle}/` : '';
}

/**
 * Posts shown in "Spotted in Hira" before anyone curates the section.
 *
 * Read from the public profile, so the section has the store's own work in it
 * on a fresh deploy instead of four stock portraits. Photo posts rather than
 * reels: the grid is square and a reel embed arrives letterboxed.
 *
 * Whatever the admin publishes replaces this outright. Instagram renders each
 * one, so editing or removing a post there changes the site with nothing to do
 * here — but a post added there does NOT appear here on its own. That needs the
 * Graph API and a token the shop has to issue.
 */
export const DEFAULT_IG_POSTS = [
  'https://www.instagram.com/p/DcsHwoURNkc/',
  'https://www.instagram.com/p/DcTkiWrsOST/',
  'https://www.instagram.com/p/DbyelPNu5S8/',
  'https://www.instagram.com/p/DbUTkaemlQM/',
  'https://www.instagram.com/p/DbOcHPOB3Kl/',
  'https://www.instagram.com/p/Da9Lx_Puvt_/',
];
