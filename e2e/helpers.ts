import { expect, type APIRequestContext, type Page, request as pwRequest } from '@playwright/test';
import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Shared plumbing for the browser tests.
 *
 * The shopper account is made fresh by the global setup on the local bench,
 * with a random password that lives only in e2e/.auth (gitignored) for the
 * length of the run, and is deleted again by the teardown. Nothing here is a
 * real person's account or a real password.
 */

export const ADMIN = { usr: 'Administrator', pwd: process.env.ADMIN_PWD || 'admin' };
export const AUTH_DIR = path.join(__dirname, '.auth');
export const SHOPPER_FILE = path.join(AUTH_DIR, 'shopper.json');
export const PREFIX = 'e2e-ui';

export interface Shopper { email: string; password: string; name: string }

export function shopper(): Shopper {
  return JSON.parse(fs.readFileSync(SHOPPER_FILE, 'utf8'));
}

export function newPassword(): string {
  return 'Hs!' + randomBytes(12).toString('base64url') + '9a';
}

const csrf = new WeakMap<APIRequestContext, string>();

/** An API session against the bench, through the same proxy the browser uses. */
export async function apiSession(baseURL: string, creds?: { usr: string; pwd: string }) {
  const ctx = await pwRequest.newContext({ baseURL });
  if (creds) {
    const r = await ctx.post('/api/method/login', { data: creds });
    if (!r.ok()) throw new Error(`login as ${creds.usr} failed: ${r.status()}`);
    // A signed-in Frappe session refuses POSTs without its CSRF token.
    const t = await ctx.get('/api/method/hira.api.session.get_csrf_token');
    csrf.set(ctx, (await t.json()).message?.csrf_token || '');
  }
  return ctx;
}

export async function call(ctx: APIRequestContext, method: string, params: Record<string, unknown> = {}, verb: 'GET' | 'POST' = 'POST') {
  const r = verb === 'GET'
    ? await ctx.get(`/api/method/${method}`, { params: Object.fromEntries(Object.entries(params).map(([k, v]) => [k, typeof v === 'string' ? v : JSON.stringify(v)])) })
    : await ctx.post(`/api/method/${method}`, { data: params, headers: { 'X-Frappe-CSRF-Token': csrf.get(ctx) || 'fetch' } });
  const body = await r.json().catch(() => ({}));
  return { status: r.status(), body };
}

/** Fails the test on any uncaught error or console error the page logs. */
export function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(`pageerror: ${e.message}`));
  // "Failed to load resource" carries no URL; the response listener below
  // reports the same failure with one, so it can be judged.
  page.on('console', m => {
    if (m.type() === 'error' && !m.text().startsWith('Failed to load resource')) errors.push(`console: ${m.text()}`);
  });
  page.on('response', r => {
    // A 4xx from the API is often the point of a test (a refused coupon). A
    // 5xx never is, and the page's own assets and photos must always load.
    const api = r.url().includes('/api/');
    if (r.status() >= 500 || (r.status() >= 400 && !api)) errors.push(`${r.status()} ${r.url()}`);
  });
  return {
    errors,
    expectClean(ignore: RegExp[] = []) {
      // The owner's homepage picks live in /files/homepage_config.json, which
      // exists only once Admin → Homepage has been saved; until then the page
      // shows its defaults and the lookup fails, harmlessly.
      ignore = [...ignore, /\/files\/homepage_config\.json/];
      const real = errors.filter(e => !ignore.some(re => re.test(e)));
      expect(real, real.join('\n')).toEqual([]);
    },
  };
}

/** Empties the cart, wishlist and checkout state the store keeps in the browser. */
export async function freshStorage(page: Page) {
  await page.goto('/about');
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
}

export async function signIn(page: Page, who: { email: string; password: string }, returnTo = '') {
  await page.goto('/login' + (returnTo ? `?return=${encodeURIComponent(returnTo)}` : ''));
  await page.getByRole('textbox', { name: 'Email or Username' }).fill(who.email);
  await page.getByRole('textbox', { name: /^Password/ }).fill(who.password);
  await page.getByRole('button', { name: 'Sign In' }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

/** Price text such as "$1,100.00" as a number. */
export function money(text: string | null): number {
  return Number(String(text).replace(/[^0-9.]/g, ''));
}

/** The on-sale catalogue as the backend serves it. */
export async function feed(baseURL: string) {
  const ctx = await apiSession(baseURL);
  const { body } = await call(ctx, 'hira.api.products.get_public_items', { limit: 500 }, 'GET');
  await ctx.dispose();
  return body.message as Array<{ name: string; item_name: string; item_group: string; standard_rate: number; custom_item_images?: string }>;
}
