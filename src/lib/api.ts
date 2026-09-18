// Single source of truth for where product photos live — see lib/config.ts.
import { CATALOG_BASE } from './config';

// Frappe file URLs (/files/...) are same-origin: the Vite proxy handles them in
// development, api/[...path].js on Vercel.
const ERP_BASE = '';

export function itemImage(item: { image?: string; name?: string; product_id?: string }) {
  if (!item.image) {
    const id = item.name || item.product_id;
    if (id) return `${CATALOG_BASE}/${id}.jpeg`;
    return `${import.meta.env.BASE_URL}site-images/product-fallback.jpg`;
  }
  if (item.image.startsWith('http')) return item.image;
  if (item.image.startsWith('/files/')) return `${ERP_BASE}${item.image}`;
  return `${CATALOG_BASE}/${item.image}`;
}

// Returns array of all product images.
// Uses custom_item_images (JSON array) from ERPNext if set, else repeats main image 4x.
/**
 * Every distinct photo for a product — one entry when there is only one.
 *
 * This used to pad the list out to four by repeating the same file, so a
 * product with a single photograph rendered a gallery of four identical
 * thumbnails and a carousel that appeared to move through nothing. Today that
 * is every product in the catalogue: 287 items, 287 photos, none with extras.
 *
 * Callers should treat `length === 1` as "no gallery" and hide the thumbnails,
 * dots and swipe affordance rather than showing controls that do nothing.
 */
export function itemImages(item: { image?: string; custom_item_images?: string }): string[] {
  const fallback = itemImage(item);

  if (item.custom_item_images) {
    try {
      const arr = JSON.parse(item.custom_item_images);
      if (Array.isArray(arr) && arr.length > 0) {
        const urls = arr
          .filter(Boolean)
          .map((img: string) => {
            if (img.startsWith('http')) return img;
            if (img.startsWith('/files/')) return `${ERP_BASE}${img}`;
            return `${CATALOG_BASE}/${img}`;
          });
        const unique = [...new Set([fallback, ...urls])];
        if (unique.length) return unique;
      }
    } catch {
      // Malformed JSON in the admin field shouldn't cost the product its photo.
    }
  }

  return [fallback];
}

export function itemPrice(item: { standard_rate?: number; price_usd?: number; price?: number }) {
  return item.standard_rate || item.price_usd || item.price || 0;
}

export function itemName(item: { item_name?: string; name?: string }) {
  return item.item_name || item.name || '';
}

export function itemCategory(item: { item_group?: string; category?: string }) {
  return item.item_group || item.category || '';
}

export function itemId(item: { name?: string; product_id?: string }) {
  return item.name || item.product_id || '';
}
