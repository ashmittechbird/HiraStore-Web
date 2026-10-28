export interface SeoItem {
  name: string;
  item_name?: string;
  item_group?: string;
  standard_rate?: number;
  custom_short_description?: string;
  custom_material?: string;
  weight_per_unit?: number;
}

export const SITE_URL: string;
export const SITE_NAME: string;
export const DEFAULT_TITLE: string;
export const DEFAULT_DESCRIPTION: string;
export const DEFAULT_IMAGE: string;
export const INSTAGRAM_URL: string;
export const CONTACT_EMAIL: string;

export function canonicalUrl(pathname: string, search?: string): string;
export function absoluteUrl(src: string | undefined): string;
export function displayCategory(group: string | undefined): string;
export function shippingFor(price: number): number;
export function productDescription(item: SeoItem): string;
export function productTitle(item: SeoItem): string;
export function organizationLd(): Record<string, unknown>;
export function websiteLd(): Record<string, unknown>;
export function breadcrumbLd(trail: Array<{ name: string; path: string }>): Record<string, unknown>;
export function productLd(item: SeoItem, images: string[]): Record<string, unknown>;
