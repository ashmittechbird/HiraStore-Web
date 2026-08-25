import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import {
  useFrappeAuth, useFrappeGetDocList, useFrappeCreateDoc,
  useFrappeUpdateDoc, useFrappeDeleteDoc, useFrappePostCall,
} from '@/lib/frappe';
import { HOME_URL } from '@/lib/config';
import { call, detectMode, db, cacheHomepageConfig, getHomepageConfig, listBookings, setBookingStatus } from '@/lib/backend';
import type { BookingRow } from '@/lib/backend';
import type { Mode } from '@/lib/backend';
import './admin.css';

// ─── TYPES ───────────────────────────────────────────────────────────
interface Item { name: string; item_name?: string; item_group?: string; standard_rate?: number; image?: string; custom_item_images?: string; custom_is_featured?: number | boolean; custom_material?: string; custom_short_description?: string; description?: string; weight_per_unit?: number; }
interface SalesOrder { name: string; customer?: string; transaction_date?: string; grand_total?: number; status?: string; contact_phone?: string; contact_mobile?: string; contact_email?: string; shipping_address_name?: string; per_delivered?: number; remarks?: string; items?: OItem[]; }
interface OItem { item_name?: string; item_code?: string; qty: number; rate: number; amount: number; }
interface Customer { name: string; customer_name?: string; customer_type?: string; email_id?: string; mobile_no?: string; creation?: string; }
interface Coupon { name: string; coupon_code?: string; minimum_amount?: number; valid_from?: string; valid_upto?: string; description?: string; discount_percentage?: number; pricing_rule?: string; }
interface Addr { address_line1?: string; address_line2?: string; city?: string; state?: string; pincode?: string; country?: string; phone?: string; email_id?: string; address_type?: string; }
interface Toasty { id: number; msg: string; type: 'success' | 'error' | 'info'; }
type PageId = 'dashboard' | 'products' | 'orders' | 'customers' | 'bookings' | 'homepage' | 'offers' | 'settings';

// ─── CONSTANTS ────────────────────────────────────────────────────────
const STATUSES = ['Draft', 'To Deliver and Bill', 'To Bill', 'To Deliver', 'Completed', 'Cancelled'];
const PAGE_TITLES: Record<PageId, string> = { dashboard: 'Dashboard', products: 'Products', orders: 'Orders', customers: 'Customers', bookings: 'Video Call Requests', homepage: 'Homepage Sections', offers: 'Offers & Coupons', settings: 'Settings' };

// ─── HELPERS ──────────────────────────────────────────────────────────
function iUrl(img?: string): string {
  if (!img) return `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'><rect fill='%23f5f0ea' width='200' height='200'/><text x='50%25' y='50%25' text-anchor='middle' dominant-baseline='middle' fill='%23a89580' font-size='32'>✦</text></svg>`;
  if (img.startsWith('http')) return img;
  return img;
}
function fmtDate(d?: string) { if (!d) return '-'; return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
function sBadgeCls(s?: string) { const m: Record<string, string> = { 'Completed': 'badge-green', 'Draft': 'badge-gray', 'To Deliver and Bill': 'badge-amber', 'To Bill': 'badge-blue', 'To Deliver': 'badge-blue', 'Cancelled': 'badge-red' }; return m[s || ''] || 'badge-gray'; }
function parseRemarks(r?: string) {
  if (!r) return {};
  const pay = r.match(/Square Payment ID:\s*([^\s|]+)/i) || r.match(/Payment ID:\s*([^\s|]+)/i);
  const coup = r.match(/Coupon:\s*([^|]+)/i);
  const addr = r.match(/Address:\s*([^|]+)/i);
  return { paymentId: pay?.[1], coupon: coup?.[1]?.trim(), address: addr?.[1]?.trim() };
}

// ─── ICONS ────────────────────────────────────────────────────────────
const I = {
  video: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" /></svg>,
  grid: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /></svg>,
  tag: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" /><circle cx="7" cy="7" r="1.5" fill="currentColor" /></svg>,
  home: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>,
  order: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" /><rect x="9" y="3" width="6" height="4" rx="1" /><path d="M9 12h6M9 16h4" /></svg>,
  users: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" /></svg>,
  offer: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" /><circle cx="7" cy="7" r="1.5" fill="currentColor" /></svg>,
  settings: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" /></svg>,
  logout: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>,
  plus: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>,
  search: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>,
  refresh: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10" /></svg>,
  eye: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>,
  truck: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="3" width="15" height="13" /><polygon points="16 8 20 8 23 11 23 16 16 16 16 8" /><circle cx="5.5" cy="18.5" r="2.5" /><circle cx="18.5" cy="18.5" r="2.5" /></svg>,
  edit: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>,
  trash: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a1 1 0 011-1h4a1 1 0 011 1v2" /></svg>,
  close: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>,
  check: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12" /></svg>,
  upload: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><polyline points="16 16 12 12 8 16" /><line x1="12" y1="12" x2="12" y2="21" /><path d="M20.39 18.39A5 5 0 0018 9h-1.26A8 8 0 103 16.3" /></svg>,
  save: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" /><polyline points="17 21 17 13 7 13 7 21" /><polyline points="7 3 7 8 15 8" /></svg>,
  list: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" /></svg>,
  ext: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></svg>,
  clock: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>,
  dollar: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" /></svg>,
  ok: <svg viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2"><polyline points="20 6 9 17 4 12" /></svg>,
  err: <svg viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></svg>,
  info2: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>,
};

// ─── SUB-COMPONENTS ───────────────────────────────────────────────────
function SbItem({ icon, label, active, badge, onClick }: { icon: React.ReactNode; label: string; active: boolean; badge?: number; onClick: () => void }) {
  return (
    <div className={`sb-item${active ? ' active' : ''}`} onClick={onClick}>
      <span style={{ width: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{icon}</span>
      {label}
      {badge ? <span className="sb-badge">{badge}</span> : null}
    </div>
  );
}

function StatCard({ icon, label, value, meta }: { icon: React.ReactNode; label: string; value: string | number; meta: string }) {
  return (
    <div className="stat-card">
      <div className="stat-icon">{icon}</div>
      <div className="stat-label">{label}</div>
      <div className="stat-val">{value}</div>
      <div className="stat-meta">{meta}</div>
    </div>
  );
}

function HpSection({ items, selected, onToggle }: { items: Item[]; selected: string[]; onToggle: (id: string) => void }) {
  const sorted = [...items.filter(i => selected.includes(i.name)), ...items.filter(i => !selected.includes(i.name))];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 400, overflowY: 'auto' }}>
      {sorted.map(item => {
        const checked = selected.includes(item.name);
        const img = iUrl(item.image);
        return (
          <label key={item.name} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 10px', borderRadius: 8, cursor: 'pointer', border: `1.5px solid ${checked ? 'var(--gold)' : 'var(--border)'}`, background: checked ? 'var(--gold-xl)' : 'transparent', transition: 'all .15s' }}>
            <input type="checkbox" checked={checked} onChange={() => onToggle(item.name)} style={{ display: 'none' }} />
            <img src={img} alt="" style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 6, flexShrink: 0, border: '1px solid var(--border)' }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.item_name || item.name}</div>
              <div style={{ fontSize: 11, color: 'var(--text2)' }}>{item.item_group || ''}{item.standard_rate ? ' · $' + Number(item.standard_rate).toLocaleString('en-US') : ''}</div>
            </div>
            <div style={{ width: 20, height: 20, borderRadius: '50%', border: `2px solid ${checked ? 'var(--gold)' : 'var(--border)'}`, background: checked ? 'var(--gold)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {checked && <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="#fff" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>}
            </div>
          </label>
        );
      })}
    </div>
  );
}

