/**
 * The shop's categories, taken from the products themselves.
 *
 * They used to be a hardcoded list of eight, repeated in five files — the shop
 * filter row, the desktop and mobile navs, the footer and the admin dropdown.
 * That list was also all the sheet's 25 categories were collapsed onto, so
 * anklets, toe rings, hip belts, arm cuffs, watch sliders, bags, charms, hair
 * accessories and home articles were every one of them filed under
 * "Accessories", and a customer had no way to find them.
 *
 * Now the catalogue carries the sheet's own category on each item and the menus
 * are derived from what is actually in stock. A new category in the sheet
 * appears in the shop by itself, and one that sells out stops being offered.
 */

import { getStorefrontItems } from './backend';

/** The sheet groups ten small lines under this prefix; menus nest them. */
export const ACCESSORY_PREFIX = 'Accessories - ';

export interface CategoryCount {
  name: string;
  count: number;
}

export interface HasGroup {
  item_group?: string;
  category?: string;
}

export function categoryOf(item: HasGroup): string {
  return (item.item_group || item.category || '').trim();
}

/**
 * Categories present in a set of products, commonest first, with the
 * "Accessories - …" family held together at the end.
 *
 * Ordering by stock rather than by a fixed list means the busiest tabs are the
 * ones nearest to hand, and nothing has to be edited when the sheet changes.
 */
export function categoriesOf(items: HasGroup[]): CategoryCount[] {
  const counts = new Map<string, number>();
  for (const it of items) {
    const c = categoryOf(it);
    if (c) counts.set(c, (counts.get(c) || 0) + 1);
  }

  const rows = [...counts.entries()].map(([name, count]) => ({ name, count }));
  return rows.sort((a, b) => {
    const acc = (r: CategoryCount) => (r.name.startsWith(ACCESSORY_PREFIX) ? 1 : 0);
    return acc(a) - acc(b) || b.count - a.count || a.name.localeCompare(b.name);
  });
}

/** Everything that isn't part of the Accessories family. */
export function mainCategories(cats: CategoryCount[]): CategoryCount[] {
  return cats.filter(c => !c.name.startsWith(ACCESSORY_PREFIX));
}

/** The Accessories family, with the prefix stripped for display. */
export function accessoryCategories(cats: CategoryCount[]): Array<CategoryCount & { label: string }> {
  return cats
    .filter(c => c.name.startsWith(ACCESSORY_PREFIX))
    .map(c => ({ ...c, label: c.name.slice(ACCESSORY_PREFIX.length) }));
}

/** Link target for a category tab. */
export function categoryHref(name: string): string {
  return `/shop?cat=${encodeURIComponent(name)}`;
}

// ─── shared menu source ──────────────────────────────────────────────────────

/**
 * The navbar and footer both want the category list on every page. One
 * in-flight promise is shared between them and reused for the session, so the
 * menus cost a single request rather than one per component per navigation.
 *
 * Imported statically. This was a dynamic `import('./backend')`, which bought
 * nothing — the navbar renders on every page and thirteen other modules import
 * backend directly, so it was always already in the main chunk. All it did was
 * make every build print a warning about a chunk that could not be split.
 */
let pending: Promise<CategoryCount[]> | null = null;

export function loadCategories(): Promise<CategoryCount[]> {
  if (!pending) {
    pending = getStorefrontItems(500)
      .then(items => categoriesOf(items as HasGroup[]))
      // A menu is not worth breaking a page over; an empty list just renders
      // the static links and the next navigation tries again.
      .catch(() => { pending = null; return []; });
  }
  return pending;
}
