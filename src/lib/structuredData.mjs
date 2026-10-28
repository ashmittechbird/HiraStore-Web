/**
 * What search engines, link previews and AI crawlers are told about a page.
 *
 * Shared by the running app (lib/seo.ts sets these on every navigation) and by
 * scripts/prerender.mjs, which bakes them into a static HTML file per product
 * at build time. Plain JavaScript on purpose: the build runs it under bare
 * Node, which cannot load TypeScript or the '@/' alias. Types live beside it
 * in structuredData.d.mts.
 *
 * Two audiences read this, and neither runs JavaScript reliably — WhatsApp and
 * Instagram link previews never do, nor do most AI crawlers. Google does, but
 * late. So the same facts have to come out of both paths, which is why they are
 * built here once rather than written twice.
 */

export const SITE_URL = 'https://hirastore.techbirdit.in';
export const SITE_NAME = 'The Hira Store';
export const DEFAULT_TITLE = 'The Hira Store | Everyday Fine Jewelry';
export const DEFAULT_DESCRIPTION =
  'Handcrafted silver and fine jewelry for every day — earrings, necklaces, bangles, pendants and more. Ships from San Jose, CA; free US shipping over $100.';
export const DEFAULT_IMAGE = '/site-images/og-default.jpg';
export const INSTAGRAM_URL = 'https://www.instagram.com/thehirastore/';
export const CONTACT_EMAIL = 'info@Thehirastore.com';

/** Mirrors FREE_SHIPPING_OVER / SHIPPING_FLAT in lib/config.ts. */
const FREE_SHIPPING_OVER = 100;
const SHIPPING_FLAT = 5;

/** Returns window, confirmed by the owner. Mirrors POLICY in app/help/page.tsx. */
const RETURN_DAYS = 30;

const ACCESSORY_PREFIX = 'Accessories - ';

/**
 * Absolute URL for a path on the site.
 *
 * Every indexable page except the home page is canonical *with* a trailing
 * slash. The build writes each one as <path>/index.html, and nginx answers a
 * request for the bare path with a 301 to the slashed one — so the slashed URL
 * is the one that returns 200, and a canonical must never point at a redirect.
 */
export function canonicalUrl(pathname, search = '') {
  let p = pathname || '/';
  if (!p.startsWith('/')) p = '/' + p;
  if (!p.endsWith('/')) p += '/';
  return SITE_URL + p + (search || '');
}

/** Absolute form of a URL the app built relative to the site (photos, mostly). */
export function absoluteUrl(src) {
  if (!src) return SITE_URL + DEFAULT_IMAGE;
  if (/^https?:\/\//.test(src)) return src;
  return SITE_URL + (src.startsWith('/') ? src : '/' + src);
}

/** "Accessories - Ring" reads as "Ring" everywhere a shopper sees it. */
export function displayCategory(group) {
  const g = String(group || '');
  return g.startsWith(ACCESSORY_PREFIX) ? g.slice(ACCESSORY_PREFIX.length) : g;
}

export function shippingFor(price) {
  return Number(price) >= FREE_SHIPPING_OVER ? 0 : SHIPPING_FLAT;
}

function clip(s, n) {
  const t = String(s).replace(/\s+/g, ' ').trim();
  return t.length <= n ? t : t.slice(0, n - 1).replace(/\s+\S*$/, '') + '…';
}

/**
 * A meta description for a product.
 *
 * About a third of the catalogue has no description, and many of the rest
 * repeat the product name word for word. Either way the result would be a
 * snippet that says nothing, so the price, category and shipping fill it out.
 */
export function productDescription(item) {
  const name = String(item.item_name || item.name || '').trim();
  const cat = displayCategory(item.item_group).toLowerCase();
  const own = String(item.custom_short_description || '').trim();
  const price = Number(item.standard_rate) || 0;
  const tail = `Handcrafted ${cat || 'jewelry'} from ${SITE_NAME}, $${price.toLocaleString('en-US')}.` +
    (price >= FREE_SHIPPING_OVER ? ' Free US shipping.' : ' Ships from San Jose, CA.');
  const lead = own && own.toLowerCase() !== name.toLowerCase() ? own : name;
  return clip(`${lead}. ${tail}`, 300);
}

/** "<name> | <category>"; the store name is appended by whoever writes the tag. */
export function productTitle(item) {
  const name = String(item.item_name || item.name || '').trim();
  const cat = displayCategory(item.item_group);
  return cat ? `${name} | ${cat}` : name;
}

export function organizationLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': SITE_URL + '/#organization',
    name: SITE_NAME,
    url: SITE_URL + '/',
    logo: SITE_URL + '/icon-512.png',
    email: CONTACT_EMAIL,
    sameAs: [INSTAGRAM_URL],
    address: { '@type': 'PostalAddress', addressLocality: 'San Jose', addressRegion: 'CA', addressCountry: 'US' },
  };
}

export function websiteLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': SITE_URL + '/#website',
    name: SITE_NAME,
    url: SITE_URL + '/',
    publisher: { '@id': SITE_URL + '/#organization' },
    potentialAction: {
      '@type': 'SearchAction',
      target: { '@type': 'EntryPoint', urlTemplate: SITE_URL + '/shop/?search={search_term_string}' },
      'query-input': 'required name=search_term_string',
    },
  };
}

/** trail: [{ name, path }] from the home page down to the current page. */
export function breadcrumbLd(trail) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((t, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: t.name,
      item: t.path === '/' ? SITE_URL + '/' : canonicalUrl(t.path.split('?')[0], t.path.includes('?') ? '?' + t.path.split('?')[1] : ''),
    })),
  };
}

/**
 * schema.org Product for one piece — what makes Google show the price and
 * stock under the result, and what Merchant listings read.
 *
 * images: absolute URLs, main photo first.
 */
export function productLd(item, images) {
  const price = Number(item.standard_rate) || 0;
  const url = canonicalUrl('/product/' + encodeURIComponent(item.name));
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    '@id': url + '#product',
    name: String(item.item_name || item.name),
    sku: item.name,
    mpn: item.name,
    image: images,
    description: productDescription(item),
    category: displayCategory(item.item_group),
    brand: { '@type': 'Brand', name: SITE_NAME },
    url,
    offers: {
      '@type': 'Offer',
      url,
      priceCurrency: 'USD',
      price: price.toFixed(2),
      availability: 'https://schema.org/InStock',
      itemCondition: 'https://schema.org/NewCondition',
      seller: { '@id': SITE_URL + '/#organization' },
      hasMerchantReturnPolicy: {
        '@type': 'MerchantReturnPolicy',
        applicableCountry: 'US',
        returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow',
        merchantReturnDays: RETURN_DAYS,
        returnMethod: 'https://schema.org/ReturnByMail',
        // Unwanted pieces come back at the customer's cost; faulty ones at ours.
        returnFees: 'https://schema.org/ReturnFeesCustomerResponsibility',
      },
      shippingDetails: {
        '@type': 'OfferShippingDetails',
        shippingRate: { '@type': 'MonetaryAmount', value: shippingFor(price).toFixed(2), currency: 'USD' },
        shippingDestination: { '@type': 'DefinedRegion', addressCountry: 'US' },
      },
    },
  };
  if (item.custom_material) ld.material = String(item.custom_material);
  if (Number(item.weight_per_unit) > 0) {
    ld.weight = { '@type': 'QuantitativeValue', value: Number(item.weight_per_unit), unitCode: 'GRM' };
  }
  return ld;
}