function OrderDetailBody({ order, addr }: { order: SalesOrder; addr: Addr | null }) {
  const { paymentId, coupon, address: remarksAddr } = parseRemarks(order.remarks);
  const items = order.items || [];
  return (
    <div>
      <div style={{ marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: 13 }}>
          <div><span style={{ color: 'var(--text3)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.08em' }}>Customer</span><div style={{ fontWeight: 500, marginTop: 2 }}>{order.customer || '-'}</div></div>
          <div><span style={{ color: 'var(--text3)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.08em' }}>Date</span><div style={{ marginTop: 2 }}>{fmtDate(order.transaction_date)}</div></div>
          {order.contact_email && <div><span style={{ color: 'var(--text3)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.08em' }}>Email</span><div style={{ marginTop: 2 }}>{order.contact_email}</div></div>}
          {order.contact_mobile && <div><span style={{ color: 'var(--text3)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.08em' }}>Phone</span><div style={{ marginTop: 2 }}>{order.contact_mobile}</div></div>}
        </div>
      </div>
      {(addr || remarksAddr) && (
        <div style={{ marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--text3)', marginBottom: 8 }}>Shipping Address</div>
          <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 14px', fontSize: 13 }}>
            <div style={{ fontWeight: 500 }}>{order.customer}</div>
            {addr ? <>
              {addr.address_line1 && <div style={{ color: 'var(--text2)', marginTop: 2 }}>{addr.address_line1}</div>}
              {addr.address_line2 && <div style={{ color: 'var(--text2)' }}>{addr.address_line2}</div>}
              <div style={{ color: 'var(--text2)' }}>{[addr.city, addr.state, addr.pincode].filter(Boolean).join(', ')}</div>
              <div style={{ color: 'var(--text2)' }}>{addr.country || ''}</div>
              {addr.phone && <div style={{ color: 'var(--text3)', fontSize: 12, marginTop: 4 }}>{addr.phone}</div>}
            </> : <div style={{ color: 'var(--text2)', marginTop: 2 }}>{remarksAddr}</div>}
          </div>
        </div>
      )}
      {(paymentId || coupon) && (
        <div style={{ marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--text3)', marginBottom: 8 }}>Payment</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {paymentId && <span style={{ background: 'var(--green-bg)', color: 'var(--green)', padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 500 }}>Payment: {paymentId}</span>}
            {coupon && <span style={{ background: 'var(--amber-bg)', color: 'var(--amber)', padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 500 }}>Coupon: {coupon}</span>}
          </div>
        </div>
      )}
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead><tr>
          {['Item', 'Qty', 'Rate', 'Total'].map(h => <th key={h} style={{ textAlign: h === 'Item' ? 'left' : 'right' as any, padding: '8px 10px', fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', background: 'var(--surface2)', borderBottom: '1px solid var(--border)' }}>{h}</th>)}
        </tr></thead>
        <tbody>
          {items.map((item, i) => (
            <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
              <td style={{ padding: 10, fontWeight: 500, fontSize: 13 }}>{item.item_name || item.item_code}</td>
              <td style={{ padding: 10, textAlign: 'center', color: 'var(--text2)' }}>{item.qty}</td>
              <td style={{ padding: 10, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>${(item.rate || 0).toFixed(2)}</td>
              <td style={{ padding: 10, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>${(item.amount || 0).toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ textAlign: 'right', padding: '14px 10px 0', fontVariantNumeric: 'tabular-nums', fontSize: 20, fontWeight: 600, borderTop: '2px solid var(--border)', marginTop: 4 }}>
        Total: ${(order.grand_total || 0).toFixed(2)}
      </div>
    </div>
  );
}

function CustomerDetailBody({ data }: { data: { name: string; email: string; orders: SalesOrder[]; addresses: Addr[]; } }) {
  const totalSpent = data.orders.reduce((s, o) => s + (o.grand_total || 0), 0);
  const completed = data.orders.filter(o => o.status === 'Completed').length;
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 20 }}>
        {[['Total Orders', data.orders.length], ['Total Spent', '$' + totalSpent.toFixed(0)], ['Completed', completed]].map(([l, v]) => (
          <div key={l as string} style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, padding: 14, textAlign: 'center' }}>
            <div style={{ fontVariantNumeric: 'tabular-nums', fontSize: 26, fontWeight: 600 }}>{v}</div>
            <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.08em' }}>{l}</div>
          </div>
        ))}
      </div>
      {(data.email || data.orders[0]?.contact_mobile) && (
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--text3)', marginBottom: 10 }}>Contact Info</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 13 }}>
            {data.email && <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px' }}><div style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 2 }}>Email</div><div style={{ fontWeight: 500 }}>{data.email}</div></div>}
            {data.orders[0]?.contact_mobile && <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px' }}><div style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 2 }}>Phone</div><div style={{ fontWeight: 500 }}>{data.orders[0].contact_mobile}</div></div>}
          </div>
        </div>
      )}
      {data.addresses.length > 0 && (
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--text3)', marginBottom: 10 }}>Shipping Address{data.addresses.length > 1 ? 'es' : ''}</div>
          {data.addresses.map((a, i) => (
            <div key={i} style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 14px', fontSize: 13, marginBottom: 8 }}>
              <div style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 4 }}>{a.address_type || 'Shipping'}</div>
              <div style={{ fontWeight: 500 }}>{[a.address_line1, a.address_line2].filter(Boolean).join(', ')}</div>
              <div style={{ color: 'var(--text2)' }}>{[a.city, a.state, a.pincode].filter(Boolean).join(', ')}</div>
              <div style={{ color: 'var(--text2)' }}>{a.country || ''}</div>
              {a.phone && <div style={{ color: 'var(--text3)', fontSize: 12, marginTop: 4 }}>📞 {a.phone}</div>}
            </div>
          ))}
        </div>
      )}
      {data.orders.length > 0 && (
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--text3)', marginBottom: 10 }}>Order History</div>
          {data.orders.map(o => {
            const p = parseRemarks(o.remarks);
            return (
              <div key={o.name} style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 14px', marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontWeight: 600, fontSize: 13 }}>{o.name}</span>
                  <span className={`badge ${sBadgeCls(o.status)}`}>{o.status || '-'}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: 12, color: 'var(--text2)' }}>
                  <div>Date: {fmtDate(o.transaction_date)}</div>
                  <div style={{ fontVariantNumeric: 'tabular-nums', fontSize: 15, color: 'var(--text)', fontWeight: 600 }}>${(o.grand_total || 0).toFixed(2)}</div>
                  {p.paymentId && <div style={{ gridColumn: '1/-1' }}><span style={{ background: 'var(--green-bg)', color: 'var(--green)', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 500 }}>Payment: {p.paymentId}</span></div>}
                  {p.coupon && <div style={{ gridColumn: '1/-1' }}>Coupon: {p.coupon}</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── FILE UPLOAD HELPER (session-based) ──────────────────────────────
function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result));
    fr.onerror = () => reject(new Error('Could not read the selected file'));
    fr.readAsDataURL(file);
  });
}

async function uploadImage(file: File): Promise<string | null> {
  // Without a backend there is nowhere to POST to, so the image is inlined as a
  // data URL and kept with the rest of the demo store.
  if ((await detectMode()) === 'demo') {
    return db.saveFile(file.name, await fileToDataUrl(file));
  }
  const fd = new FormData();
  fd.append('file', file, file.name);
  fd.append('is_private', '0');
  const csrf = document.cookie.match(/csrftoken=([^;]+)/)?.[1] ?? '';
  const r = await fetch('/api/method/upload_file', {
    method: 'POST',
    credentials: 'include',
    headers: { 'X-Frappe-CSRF-Token': csrf },
    body: fd,
  });
  const d = await r.json();
  return d.message?.file_url || d.file_url || null;
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────
export default function AdminPage() {
  // Auth — use direct fetch instead of SDK to avoid cookie detection issues
  const { logout: sdkLogout } = useFrappeAuth();
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // On mount, check if already logged in via cookie (frappe.auth.get_logged_user is not whitelisted)
  const [mode, setMode] = useState<Mode | null>(null);

  useEffect(() => {
    let alive = true;
    detectMode().then(m => {
      if (!alive) return;
      setMode(m);
      if (m === 'demo') {
        setCurrentUser(db.currentSession());
      } else {
        const cookie = document.cookie.match(/(?:^|;\s*)user_id=([^;]+)/)?.[1];
        const userId = cookie ? decodeURIComponent(cookie) : null;
        setCurrentUser(userId && userId !== 'Guest' ? userId : null);
      }
      setAuthLoading(false);
    });
    return () => { alive = false; };
  }, []);

  const authed = !authLoading && !!currentUser;

  // Admin role check
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminChecked, setAdminChecked] = useState(false);

  useEffect(() => {
    if (!authed || !currentUser) { setIsAdmin(false); setAdminChecked(true); return; }
    if (currentUser === 'Administrator') { setIsAdmin(true); setAdminChecked(true); return; }
    call('frappe.client.get', { doctype: 'User', name: currentUser })
      .then(res => {
        const roles: string[] = (res.message?.roles ?? []).map((r: { role: string }) => r.role);
        setIsAdmin(roles.includes('System Manager') || roles.includes('Administrator'));
      })
      .catch(() => setIsAdmin(false))
      .finally(() => setAdminChecked(true));
  }, [authed, currentUser]);

  // Login state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginErr, setLoginErr] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  // UI state
  const [page, setPage] = useState<PageId>('dashboard');
  const [sbOpen, setSbOpen] = useState(false);
  const [toasts, setToasts] = useState<Toasty[]>([]);

  // Settings
  const [itemGroup, setItemGroup] = useState(() => localStorage.getItem('hs_item_group') || 'Jewelry');
  const [smInstagram, setSmInstagram] = useState(() => localStorage.getItem('hs_sm_instagram') || '');
  const [smFacebook, setSmFacebook] = useState(() => localStorage.getItem('hs_sm_facebook') || '');
  const [smPinterest, setSmPinterest] = useState(() => localStorage.getItem('hs_sm_pinterest') || '');
  const [smTiktok, setSmTiktok] = useState(() => localStorage.getItem('hs_sm_tiktok') || '');
  const [smWhatsapp, setSmWhatsapp] = useState(() => localStorage.getItem('hs_sm_whatsapp') || '');
  const [igPosts, setIgPosts] = useState<string[]>(() => {
    try { return [...JSON.parse(localStorage.getItem('hs_ig_posts') || '[]'), ...Array(6)].slice(0, 6).map((v: unknown) => (v as string) || ''); } catch { return Array(6).fill(''); }
  });

  // Products state
  const [prodSearch, setProdSearch] = useState('');
  const [prodCat, setProdCat] = useState('');
  const [prodView, setProdView] = useState<'grid' | 'list'>('grid');
  const [prodModal, setProdModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const emptyExtraImg = () => ({ url: '', file: null as File | null, preview: '' });
  const defaultPf = { name: '', price: '', weight: '', category: '', material: '', desc: '', featured: false, imageUrl: '', imageFile: null as File | null, imagePreview: '', extraImgs: [emptyExtraImg(), emptyExtraImg(), emptyExtraImg(), emptyExtraImg()] };
  const [pf, setPf] = useState(defaultPf);
  const [prodSaving, setProdSaving] = useState(false);

  // Orders state
  const [orderSearch, setOrderSearch] = useState('');
  const [orderStatusF, setOrderStatusF] = useState('');
  const [orderModal, setOrderModal] = useState<{ order: SalesOrder; addr: Addr | null } | null>(null);
  const [orderModalLoading, setOrderModalLoading] = useState(false);

  // Video call bookings
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [bookingsLoading, setBookingsLoading] = useState(false);
  const [bookingSearch, setBookingSearch] = useState('');

  const reloadBookings = useCallback(async () => {
    if (!authed) return;
    setBookingsLoading(true);
    try { setBookings(await listBookings(200)); } catch { setBookings([]); }
    setBookingsLoading(false);
  }, [authed]);

  // Customers state
  const [custSearch, setCustSearch] = useState('');
  const [custModal, setCustModal] = useState<{ name: string; email: string; orders: SalesOrder[]; addresses: Addr[] } | null>(null);
  const [custModalLoading, setCustModalLoading] = useState(false);

  // Homepage state
  const [hpML, setHpML] = useState<string[]>([]);
  const [hpNA, setHpNA] = useState<string[]>([]);
  const [hpSaving, setHpSaving] = useState(false);

  // Offers state
  const [allOffers, setAllOffers] = useState<Coupon[]>([]);
  const [ofCode, setOfCode] = useState(''); const [ofPct, setOfPct] = useState(''); const [ofMin, setOfMin] = useState('');
  const [ofFrom, setOfFrom] = useState(''); const [ofUpto, setOfUpto] = useState(''); const [ofDesc, setOfDesc] = useState('');

  // Confirm dialog
  const [confirmDlg, setConfirmDlg] = useState<{ title: string; msg: string; onOk: () => void } | null>(null);

  // ── SDK DATA HOOKS ──
  // Each args object is memoized so SWR doesn't refetch on every render (was causing an infinite re-render loop).
  const ITEM_FIELDS = ['name', 'item_name', 'standard_rate', 'item_group', 'image', 'custom_item_images', 'custom_material', 'custom_short_description', 'description', 'weight_per_unit'];
  const productsArgs = useMemo(() => (authed ? { fields: ITEM_FIELDS as any, limit: 500 } : undefined), [authed]);
  const { data: allProducts = [], isLoading: prodLoading, mutate: reloadProducts } = useFrappeGetDocList<Item>('Item', productsArgs);

  const ORDER_FIELDS = ['name', 'customer', 'transaction_date', 'grand_total', 'status', 'contact_mobile', 'contact_email', 'shipping_address_name', 'per_delivered'];
  const [allOrders, setAllOrders] = useState<SalesOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);

  const CUST_FIELDS = ['name', 'customer_name', 'customer_type', 'email_id', 'mobile_no', 'creation'];
  const customersArgs = useMemo(() => (authed ? { fields: CUST_FIELDS as any, limit: 200, orderBy: { field: 'creation' as any, order: 'desc' as const } } : undefined), [authed]);
  const { data: allCustomers = [], isLoading: custLoading, mutate: reloadCustomers } = useFrappeGetDocList<Customer>('Customer', customersArgs);

  const HP_FIELDS = ['name', 'item_name', 'image', 'standard_rate', 'item_group'];
  const hpArgs = useMemo(() => (authed ? { fields: HP_FIELDS as any, filters: [['disabled', '=', 0]] as any, limit: 200, orderBy: { field: 'item_name' as any, order: 'asc' as const } } : undefined), [authed]);
  const { data: hpItemsList = [], isLoading: hpLoading, mutate: reloadHp } = useFrappeGetDocList<Item>('Item', hpArgs);

  const COUPON_FIELDS = ['name', 'coupon_code', 'minimum_amount', 'valid_from', 'valid_upto', 'description'];
  const couponArgs = useMemo(() => (authed ? { fields: COUPON_FIELDS as any, limit: 50, orderBy: { field: 'creation' as any, order: 'desc' as const } } : undefined), [authed]);
  const { data: couponList = [], isLoading: offersListLoading, mutate: reloadOffers } = useFrappeGetDocList<Coupon>('Coupon Code', couponArgs);

  const companyArgs = useMemo(() => (authed ? { fields: ['name'] as any, limit: 1 } : undefined), [authed]);
  const { data: companyList = [] } = useFrappeGetDocList<{ name: string }>('Company', companyArgs);

  // ── SDK MUTATIONS ──
  const { createDoc } = useFrappeCreateDoc();
  const { updateDoc } = useFrappeUpdateDoc();
  const { deleteDoc } = useFrappeDeleteDoc();
  const { call: frappeGet } = useFrappePostCall<{ message: any }>('frappe.client.get');
  const { call: frappeGetList } = useFrappePostCall<{ message: any[] }>('frappe.client.get_list');
  const { call: makeDelivNote } = useFrappePostCall<{ message: any }>('erpnext.selling.doctype.sales_order.sales_order.make_delivery_note');

  // Ref to avoid stale closure in effects
  const frappeGetRef = useRef(frappeGet);
  const reloadOrders = useCallback(async () => {
    if (!authed) return;
    setOrdersLoading(true);
    try {
      const data = await call('frappe.client.get_list', {
        doctype: 'Sales Order',
        fields: ORDER_FIELDS,
        limit: 500,
        order_by: 'transaction_date desc',
      });
      setAllOrders(data.message || []);
    } catch { setAllOrders([]); }
    setOrdersLoading(false);
  }, [authed]);
  frappeGetRef.current = frappeGet;

  // ── DERIVED DATA ──
  const dashLoading = prodLoading || ordersLoading;
  const stats = {
    products: allProducts.length,
    orders: allOrders.length,
    pending: allOrders.filter(o => !['Completed', 'Cancelled'].includes(o.status || '')).length,
    revenue: allOrders.reduce((s, o) => s + (o.grand_total || 0), 0),
  };
  const recentOrders = allOrders.slice(0, 8);
  const offersLoading = offersListLoading || (couponList.length > 0 && allOffers.length === 0);

  // ── EFFECTS ──
  useEffect(() => { reloadOrders(); }, [reloadOrders]);
  useEffect(() => { reloadBookings(); }, [reloadBookings]);

  const hpConfigFetched = useRef(false);
  const hpItemsLen = hpItemsList.length;
  useEffect(() => {
    if (!hpItemsLen || hpConfigFetched.current) return;
    hpConfigFetched.current = true;
    getHomepageConfig()
      .then(cfg => { if (cfg) { setHpML(cfg.ml || []); setHpNA(cfg.na || []); } })
      .catch(() => {});
  }, [hpItemsLen]);

  // Track the couponList signature so we only refetch when names actually change,
  // not just because SWR returned a new array reference.
  const couponNamesKey = couponList.map(c => c.name).join('|');
  useEffect(() => {
    if (!couponList.length) {
      setAllOffers(prev => (prev.length === 0 ? prev : []));
      return;
    }
    let cancelled = false;
    Promise.all(
      couponList.map(c => frappeGetRef.current({ doctype: 'Coupon Code', name: c.name })
        .then(r => r.message || c).catch(() => c))
    ).then(full => { if (!cancelled) setAllOffers(full); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [couponNamesKey]);

  // ── FILTERS ──
  const filteredProducts = allProducts.filter(p => { const q = prodSearch.toLowerCase(); return (p.item_name || p.name || '').toLowerCase().includes(q) && (!prodCat || p.item_group === prodCat); });
  const filteredOrders = allOrders.filter(o => { const q = orderSearch.toLowerCase(); return ((o.name || '').toLowerCase().includes(q) || (o.customer || '').toLowerCase().includes(q)) && (!orderStatusF || o.status === orderStatusF); });
  const filteredCusts = allCustomers.filter(c => { const q = custSearch.toLowerCase(); return (c.customer_name || '').toLowerCase().includes(q) || (c.email_id || '').toLowerCase().includes(q) || (c.mobile_no || '').toLowerCase().includes(q); });
  const categories = Array.from(new Set(allProducts.map(p => p.item_group).filter(Boolean))).sort() as string[];
  const pendingCount = allOrders.filter(o => !['Completed', 'Cancelled'].includes(o.status || '')).length;
  const newBookingCount = bookings.filter(b => b.status === 'New').length;
  const filteredBookings = bookings.filter(b => {
    const q = bookingSearch.toLowerCase();
    return !q || (b.customer_name || '').toLowerCase().includes(q) || (b.phone || '').includes(q) || (b.email || '').toLowerCase().includes(q);
  });

  // ── HANDLERS ──
  function toast(msg: string, type: 'success' | 'error' | 'info' = 'info') {
    const id = Date.now() + Math.random();
    setToasts(p => [...p, { id, msg, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3500);
  }

  async function doLogin(e: React.FormEvent) {
    e.preventDefault(); setLoginErr(''); setLoginLoading(true);
    try {
      const data = await call('login', { usr: loginEmail, pwd: loginPassword });
      // Frappe answers with the user; in demo mode the store echoes it back.
      // The cookie is the fallback for benches that omit it from the body.
      const cookie = document.cookie.match(/(?:^|;\s*)user_id=([^;]+)/)?.[1];
      const userId = data?.user || (cookie ? decodeURIComponent(cookie) : null);
      if (userId && userId !== 'Guest') {
        setCurrentUser(userId);
        setAdminChecked(false);
      } else {
        setLoginErr('Signed in, but the user could not be identified. Try refreshing.');
      }
    } catch (err: any) {
      setLoginErr(err?.message || 'Network error. Is the server running?');
    }
    setLoginLoading(false);
  }

  async function logout() {
    await sdkLogout();
    setCurrentUser(null);
    setIsAdmin(false);
    setAdminChecked(false);
  }

  function openAdd() { setEditingId(null); setPf(defaultPf); setProdModal(true); }
  function openEdit(item: Item) {
    setEditingId(item.name);
    let extraImgs = [emptyExtraImg(), emptyExtraImg(), emptyExtraImg(), emptyExtraImg()];
    if (item.custom_item_images) {
      try {
        const arr: string[] = JSON.parse(item.custom_item_images);
        if (Array.isArray(arr)) {
          arr.slice(0, 4).forEach((url, i) => {
            extraImgs[i] = { url, file: null, preview: iUrl(url) };
          });
        }
      } catch { }
    }
    setPf({ name: item.item_name || item.name, price: String(item.standard_rate || ''), weight: String(item.weight_per_unit || ''), category: item.item_group || '', material: item.custom_material || '', desc: item.custom_short_description || item.description || '', featured: !!item.custom_is_featured, imageUrl: item.image || '', imageFile: null, imagePreview: item.image ? iUrl(item.image) : '', extraImgs });
    setProdModal(true);
  }

  async function saveProd() {
    if (!pf.name || !pf.category) { toast('Name and category are required', 'error'); return; }
    setProdSaving(true);
    try {
      let imageUrl = pf.imageUrl;
      if (pf.imageFile) { toast('Uploading image…', 'info'); imageUrl = (await uploadImage(pf.imageFile)) || imageUrl; }
      const extraUrls: string[] = [];
      for (let i = 0; i < pf.extraImgs.length; i++) {
        const ei = pf.extraImgs[i];
        if (ei.file) { toast(`Uploading image ${i + 2}…`, 'info'); const u = await uploadImage(ei.file); if (u) extraUrls.push(u); }
        else if (ei.url) { extraUrls.push(ei.url); }
      }
      const payload: any = { item_name: pf.name, item_group: pf.category || itemGroup, standard_rate: parseFloat(pf.price) || 0, custom_material: pf.material, custom_short_description: pf.desc, custom_is_featured: pf.featured ? 1 : 0, image: imageUrl || null, custom_item_images: extraUrls.length ? JSON.stringify(extraUrls) : null, is_sales_item: 1 };
      if (editingId) {
        await updateDoc('Item', editingId, payload);
        toast('Product updated', 'success');
      } else {
        payload.item_code = pf.name.replace(/[^a-zA-Z0-9]/g, '-').toUpperCase() + '-' + Date.now().toString().slice(-5);
        await createDoc('Item', payload);
        toast('Product added', 'success');
      }
      setProdModal(false); reloadProducts();
    } catch (e: any) { toast('Error: ' + e.message, 'error'); }
    setProdSaving(false);
  }

  function delProd(item: Item) {
    setConfirmDlg({
      title: `Delete "${item.item_name || item.name}"?`, msg: 'This will permanently remove the product from ERPNext.', onOk: async () => {
        setConfirmDlg(null);
        try { await deleteDoc('Item', item.name); toast('Product deleted', 'success'); reloadProducts(); }
        catch (e: any) { toast('Delete failed: ' + e.message, 'error'); }
      }
    });
  }

  async function viewOrder(name: string) {
    setOrderModal({ order: { name }, addr: null }); setOrderModalLoading(true);
    try {
      const res = await frappeGet({ doctype: 'Sales Order', name });
      const o: SalesOrder = res.message;
      let addr: Addr | null = null;
      if (o.shipping_address_name) {
        addr = await frappeGet({ doctype: 'Address', name: o.shipping_address_name }).then(r => r.message).catch(() => null);
      }
      setOrderModal({ order: o, addr });
    } catch (e: any) { toast('Failed to load order: ' + e.message, 'error'); }
    setOrderModalLoading(false);
  }

  async function updateStatus(id: string, status: string) {
    try {
      await updateDoc('Sales Order', id, { status });
      toast('Order status updated', 'success');
      reloadOrders();
    } catch (e: any) { toast('Failed: ' + e.message, 'error'); }
  }

  async function shipOrder(name: string) {
    if (!window.confirm(`Create Delivery Note for ${name} and deduct stock?`)) return;
    try {
      const dnData = await makeDelivNote({ source_name: name });
      const dn = dnData.message; if (!dn) throw new Error('No Delivery Note returned');
      const saved = await createDoc('Delivery Note', dn);
      await updateDoc('Delivery Note', (saved as any).name, { docstatus: 1 });
      toast('Stock deducted! DN: ' + (saved as any).name, 'success'); reloadOrders();
    } catch (e: any) { toast('Ship failed: ' + e.message, 'error'); }
  }

  async function viewCust(customerName: string, email: string) {
    setCustModal({ name: customerName, email, orders: [], addresses: [] }); setCustModalLoading(true);
    try {
      const [addrRes, ordRes] = await Promise.all([
        frappeGetList({ doctype: 'Address', filters: [['Dynamic Link', 'link_doctype', '=', 'Customer'], ['Dynamic Link', 'link_name', '=', customerName]], fields: ['address_line1', 'address_line2', 'city', 'state', 'pincode', 'country', 'phone', 'email_id', 'address_type'], limit: 10 }).catch(() => ({ message: [] })),
        frappeGetList({ doctype: 'Sales Order', filters: [['customer', '=', customerName]], fields: ['name', 'transaction_date', 'grand_total', 'status', 'remarks', 'contact_email', 'contact_mobile', 'per_delivered'], limit: 20, order_by: 'creation desc' } as any).catch(() => ({ message: [] })),
      ]);
      setCustModal({ name: customerName, email, orders: ordRes.message || [], addresses: addrRes.message || [] });
    } catch (e: any) { toast('Failed to load customer: ' + e.message, 'error'); }
    setCustModalLoading(false);
  }

  async function saveHomepage() {
    setHpSaving(true);
    const config = JSON.stringify({ ml: hpML, na: hpNA });


    cacheHomepageConfig({ ml: hpML, na: hpNA });

    // With no backend there is nothing further to publish — the local copy is
    // what the storefront reads, and it is already saved.
    if ((await detectMode()) === 'demo') {
      toast('Homepage sections saved.', 'success');
      setHpSaving(false);
      return;
    }

    // Publish to Frappe so every visitor and device sees the same rails.
    const csrf = document.cookie.match(/csrftoken=([^;]+)/)?.[1];
    if (!csrf) {
      toast('Saved on this device, but not published — sign in again to sync.', 'error');
      setHpSaving(false);
      return;
    }

    try {
      // Replace any previous copies so /files/homepage_config.json stays canonical.
      const listBody = await call('frappe.client.get_list', {
        doctype: 'File',
        filters: [['file_url', 'like', '/files/homepage_config%']],
        fields: ['name', 'file_url'],
        limit_page_length: 100,
      });
      const oldFiles: { name: string; file_url: string }[] = listBody.message || [];

      const deleteFailures: string[] = [];
      await Promise.all(
        oldFiles.map(async fdoc => {
          try {
            await call('frappe.client.delete', { doctype: 'File', name: fdoc.name });
          } catch {
            deleteFailures.push(fdoc.file_url);
          }
        })
      );

      const blob = new Blob([config], { type: 'application/json' });
      const fd = new FormData();
      fd.append('file', new File([blob], 'homepage_config.json', { type: 'application/json' }), 'homepage_config.json');
      fd.append('is_private', '0');
      fd.append('folder', 'Home');
      const upRes = await fetch('/api/method/upload_file', {
        method: 'POST', credentials: 'include',
        headers: { 'X-Frappe-CSRF-Token': csrf }, body: fd,
      });
      const upBody = await upRes.json().catch(() => ({}));
      if (!upRes.ok) throw new Error('Upload failed: ' + (upBody.exception || upRes.status));

      const newUrl: string | undefined = upBody?.message?.file_url;
      if (newUrl && newUrl !== '/files/homepage_config.json') {
        toast(`Saved, but Frappe stored it as ${newUrl}. The site reads /files/homepage_config.json — remove the duplicates in File Manager.`, 'error');
      } else if (deleteFailures.length) {
        toast(`Saved, but ${deleteFailures.length} old file(s) could not be removed. Visitors may see stale data.`, 'error');
      } else {
        toast('Homepage sections saved and published!', 'success');
      }
    } catch (e: any) {
      toast('Saved on this device, but publishing failed: ' + (e?.message || e), 'error');
    } finally {
      setHpSaving(false);
    }
  }

  async function createCoupon(e: React.FormEvent) {
    e.preventDefault();
    if (!ofCode || !ofPct || !ofUpto) { toast('Code, discount % and valid until required', 'error'); return; }
    try {
      const today = new Date().toISOString().split('T')[0];
      const company = companyList[0]?.name || '';
      const pr = await createDoc('Pricing Rule', {
        title: `Coupon: ${ofCode}`,
        apply_on: 'Transaction',
        price_or_product_discount: 'Price',
        rate_or_discount: 'Discount Percentage',
        discount_percentage: parseFloat(ofPct),
        selling: 1,
        company,
        valid_from: ofFrom || today,
        valid_upto: ofUpto,
      });
      if (!(pr as any).name) throw new Error('Failed to create pricing rule');
      await createDoc('Coupon Code', {
        coupon_code: ofCode,
        coupon_type: 'Percentage',
        pricing_rule: (pr as any).name,
        discount_percentage: parseFloat(ofPct),
        minimum_amount: ofMin ? parseFloat(ofMin) : 0,
        valid_from: ofFrom || today,
        valid_upto: ofUpto,
        description: ofDesc || `${ofPct}% discount`,
      });
      toast('Coupon created: ' + ofCode, 'success');
      setOfCode(''); setOfPct(''); setOfMin(''); setOfFrom(''); setOfUpto(''); setOfDesc('');
      reloadOffers();
    } catch (e: any) { toast('Failed: ' + e.message, 'error'); }
  }

  function delCoupon(name: string) {
    setConfirmDlg({
      title: 'Delete Coupon?', msg: `Delete "${name}"? Cannot be undone.`, onOk: async () => {
        setConfirmDlg(null);
        try {
          const docRes = await frappeGet({ doctype: 'Coupon Code', name });
          const pricingRule = docRes.message?.pricing_rule;
          await deleteDoc('Coupon Code', name);
          if (pricingRule) await deleteDoc('Pricing Rule', pricingRule).catch(() => { });
          toast('Coupon deleted', 'success'); reloadOffers();
        } catch (e: any) { toast('Failed: ' + e.message, 'error'); }
      }
    });
  }

  const nav = (p: PageId) => { setPage(p); setSbOpen(false); };

  return (
    <div className="adm-root">
      {/* LOADING */}
      {authLoading && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg)' }}>
          <div className="spin" style={{ width: 32, height: 32 }} />
        </div>
      )}

      {/* LOGIN */}
      {!authLoading && !authed && (
        <div className="adm-login">
          <form className="adm-login-box" onSubmit={doLogin}>
            <div className="adm-login-logo">
              <img src={`${import.meta.env.BASE_URL}site-images/hira-logo.png`} alt="Hira Store" style={{ height: 60, filter: 'brightness(0) invert(1)', margin: '0 auto 10px', display: 'block' }} />
              <div className="adm-login-sub">Admin Dashboard</div>
            </div>
            <div className="adm-login-field"><label>Username / Email</label><input type="text" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} placeholder="Administrator" autoComplete="username" required /></div>
            <div className="adm-login-field"><label>Password</label><input type="password" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} placeholder="Your password" autoComplete="current-password" minLength={8} required /></div>
            <button className="adm-login-btn" type="submit" disabled={loginLoading}>{loginLoading ? 'Signing in…' : 'Sign In'}</button>
            {loginErr && <div className="adm-login-err">{loginErr}</div>}
          </form>
        </div>
      )}

      {/* ACCESS DENIED */}
      {authed && adminChecked && !isAdmin && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#fff', flexDirection: 'column', gap: 16 }}>
          <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="#e11d48" strokeWidth="1.5"><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></svg>
          <h2 style={{ fontFamily: 'Playfair Display,serif', fontSize: 24, color: '#1a1a1a', fontWeight: 400 }}>Access Denied</h2>
          <p style={{ fontSize: 14, color: '#737373' }}>You do not have permission to access the admin panel.</p>
          <button type="button" onClick={() => sdkLogout()} style={{ marginTop: 8, padding: '10px 28px', background: '#1a1a1a', color: '#fff', border: 'none', borderRadius: 4, fontSize: 13, cursor: 'pointer' }}>Sign Out</button>
        </div>
      )}

      {/* APP */}
      {isAdmin && (
        <div className="adm-app">
          {sbOpen && <div className="sb-overlay" onClick={() => setSbOpen(false)} />}

          {/* SIDEBAR */}
          <aside className={`sidebar${sbOpen ? ' open' : ''}`}>
            <div className="sb-header">
              <img src={`${import.meta.env.BASE_URL}site-images/hira-logo.png`} alt="Hira Store" style={{ height: 44, filter: 'brightness(0) invert(1)' }} />
              <div className="sb-sub">Admin Panel</div>
            </div>
            <nav className="sb-nav">
              <div className="sb-section">Main</div>
              <SbItem icon={I.grid} label="Dashboard" active={page === 'dashboard'} onClick={() => nav('dashboard')} />
              <div className="sb-section">Catalog</div>
              <SbItem icon={I.tag} label="Products" active={page === 'products'} onClick={() => nav('products')} />
              <SbItem icon={I.home} label="Homepage" active={page === 'homepage'} onClick={() => nav('homepage')} />
              <SbItem icon={I.order} label="Orders" active={page === 'orders'} badge={pendingCount || undefined} onClick={() => nav('orders')} />
              <div className="sb-section">CRM</div>
              <SbItem icon={I.users} label="Customers" active={page === 'customers'} onClick={() => nav('customers')} />
              <SbItem icon={I.video} label="Video Calls" active={page === 'bookings'} badge={newBookingCount || undefined} onClick={() => nav('bookings')} />
              <SbItem icon={I.offer} label="Offers" active={page === 'offers'} onClick={() => nav('offers')} />
              <div className="sb-section">System</div>
              <SbItem icon={I.settings} label="Settings" active={page === 'settings'} onClick={() => nav('settings')} />
            </nav>
            <div className="sb-footer">
              <button type="button" className="sb-logout" onClick={logout}>{I.logout} Sign Out</button>
            </div>
          </aside>

          {/* MAIN */}
          <main className="adm-main">
            <header className="topbar">
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <button type="button" className="sb-toggle" onClick={() => setSbOpen(v => !v)}>
                  <svg viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" fill="none" width="20" height="20"><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></svg>
                </button>
                <div className="topbar-title">{PAGE_TITLES[page]}</div>
              </div>
              <div className="topbar-right">
                <div className="topbar-erp">
                  <span className="dot green" />
                  <span>{currentUser}</span>
                </div>
                <a href={HOME_URL} target="_blank" className="btn btn-outline btn-sm">{I.ext} View Site</a>
              </div>
            </header>

            <div className="page-content">

              {/* ── DASHBOARD ── */}
              {page === 'dashboard' && <>
                <div className="stats-grid">
                  <StatCard icon={I.tag} label="Total Products" value={dashLoading ? '…' : stats.products} meta="in catalog" />
                  <StatCard icon={I.order} label="Total Orders" value={dashLoading ? '…' : stats.orders} meta="all time" />
                  <StatCard icon={I.clock} label="Pending Orders" value={dashLoading ? '…' : stats.pending} meta="need action" />
                  <StatCard icon={I.dollar} label="Total Revenue" value={dashLoading ? '…' : '$' + stats.revenue.toLocaleString('en-US', { maximumFractionDigits: 0 })} meta="USD" />
                </div>
                <div className="two-col">
                  <div className="card">
                    <div className="card-hd"><h2>Recent Orders</h2><button type="button" className="btn btn-ghost btn-sm" onClick={() => setPage('orders')}>View all</button></div>
                    {dashLoading ? <div className="loading-overlay"><div className="spin" /><p>Loading…</p></div> : recentOrders.length === 0 ? <div className="empty"><div className="empty-icon">{I.order}</div><h3>No orders yet</h3></div> : (
                      <div className="tbl-wrap"><table><thead><tr><th>Order</th><th>Status</th><th>Amount</th></tr></thead><tbody>
                        {recentOrders.map(o => <tr key={o.name}><td className="td-name" style={{ fontSize: 12 }}>{o.name}</td><td><span className={`badge ${sBadgeCls(o.status)}`}>{o.status || '-'}</span></td><td style={{ fontVariantNumeric: 'tabular-nums', fontSize: 15 }}>${(o.grand_total || 0).toFixed(2)}</td></tr>)}
                      </tbody></table></div>
                    )}
                  </div>
                  <div className="card">
                    <div className="card-hd"><h2>Quick Add Product</h2></div>
                    <div className="card-body"><p style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 18 }}>Add a new product to your catalog. It will appear on the shop immediately.</p><button type="button" className="btn btn-gold" onClick={openAdd}>{I.plus} Add New Product</button></div>
                  </div>
                </div>
              </>}

              {/* ── PRODUCTS ── */}
              {page === 'products' && <>
                <div className="toolbar">
                  <div className="search-wrap">{I.search}<input className="search-input" type="text" placeholder="Search products…" value={prodSearch} onChange={e => setProdSearch(e.target.value)} /></div>
                  <select className="filter-select" value={prodCat} onChange={e => setProdCat(e.target.value)}><option value="">All Categories</option>{categories.map(c => <option key={c}>{c}</option>)}</select>
                  <div className="view-toggle"><button type="button" className={prodView === 'grid' ? 'active' : ''} onClick={() => setProdView('grid')}>{I.grid}</button><button type="button" className={prodView === 'list' ? 'active' : ''} onClick={() => setProdView('list')}>{I.list}</button></div>
                  <button type="button" className="btn btn-gold" onClick={openAdd}>{I.plus} Add Product</button>
                </div>
                {prodLoading ? <div className="loading-overlay"><div className="spin" /><p>Loading products…</p></div> : filteredProducts.length === 0 ? (
                  <div className="empty"><div className="empty-icon">{I.tag}</div><h3>No products found</h3><p>Try a different search or add your first product.</p><button type="button" className="btn btn-gold" onClick={openAdd}>Add Product</button></div>
                ) : prodView === 'grid' ? (
                  <div className="product-grid">
                    {filteredProducts.map(p => (
                      <div key={p.name} className="prod-card">
                        <img className="prod-img" src={iUrl(p.image)} alt={p.item_name || ''} loading="lazy" onError={e => { (e.target as HTMLImageElement).src = iUrl(); }} />
                        <div className="prod-info">
                          <div className="prod-name">{p.item_name || p.name}</div>
                          <div className="prod-meta">{p.item_group || ''}{p.custom_material ? ' · ' + p.custom_material : ''}</div>
                          <div className="prod-footer">
                            <div className="prod-price">${(p.standard_rate || 0).toFixed(2)}</div>
                            <div className="prod-actions">
                              {p.custom_is_featured ? <span style={{ fontSize: 14, padding: '4px 6px', background: 'var(--amber-bg)', borderRadius: 'var(--r-sm)', color: 'var(--amber)' }}>★</span> : null}
                              <button type="button" className="edit-btn" onClick={() => openEdit(p)}>{I.edit}</button>
                              <button type="button" className="del-btn" onClick={() => delProd(p)}>{I.trash}</button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="card"><div className="tbl-wrap"><table>
                    <thead><tr><th>Image</th><th>Name</th><th>Category</th><th>Price</th><th>Featured</th><th>Actions</th></tr></thead>
                    <tbody>{filteredProducts.map(p => (
                      <tr key={p.name}>
                        <td><img className="td-img" src={iUrl(p.image)} alt="" onError={e => { (e.target as HTMLImageElement).src = iUrl(); }} /></td>
                        <td><div className="td-name">{p.item_name || p.name}</div><div className="td-sub">{p.custom_material || ''}</div></td>
                        <td><span className="badge badge-gray">{p.item_group || '-'}</span></td>
                        <td style={{ fontVariantNumeric: 'tabular-nums', fontSize: 15 }}>${(p.standard_rate || 0).toFixed(2)}</td>
                        <td>{p.custom_is_featured ? <span className="badge badge-amber">★ Featured</span> : <span className="badge badge-gray">Standard</span>}</td>
                        <td><div style={{ display: 'flex', gap: 6 }}><button type="button" className="btn btn-outline btn-sm" onClick={() => openEdit(p)}>Edit</button><button type="button" className="btn btn-danger btn-sm" onClick={() => delProd(p)}>Delete</button></div></td>
                      </tr>
                    ))}</tbody>
                  </table></div></div>
                )}
              </>}

              {/* ── ORDERS ── */}
              {page === 'orders' && <>
                <div className="toolbar">
                  <div className="search-wrap">{I.search}<input className="search-input" type="text" placeholder="Search by order ID or customer…" value={orderSearch} onChange={e => setOrderSearch(e.target.value)} /></div>
                  <select className="filter-select" value={orderStatusF} onChange={e => setOrderStatusF(e.target.value)}><option value="">All Statuses</option>{STATUSES.map(s => <option key={s} value={s}>{s}</option>)}</select>
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => reloadOrders()}>{I.refresh} Refresh</button>
                </div>
                <div className="card"><div className="tbl-wrap">
                  {ordersLoading ? <div className="loading-overlay"><div className="spin" /><p>Loading orders…</p></div> : filteredOrders.length === 0 ? <div className="empty"><div className="empty-icon">{I.order}</div><h3>No orders found</h3></div> : (
                    <table><thead><tr><th>Order ID</th><th>Customer</th><th>Date</th><th>Amount</th><th>Status</th><th>Items</th><th>Stock</th><th>Update</th></tr></thead>
                      <tbody>{filteredOrders.map(o => {
                        const delivered = (o.per_delivered || 0) >= 100;
                        return <tr key={o.name}>
                          <td style={{ fontFamily: 'ui-monospace,monospace', fontSize: 11, color: 'var(--text2)', letterSpacing: '.01em' }}>{o.name}</td>
                          <td><div style={{ fontWeight: 500, fontSize: 13 }}>{o.customer || '-'}</div>{(o.contact_mobile || o.contact_email) && <div style={{ fontSize: 11, color: 'var(--text3)' }}>{o.contact_mobile || o.contact_email}</div>}</td>
                          <td style={{ color: 'var(--text3)', fontSize: 12 }}>{fmtDate(o.transaction_date)}</td>
                          <td style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>${(o.grand_total || 0).toFixed(2)}</td>
                          <td><span className={`badge ${sBadgeCls(o.status)}`}>{(o.status || '-').replace('To Deliver and Bill', 'Pending').replace('To Deliver', 'Dispatch').replace('To Bill', 'Billing')}</span></td>
                          <td><button type="button" className="btn btn-outline btn-sm" onClick={() => viewOrder(o.name)}>{I.eye} Items</button></td>
                          <td>{delivered ? <span className="badge badge-green">Shipped</span> : o.status === 'Cancelled' ? <span className="badge badge-red">Cancelled</span> : <button type="button" className="btn btn-gold btn-sm" onClick={() => shipOrder(o.name)}>{I.truck} Ship</button>}</td>
                          <td><select className="status-select" value={o.status || ''} onChange={e => updateStatus(o.name, e.target.value)}>{STATUSES.map(s => <option key={s} value={s}>{s}</option>)}</select></td>
                        </tr>;
                      })}</tbody></table>
                  )}
                </div></div>
              </>}

              {/* ── CUSTOMERS ── */}
              {page === 'customers' && <>
                <div className="toolbar">
                  <div className="search-wrap">{I.search}<input className="search-input" type="text" placeholder="Search customers…" value={custSearch} onChange={e => setCustSearch(e.target.value)} /></div>
                  <button type="button" className="btn btn-gold btn-sm" onClick={() => reloadCustomers()}>{I.refresh} Refresh</button>
                </div>
                <div className="card">
                  <div className="card-hd"><h2>All Customers</h2></div>
                  {custLoading ? <div className="loading-overlay"><div className="spin" /><p>Loading customers…</p></div> : filteredCusts.length === 0 ? <div className="empty"><div className="empty-icon">{I.users}</div><h3>No customers found</h3><p>Customers are created automatically when orders are placed.</p></div> : (
                    <div className="tbl-wrap"><table><thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Type</th><th>Joined</th><th>Details</th></tr></thead>
                      <tbody>{filteredCusts.map(c => (
                        <tr key={c.name}>
                          <td className="td-name">{c.customer_name || c.name}</td>
                          <td style={{ fontSize: 12, color: 'var(--text2)' }}>{c.email_id || '-'}</td>
                          <td style={{ fontSize: 12, color: 'var(--text2)' }}>{c.mobile_no || '-'}</td>
                          <td><span style={{ fontSize: 11, background: 'var(--blue-bg)', color: 'var(--blue)', padding: '2px 8px', borderRadius: 99 }}>{c.customer_type || 'Individual'}</span></td>
                          <td style={{ fontSize: 12, color: 'var(--text3)' }}>{c.creation ? new Date(c.creation).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}</td>
                          <td><button type="button" className="btn btn-outline btn-sm" onClick={() => viewCust(c.customer_name || c.name, c.email_id || '')}>{I.eye} View</button></td>
                        </tr>
                      ))}</tbody></table></div>
                  )}
                </div>
              </>}

              {/* ── VIDEO CALL BOOKINGS ── */}
              {page === 'bookings' && <>
                <div className="toolbar">
                  <div className="search-wrap">{I.search}<input className="search-input" type="text" placeholder="Search by name, phone or email…" value={bookingSearch} onChange={e => setBookingSearch(e.target.value)} /></div>
                  <button type="button" className="btn btn-gold btn-sm" onClick={() => reloadBookings()}>{I.refresh} Refresh</button>
                </div>
                <div className="card">
                  <div className="card-hd"><h2>Video Call Requests</h2></div>
                  {bookingsLoading ? <div className="loading-overlay"><div className="spin" /><p>Loading requests…</p></div>
                    : filteredBookings.length === 0 ? <div className="empty"><div className="empty-icon">{I.video}</div><h3>No requests yet</h3><p>Requests from the &ldquo;Book a Video Call&rdquo; button on the storefront appear here.</p></div> : (
                    <div className="tbl-wrap"><table><thead><tr><th>Ref</th><th>Name</th><th>Contact</th><th>Preferred</th><th>Looking for</th><th>Status</th></tr></thead>
                      <tbody>{filteredBookings.map(b => (
                        <tr key={b.name}>
                          <td style={{ fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 11.5 }}>{b.name}</td>
                          <td className="td-name">{b.customer_name}</td>
                          <td style={{ fontSize: 12, color: 'var(--text2)' }}>
                            <a href={`tel:${b.phone}`} style={{ color: 'var(--text2)' }}>{b.phone}</a>
                            {b.email ? <><br /><span style={{ color: 'var(--text3)' }}>{b.email}</span></> : null}
                          </td>
                          <td style={{ fontSize: 12, color: 'var(--text2)' }}>
                            {b.preferred_date ? new Date(b.preferred_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : 'Any date'}
                            {b.preferred_time ? <><br /><span style={{ color: 'var(--text3)' }}>{b.preferred_time}</span></> : null}
                          </td>
                          <td style={{ fontSize: 12, color: 'var(--text3)', maxWidth: 200 }}>{b.notes || '-'}</td>
                          <td>
                            <select
                              className="form-input"
                              style={{ padding: '4px 8px', fontSize: 12 }}
                              value={b.status}
                              onChange={async e => {
                                const status = e.target.value;
                                try { await setBookingStatus(b.name, status); toast('Status updated', 'success'); reloadBookings(); }
                                catch { toast('Could not update status', 'error'); }
                              }}
                            >
                              {['New', 'Confirmed', 'Completed', 'Cancelled'].map(o => <option key={o} value={o}>{o}</option>)}
                            </select>
                          </td>
                        </tr>
                      ))}</tbody></table></div>
                  )}
                </div>
              </>}

              {/* ── HOMEPAGE ── */}
              {page === 'homepage' && <>
                <div className="toolbar" style={{ justifyContent: 'space-between' }}>
                  <div style={{ fontSize: 13, color: 'var(--text2)' }}>Select which products appear in each section on the home page</div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => reloadHp()}>{I.refresh} Refresh</button>
                    <button type="button" className="btn btn-gold btn-sm" onClick={saveHomepage} disabled={hpSaving}>{I.save} {hpSaving ? 'Saving…' : 'Save Homepage'}</button>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                  <div className="card"><div className="card-hd"><h2>Most Loved Pieces</h2><span style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 400 }}>{hpML.length} selected</span></div>
                    <div className="card-body" style={{ padding: 12 }}><div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 12, padding: '0 4px' }}>Check the products you want to show in this section</div>
                      {hpLoading ? <div className="loading-overlay"><div className="spin" /></div> : <HpSection items={hpItemsList} selected={hpML} onToggle={id => setHpML(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id])} />}</div>
                  </div>
                  <div className="card"><div className="card-hd"><h2>New Arrivals</h2><span style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 400 }}>{hpNA.length} selected</span></div>
                    <div className="card-body" style={{ padding: 12 }}><div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 12, padding: '0 4px' }}>Check the products you want to show in this section</div>
                      {hpLoading ? <div className="loading-overlay"><div className="spin" /></div> : <HpSection items={hpItemsList} selected={hpNA} onToggle={id => setHpNA(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id])} />}</div>
                  </div>
                </div>
              </>}

              {/* ── OFFERS ── */}
              {page === 'offers' && <>
                <div className="toolbar" style={{ justifyContent: 'space-between' }}>
                  <div style={{ fontSize: 13, color: 'var(--text2)' }}>Manage coupon codes in ERPNext → Accounts → Coupon Code</div>
                  <button type="button" className="btn btn-gold btn-sm" onClick={() => reloadOffers()}>{I.refresh} Refresh</button>
                </div>
                <div className="card" style={{ marginBottom: 20 }}>
                  <div className="card-hd"><h2>Create Coupon Code</h2></div>
                  <div className="card-body">
                    <form onSubmit={createCoupon}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 16 }}>
                        <div className="form-group"><label className="form-label">Coupon Code <span className="req">*</span></label><input className="form-input" type="text" placeholder="SAVE20" value={ofCode} onChange={e => setOfCode(e.target.value.toUpperCase())} /></div>
                        <div className="form-group"><label className="form-label">Discount % <span className="req">*</span></label><input className="form-input" type="number" min="1" max="100" placeholder="20" value={ofPct} onChange={e => setOfPct(e.target.value)} /></div>
                        <div className="form-group"><label className="form-label">Min. Order ($)</label><input className="form-input" type="number" min="0" max="999999" step="0.01" placeholder="0" value={ofMin} onChange={e => setOfMin(e.target.value)} /></div>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                        <div className="form-group"><label className="form-label">Valid From</label><input className="form-input" type="date" value={ofFrom} onChange={e => setOfFrom(e.target.value)} /></div>
                        <div className="form-group"><label className="form-label">Valid Until <span className="req">*</span></label><input className="form-input" type="date" value={ofUpto} onChange={e => setOfUpto(e.target.value)} /></div>
                      </div>
                      <div className="form-group" style={{ marginBottom: 16 }}><label className="form-label">Description</label><input className="form-input" type="text" placeholder="e.g. 20% off all orders" value={ofDesc} onChange={e => setOfDesc(e.target.value)} /></div>
                      <button className="btn btn-gold" type="submit">Create Coupon Code</button>
                    </form>
                  </div>
                </div>
                <div className="card"><div className="card-hd"><h2>Active Coupon Codes</h2></div>
                  {offersLoading ? <div className="loading-overlay"><div className="spin" /><p>Loading…</p></div> : allOffers.length === 0 ? <div className="empty"><div className="empty-icon">{I.offer}</div><h3>No coupon codes yet</h3><p>Create your first coupon above.</p></div> : (
                    <div className="tbl-wrap"><table><thead><tr><th>Code</th><th>Discount</th><th>Min. Order</th><th>Valid Until</th><th>Status</th><th>Actions</th></tr></thead>
                      <tbody>{allOffers.map(o => {
                        const today = new Date().toISOString().split('T')[0]; const expired = !!(o.valid_upto && o.valid_upto < today); return (
                          <tr key={o.name}>
                            <td><span style={{ fontFamily: 'monospace', fontSize: 14, fontWeight: 700, color: 'var(--gold)', background: 'var(--gold-xl)', padding: '3px 10px', borderRadius: 6 }}>{o.coupon_code}</span></td>
                            <td style={{ fontWeight: 600 }}>{o.discount_percentage ? o.discount_percentage + '%' : '-'}</td>
                            <td>{o.minimum_amount ? '$' + o.minimum_amount : 'Any'}</td>
                            <td style={{ fontSize: 12, color: 'var(--text2)' }}>{o.valid_upto || '-'}</td>
                            <td><span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 99, background: expired ? 'var(--red-bg)' : 'var(--green-bg)', color: expired ? 'var(--red)' : 'var(--green)' }}>{expired ? 'Expired' : 'Active'}</span></td>
                            <td><button type="button" style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', fontSize: 12, borderRadius: 6, background: 'var(--red-bg)', color: 'var(--red)', border: 'none', cursor: 'pointer' }} onClick={() => delCoupon(o.name)}>{I.trash} Delete</button></td>
                          </tr>);
                      })}</tbody></table></div>
                  )}
                </div>
              </>}

              {/* ── SETTINGS ── */}
              {page === 'settings' && <>
                <div className="settings-section">
                  <h2>Account</h2>
                  <p className="desc">Logged in as <strong>{currentUser}</strong></p>
                  <button className="btn btn-danger" type="button" onClick={logout} style={{ marginTop: 12 }}>{I.logout} Sign Out</button>
                </div>
                <div className="settings-section">
                  <h2>Backend</h2>
                  {mode === 'frappe' ? (
                    <p className="desc">
                      Connected to <strong>Frappe / ERPNext</strong>. Products, orders and customers
                      shown here are live records on the server.
                    </p>
                  ) : (
                    <>
                      <p className="desc">
                        No Frappe backend is reachable, so the panel is running on the built-in
                        catalogue. Everything works, but products, orders and customers are stored
                        in this browser only — they are not visible to anyone else.
                      </p>
                      <button
                        className="btn btn-outline"
                        type="button"
                        style={{ marginTop: 12 }}
                        onClick={() => setConfirmDlg({
                          title: 'Reset demo data?',
                          msg: 'This clears every product edit, order, customer and coupon made in this browser and restores the original catalogue. It cannot be undone.',
                          onOk: () => {
                            db.resetAll();
                            toast('Demo data reset', 'success');
                            setTimeout(() => window.location.reload(), 700);
                          },
                        })}
                      >
                        Reset demo data
                      </button>
                    </>
                  )}
                </div>
                <div className="settings-section">
                  <h2>Catalog Settings</h2>
                  <p className="desc">Default settings for product management.</p>
                  <form onSubmit={e => { e.preventDefault(); localStorage.setItem('hs_item_group', itemGroup); toast('Settings saved', 'success'); }}>
                    <div className="form-grid">
                      <div className="form-group"><label className="form-label">Default Item Group</label><input className="form-input" type="text" value={itemGroup} onChange={e => setItemGroup(e.target.value)} placeholder="Jewelry" /></div>
                    </div>
                    <div style={{ marginTop: 16 }}><button className="btn btn-gold" type="submit">Save Settings</button></div>
                  </form>
                </div>
                <div className="settings-section">
                  <h2>Social Media Accounts</h2>
                  <p className="desc">Connect your social media profiles. Links will appear in the footer across your store.</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {([
                      {
                        key: 'instagram', label: 'Instagram', val: smInstagram, set: setSmInstagram, ph: 'https://instagram.com/yourhandle', color: '#E1306C',
                        icon: <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="2" y="2" width="20" height="20" rx="5" /><circle cx="12" cy="12" r="5" /><circle cx="17.5" cy="6.5" r="1.5" fill="currentColor" stroke="none" /></svg>
                      },
                      {
                        key: 'facebook', label: 'Facebook', val: smFacebook, set: setSmFacebook, ph: 'https://facebook.com/yourpage', color: '#1877F2',
                        icon: <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z" /></svg>
                      },
                      {
                        key: 'pinterest', label: 'Pinterest', val: smPinterest, set: setSmPinterest, ph: 'https://pinterest.com/yourprofile', color: '#E60023',
                        icon: <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 2C6.48 2 2 6.48 2 12c0 4.24 2.65 7.86 6.39 9.29-.09-.78-.17-1.98.04-2.83.18-.77 1.24-5.24 1.24-5.24s-.32-.63-.32-1.57c0-1.47.85-2.57 1.91-2.57.9 0 1.34.68 1.34 1.49 0 .91-.58 2.27-.88 3.53-.25 1.05.52 1.91 1.56 1.91 1.87 0 3.13-2.4 3.13-5.23 0-2.16-1.46-3.67-3.55-3.67-2.42 0-3.84 1.82-3.84 3.7 0 .73.28 1.52.63 1.94.07.08.08.16.06.24l-.24.96c-.04.15-.12.18-.28.11-1.04-.48-1.69-2-1.69-3.22 0-2.62 1.9-5.02 5.48-5.02 2.88 0 5.12 2.05 5.12 4.79 0 2.86-1.8 5.16-4.3 5.16-.84 0-1.63-.44-1.9-.95l-.52 1.93c-.19.71-.69 1.61-1.03 2.15.78.24 1.6.37 2.45.37 5.52 0 10-4.48 10-10S17.52 2 12 2z" /></svg>
                      },
                      {
                        key: 'tiktok', label: 'TikTok', val: smTiktok, set: setSmTiktok, ph: 'https://tiktok.com/@yourhandle', color: '#010101',
                        icon: <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.32 6.32 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.18 8.18 0 004.78 1.52V6.73a4.85 4.85 0 01-1.01-.04z" /></svg>
                      },
                      {
                        key: 'whatsapp', label: 'WhatsApp', val: smWhatsapp, set: setSmWhatsapp, ph: 'https://wa.me/919876543210', color: '#25D366',
                        icon: <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" /></svg>
                      },
                    ] as { key: string; label: string; val: string; set: (v: string) => void; ph: string; color: string; icon: React.ReactNode }[]).map(({ key, label, val, set, ph, color, icon }) => (
                      <div key={key} style={{ display: 'grid', gridTemplateColumns: '190px 1fr auto', gap: 12, alignItems: 'center', padding: '12px 16px', background: 'var(--surface)', borderRadius: 10, border: `1.5px solid ${val ? '#b8e8d4' : 'var(--border)'}` }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ width: 34, height: 34, borderRadius: 8, background: color + '22', color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{icon}</span>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{label}</div>
                            {val ? <span className="badge badge-green" style={{ marginTop: 2 }}>Connected</span> : <span style={{ fontSize: 11, color: 'var(--text3)' }}>Not connected</span>}
                          </div>
                        </div>
                        <input className="form-input" type="url" placeholder={ph} value={val} onChange={e => set(e.target.value)} style={{ margin: 0 }} />
                        {val && (
                          <button type="button" onClick={() => { set(''); localStorage.removeItem(`hs_sm_${key}`); window.dispatchEvent(new Event('hs_social_updated')); toast(`${label} disconnected`, 'info'); }}
                            style={{ background: 'var(--red-bg)', color: 'var(--red)', border: 'none', borderRadius: 8, padding: '8px 12px', fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap', fontWeight: 500, fontFamily: 'inherit' }}>
                            Remove
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  <div style={{ marginTop: 18 }}>
                    <button className="btn btn-gold" type="button" onClick={() => {
                      const map: { [k: string]: string } = { instagram: smInstagram, facebook: smFacebook, pinterest: smPinterest, tiktok: smTiktok, whatsapp: smWhatsapp };
                      Object.entries(map).forEach(([k, v]) => { if (v) localStorage.setItem(`hs_sm_${k}`, v); else localStorage.removeItem(`hs_sm_${k}`); });
                      window.dispatchEvent(new Event('hs_social_updated'));
                      toast('Social media links saved', 'success');
                    }}>Save Social Links</button>
                  </div>
                </div>
                <div className="settings-section">
                  <h2>Instagram Posts — Spotted in Hira</h2>
                  <p className="desc">Paste up to 6 Instagram post URLs. They appear in the "Spotted in Hira" section on the homepage.</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {igPosts.map((url, i) => (
                      <div key={i} style={{ display: 'grid', gridTemplateColumns: '64px 1fr auto', gap: 10, alignItems: 'center' }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text3)' }}>Post {i + 1}</span>
                        <input className="form-input" type="url" style={{ margin: 0 }} placeholder="https://www.instagram.com/p/..." value={url}
                          onChange={e => { const a = [...igPosts]; a[i] = e.target.value; setIgPosts(a); }} />
                        {url && (
                          <button type="button"
                            onClick={() => { const a = [...igPosts]; a[i] = ''; setIgPosts(a); }}
                            style={{ background: 'var(--red-bg)', color: 'var(--red)', border: 'none', borderRadius: 8, padding: '8px 10px', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', lineHeight: 1 }}>
                            ✕
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  <div style={{ marginTop: 18 }}>
                    <button className="btn btn-gold" type="button" onClick={() => {
                      const filled = igPosts.filter(u => u.trim());
                      localStorage.setItem('hs_ig_posts', JSON.stringify(filled));
                      window.dispatchEvent(new Event('hs_ig_updated'));
                      toast('Instagram posts saved', 'success');
                    }}>Save Posts</button>
                  </div>
                </div>
                <div className="settings-section">
                  <h2>Custom Fields Required on Item</h2>
                  <p style={{ fontSize: 12, color: 'var(--text3)', marginTop: 8 }}><code>custom_is_featured</code> (Check) · <code>custom_material</code> (Data) · <code>custom_short_description</code> (Small Text) · <code>custom_item_images</code> (Small Text)</p>
                </div>
              </>}

            </div>
          </main>
        </div>
      )}

      {/* PRODUCT MODAL */}
      {prodModal && (
        <div className="modal-bg open" onClick={e => { if (e.target === e.currentTarget) setProdModal(false); }}>
          <div className="modal">
            <div className="modal-hd"><h3>{editingId ? 'Edit Product' : 'Add New Product'}</h3><button type="button" className="modal-close" onClick={() => setProdModal(false)}>{I.close}</button></div>
            <div className="modal-body">
              <div className="form-grid">
                <div className="form-group full"><label className="form-label">Product Name <span className="req">*</span></label><input className="form-input" type="text" placeholder="e.g. Silver Meenakari Earrings" value={pf.name} onChange={e => setPf(p => ({ ...p, name: e.target.value }))} /></div>
                <div className="form-group"><label className="form-label">Price (USD) <span className="req">*</span></label><input className="form-input" type="number" min="0" max="999999" step="0.01" placeholder="0.00" value={pf.price} onChange={e => setPf(p => ({ ...p, price: e.target.value }))} /></div>
                <div className="form-group"><label className="form-label">Weight</label><input className="form-input" type="text" placeholder="e.g. 22 grams" value={pf.weight} onChange={e => setPf(p => ({ ...p, weight: e.target.value }))} /></div>
                <div className="form-group"><label className="form-label">Category <span className="req">*</span></label>
                  <select className="form-select" value={pf.category} onChange={e => setPf(p => ({ ...p, category: e.target.value }))}>
                    <option value="">Select category…</option>
                    {['Earrings', 'Necklaces', 'Rings', 'Bracelets', 'Anklets', 'Sets', 'Pendants', 'Other'].map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div className="form-group"><label className="form-label">Material</label><input className="form-input" type="text" placeholder="e.g. 925 Silver" value={pf.material} onChange={e => setPf(p => ({ ...p, material: e.target.value }))} /></div>
                <div className="form-group full"><label className="form-label">Short Description</label><textarea className="form-textarea" placeholder="Brief description…" maxLength={500} value={pf.desc} onChange={e => setPf(p => ({ ...p, desc: e.target.value }))} /></div>
                <div className="form-group full">
                  <label className="form-label">Product Image</label>
                  <div className="img-upload-zone"
                    onClick={() => document.getElementById('adm-img-in')?.click()}
                    onDragOver={e => { e.preventDefault(); (e.currentTarget as HTMLElement).style.borderColor = 'var(--gold)'; }}
                    onDragLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = ''; }}
                    onDrop={e => { e.preventDefault(); (e.currentTarget as HTMLElement).style.borderColor = ''; const file = e.dataTransfer.files[0]; if (file && file.type.startsWith('image/')) { const r2 = new FileReader(); r2.onload = ev => setPf(p => ({ ...p, imageFile: file, imagePreview: ev.target?.result as string })); r2.readAsDataURL(file); } }}>
                    {pf.imagePreview
                      ? <img src={pf.imagePreview} alt="Preview" className="img-preview" style={{ display: 'block' }} />
                      : <div><div className="upload-icon">{I.upload}</div><p><strong>Click to upload</strong> or drag and drop</p><p style={{ fontSize: 11, marginTop: 4 }}>JPG, PNG, WebP, max 5MB</p></div>
                    }
                  </div>
                  <input type="file" id="adm-img-in" accept="image/*" style={{ display: 'none' }} onChange={e => { const file = e.target.files?.[0]; if (!file) return; const r2 = new FileReader(); r2.onload = ev => setPf(p => ({ ...p, imageFile: file, imagePreview: ev.target?.result as string })); r2.readAsDataURL(file); }} />
                </div>
                <div className="form-group full">
                  <label className="form-label">Additional Images (up to 4)</label>
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    {pf.extraImgs.map((ei, i) => (
                      <div key={i} style={{ position: 'relative', width: '88px', height: '88px', border: '2px dashed #e0d8d0', borderRadius: '8px', overflow: 'hidden', cursor: 'pointer', background: '#faf9f7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                        onClick={() => document.getElementById(`adm-ximg-${i}`)?.click()}>
                        {ei.preview
                          ? <>
                            <img src={ei.preview} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                            <button type="button" onClick={e => { e.stopPropagation(); setPf(p => { const a = [...p.extraImgs]; a[i] = { url: '', file: null, preview: '' }; return { ...p, extraImgs: a }; }) }} style={{ position: 'absolute', top: 3, right: 3, background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: '50%', width: 18, height: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 11, padding: 0 }}>✕</button>
                          </>
                          : <div style={{ textAlign: 'center', color: '#a89580', pointerEvents: 'none' }}><div style={{ fontSize: 22, lineHeight: 1 }}>+</div><div style={{ fontSize: 10, marginTop: 2 }}>Add</div></div>
                        }
                        <input type="file" id={`adm-ximg-${i}`} accept="image/*" style={{ display: 'none' }} onChange={e => { const file = e.target.files?.[0]; if (!file) return; const r2 = new FileReader(); r2.onload = ev => setPf(p => { const a = [...p.extraImgs]; a[i] = { url: '', file, preview: ev.target?.result as string }; return { ...p, extraImgs: a }; }); r2.readAsDataURL(file); }} />
                      </div>
                    ))}
                  </div>
                  <p style={{ fontSize: 11, color: '#a89580', marginTop: 6 }}>These appear in the product gallery and quick view thumbnails.</p>
                </div>
                <div className="form-group full">
                  <label className="toggle-wrap" style={{ cursor: 'pointer' }}>
                    <span className="toggle"><input type="checkbox" checked={pf.featured} onChange={e => setPf(p => ({ ...p, featured: e.target.checked }))} /><span className="toggle-track" /><span className="toggle-thumb" /></span>
                    <span style={{ fontSize: 13, fontWeight: 500 }}>Featured on Homepage</span>
                  </label>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-outline" onClick={() => setProdModal(false)}>Cancel</button>
              <button type="button" className="btn btn-gold" onClick={saveProd} disabled={prodSaving}>
                {prodSaving ? <><div className="spin" style={{ width: 16, height: 16 }} /> Saving…</> : <>{I.check} {editingId ? 'Save Changes' : 'Add Product'}</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ORDER DETAIL MODAL */}
      {orderModal && (
        <div className="modal-bg open" onClick={e => { if (e.target === e.currentTarget) setOrderModal(null); }}>
          <div className="modal" style={{ maxWidth: 640 }}>
            <div className="modal-hd"><h3>{orderModal.order.name}</h3><button type="button" className="modal-close" onClick={() => setOrderModal(null)}>{I.close}</button></div>
            <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
              {orderModalLoading ? <div className="loading-overlay"><div className="spin" /></div> : <OrderDetailBody order={orderModal.order} addr={orderModal.addr} />}
            </div>
          </div>
        </div>
      )}

      {/* CUSTOMER DETAIL MODAL */}
      {custModal && (
        <div className="modal-bg open" onClick={e => { if (e.target === e.currentTarget) setCustModal(null); }}>
          <div className="modal" style={{ maxWidth: 660 }}>
            <div className="modal-hd"><h3>{custModal.name}</h3><button type="button" className="modal-close" onClick={() => setCustModal(null)}>{I.close}</button></div>
            <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
              {custModalLoading ? <div className="loading-overlay"><div className="spin" /></div> : <CustomerDetailBody data={custModal} />}
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM MODAL */}
      {confirmDlg && (
        <div className="modal-bg open" onClick={e => { if (e.target === e.currentTarget) setConfirmDlg(null); }}>
          <div className="modal confirm-modal">
            <div className="modal-body" style={{ textAlign: 'center', padding: '32px 26px' }}>
              <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#c03838" strokeWidth="1.5" style={{ margin: '0 auto' }}><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
              <h3 style={{ fontVariantNumeric: 'tabular-nums', fontSize: 20, marginTop: 12 }}>{confirmDlg.title}</h3>
              <p style={{ fontSize: 14, color: 'var(--text2)', marginTop: 8 }}>{confirmDlg.msg}</p>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-outline" onClick={() => setConfirmDlg(null)}>Cancel</button>
              <button type="button" className="btn btn-danger" onClick={confirmDlg.onOk}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* TOASTS */}
      <div className="toast-container">
        {toasts.map(t => (
          <div key={t.id} className={`toast ${t.type}`}>
            {t.type === 'success' ? I.ok : t.type === 'error' ? I.err : I.info2}
            <span>{t.msg}</span>
          </div>
        ))}
      </div>

    </div>
  );
}
