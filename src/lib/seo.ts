import { useEffect } from 'react';
import {
  DEFAULT_TITLE, DEFAULT_DESCRIPTION, DEFAULT_IMAGE, SITE_NAME,
  absoluteUrl, canonicalUrl,
} from './structuredData.mjs';

export interface Seo {
  /** Page title without the store name; omit for the home page. */
  title?: string;
  description?: string;
  /** Path the page is canonical at, e.g. '/product/THSN023'. Query included when it matters. */
  path?: string;
  image?: string;
  type?: 'website' | 'product';
  /** Pages with nothing for a search result: cart, checkout, account, search results. */
  noindex?: boolean;
  /** schema.org objects, written as one ld+json block. */
  jsonLd?: object | object[];
  /** Extra <meta property> pairs, e.g. product:price:amount. */
  meta?: Record<string, string>;
}

// Marks what belongs to one page rather than the whole site, so the next page
// can clear it. scripts/prerender.mjs writes the same marks into the static
// copies, which is how the app takes over from them without duplicating them.
const PAGE_LD = 'data-page-ld';
const EXTRA = 'data-page-meta';

function setMeta(attr: 'name' | 'property', key: string, value: string | undefined) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!value) { el?.remove(); return; }
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.content = value;
}

function setCanonical(href: string | undefined) {
  let el = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!href) { el?.remove(); return; }
  if (!el) {
    el = document.createElement('link');
    el.rel = 'canonical';
    document.head.appendChild(el);
  }
  el.href = href;
}

/**
 * Title, description, canonical, link-preview tags and structured data for the
 * current page.
 *
 * The app is a single page, so without this every URL carried the home page's
 * title and canonical — Google was told 250 product pages were all duplicates
 * of '/'. Every route calls it, so tags never leak from the previous page.
 * The static copies written by scripts/prerender.mjs carry the same values for
 * crawlers that don't run JavaScript.
 */
export function useSeo(seo: Seo | null) {
  const key = JSON.stringify(seo);
  useEffect(() => {
    // null: the page is still loading what it describes. Leave the tags alone —
    // on a prerendered page they are already right, and wiping them while the
    // product loads would hand a crawler that snapshots early a blank page.
    if (!seo) return;
    const title = seo.title ? `${seo.title} | ${SITE_NAME}` : DEFAULT_TITLE;
    const description = seo.description || DEFAULT_DESCRIPTION;
    const url = seo.path === undefined ? undefined
      : seo.path === '/' ? canonicalUrl('/')
      : canonicalUrl(seo.path.split('?')[0], seo.path.includes('?') ? '?' + seo.path.split('?')[1] : '');
    const image = absoluteUrl(seo.image || DEFAULT_IMAGE);

    document.title = title;
    setMeta('name', 'description', description);
    setMeta('name', 'robots', seo.noindex ? 'noindex, follow' : undefined);
    setCanonical(seo.noindex ? undefined : url);

    setMeta('property', 'og:type', seo.type || 'website');
    setMeta('property', 'og:title', title);
    setMeta('property', 'og:description', description);
    setMeta('property', 'og:url', url);
    setMeta('property', 'og:image', image);
    if (seo.image) {
      // Size and alt text in index.html describe the default image only.
      for (const k of ['og:image:width', 'og:image:height', 'og:image:alt']) setMeta('property', k, undefined);
    }
    setMeta('name', 'twitter:title', title);
    setMeta('name', 'twitter:description', description);
    setMeta('name', 'twitter:image', image);

    document.head.querySelectorAll(`meta[${EXTRA}]`).forEach(el => el.remove());
    for (const [k, v] of Object.entries(seo.meta || {})) {
      const el = document.createElement('meta');
      el.setAttribute('property', k);
      el.setAttribute(EXTRA, '');
      el.content = v;
      document.head.appendChild(el);
    }

    document.head.querySelectorAll(`script[${PAGE_LD}]`).forEach(el => el.remove());
    if (seo.jsonLd) {
      const s = document.createElement('script');
      s.type = 'application/ld+json';
      s.setAttribute(PAGE_LD, '');
      s.textContent = JSON.stringify(seo.jsonLd).replace(/</g, '\\u003c');
      document.head.appendChild(s);
    }
  }, [key]);
}

/** useSeo as an element, for routes whose page needs nothing dynamic. */
export function Seo(props: Seo) {
  useSeo(props);
  return null;
}
