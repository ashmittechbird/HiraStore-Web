/**
 * Contact channels shown in the floating action bar.
 *
 * The WhatsApp number is whatever the admin saved under Settings → Social
 * Media, so the store can change it without a deploy. It accepts either a bare
 * number or a full wa.me link.
 */

const WHATSAPP_KEY = 'hs_sm_whatsapp';

/** Fallback used when the admin hasn't configured a number yet. */
const DEFAULT_WHATSAPP = import.meta.env.VITE_WHATSAPP_NUMBER as string | undefined;

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
