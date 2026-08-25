import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useFrappeAuth, useFrappeGetDoc } from '@/lib/frappe';
import { getMyOrders } from '@/lib/backend';
import { useWishlist } from '@/store/wishlist';
import { HOME_URL } from '@/lib/config';

interface Order { name: string; transaction_date: string; grand_total: number; status: string; }
interface FrappeUser { full_name?: string; email?: string; }

const OFFERS = [
  { code: 'HIRA30', title: '30% Off Sitewide', desc: 'Valid on all orders above ₹999', min: 'Min. order ₹999' },
  { code: 'FREESHIP', title: 'Free Shipping', desc: 'On orders over $100', min: 'Min. order $100' },
];

function statusClass(s: string) {
  const l = s?.toLowerCase();
  if (l === 'completed') return 'completed';
  if (l === 'to deliver and bill' || l === 'to deliver') return 'to-deliver';
  if (l === 'cancelled') return 'cancelled';
  if (l === 'on hold') return 'on-hold';
  return 'draft';
}

export default function AccountPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<'orders' | 'profile' | 'offers'>('orders');
  const [copied, setCopied] = useState('');

  const setWishlistUser = useWishlist(s => s.setUser);
  const { currentUser, logout, isLoading: authLoading } = useFrappeAuth();
  const { data: userDoc } = useFrappeGetDoc<FrappeUser>('User', currentUser ?? undefined);
  const [orders, setOrders] = useState<Order[]>([]);
  useEffect(() => {
    if (!currentUser) { setOrders([]); return; }
    let alive = true;
    getMyOrders()
      .then(list => { if (alive) setOrders(list as Order[]); })
      .catch(() => { if (alive) setOrders([]); });
    return () => { alive = false; };
  }, [currentUser]);

  useEffect(() => {
    if (!authLoading && !currentUser) navigate('/login');
    if (currentUser) setWishlistUser(currentUser);
  }, [currentUser, authLoading]);

  async function handleLogout() {
    await logout();
    setWishlistUser(null);
    window.location.href = HOME_URL;
  }

  function copyCode(code: string) {
    navigator.clipboard.writeText(code).catch(() => {});
    setCopied(code);
    setTimeout(() => setCopied(''), 2000);
  }

  const fullName = userDoc?.full_name || currentUser || '';
  const initials = fullName.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase() || '?';

  if (authLoading || !currentUser) return <div style={{ textAlign: 'center', padding: '80px', color: '#6b8b91' }}>Loading…</div>;

  return (
    <div className="acct-page">
      <div className="page-wrap">
        {/* Sidebar */}
        <div className="account-sidebar">
          <div className="user-block">
            <div className="user-avatar">{initials}</div>
            <div className="user-name">{fullName}</div>
            <div className="user-email">{currentUser}</div>
          </div>
          <div className="side-nav">
            {([
              { key: 'orders', label: 'My Orders', icon: <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/> },
              { key: 'profile', label: 'Profile', icon: <><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></> },
              { key: 'offers', label: 'My Offers', icon: <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82zM7 7h.01"/> },
            ] as Array<{ key: 'orders' | 'profile' | 'offers'; label: string; icon: React.ReactNode }>).map(item => (
              <button
                type="button"
                key={item.key}
                className={`side-nav-item${tab === item.key ? ' active' : ''}`}
                onClick={() => setTab(item.key)}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">{item.icon}</svg>
                <span className="label">{item.label}</span>
              </button>
            ))}
            <button type="button" className="side-nav-item" onClick={handleLogout}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
              <span className="label">Sign Out</span>
            </button>
          </div>
        </div>

        {/* Main panels */}
        <div>
          {/* Orders panel */}
          <div className={`panel${tab === 'orders' ? ' active' : ''}`}>
            <div className="card">
              <div className="card-head">
                <h2>My Orders</h2>
                <p>Track and manage your purchases</p>
              </div>
              <div className="card-body">
                {orders.length === 0 ? (
                  <div className="empty-state">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
                    <h3>No orders yet</h3>
                    <p>Your order history will appear here</p>
                  </div>
                ) : (
                  <div className="orders-table-wrap">
                    <table className="orders-table">
                      <thead>
                        <tr>
                          <th>Order</th>
                          <th>Date</th>
                          <th>Status</th>
                          <th>Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {orders.map(o => (
                          <tr key={o.name}>
                            <td><span className="order-num">{o.name}</span></td>
                            <td>{new Date(o.transaction_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                            <td><span className={`status-badge ${statusClass(o.status)}`}>{o.status}</span></td>
                            <td>${Number(o.grand_total).toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Profile panel */}
          <div className={`panel${tab === 'profile' ? ' active' : ''}`}>
            <div className="card">
              <div className="card-head">
                <h2>My Profile</h2>
                <p>Your account details</p>
              </div>
              <div className="card-body">
                <div className="field">
                  <label>Full Name</label>
                  <input type="text" defaultValue={fullName} readOnly />
                </div>
                <div className="field">
                  <label>Email Address</label>
                  <input type="email" defaultValue={currentUser ?? ''} readOnly autoComplete="email" />
                </div>
                <p style={{ fontSize: '12px', color: '#6b8b91', marginTop: '8px' }}>
                  To update your details, please contact support.
                </p>
              </div>
            </div>
          </div>

          {/* Offers panel */}
          <div className={`panel${tab === 'offers' ? ' active' : ''}`}>
            <div className="card">
              <div className="card-head">
                <h2>My Offers</h2>
                <p>Exclusive discounts just for you</p>
              </div>
              <div className="card-body">
                <div className="offers-grid">
                  {OFFERS.map(offer => (
                    <div key={offer.code} className="offer-card">
                      <div className="offer-code">{offer.code}</div>
                      <div className="offer-title">{offer.title}</div>
                      <div className="offer-desc">{offer.desc}</div>
                      <div className="offer-min">{offer.min}</div>
                      <button type="button" className="copy-btn" onClick={() => copyCode(offer.code)}>
                        {copied === offer.code ? 'Copied!' : 'Copy Code'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .acct-page { background:#f8fbfc;min-height:100vh; }
        .page-wrap { max-width:900px;margin:0 auto;padding:40px 24px;display:grid;grid-template-columns:220px 1fr;gap:28px;align-items:start; }
        .account-sidebar {}
        .user-block { background:#fff;border-radius:10px;border:1px solid #ddeef1;padding:24px;margin-bottom:16px;text-align:center;box-shadow:0 2px 24px rgba(0,26,32,.09); }
        .user-avatar { width:60px;height:60px;border-radius:50%;background:#e0f2f4;border:2px solid #005969;display:flex;align-items:center;justify-content:center;font-family:'Playfair Display',serif;font-size:22px;color:#005969;margin:0 auto 12px;font-weight:600; }
        .user-name { font-family:'Playfair Display',serif;font-size:1.1rem;color:#005969;margin-bottom:3px; }
        .user-email { font-size:12px;color:#6b8b91; }
        .side-nav { background:#fff;border-radius:10px;border:1px solid #ddeef1;overflow:hidden;box-shadow:0 2px 24px rgba(0,26,32,.09); }
        .side-nav-item { width:100%;display:flex;align-items:center;gap:10px;padding:13px 18px;font-size:13px;color:#6b8b91;cursor:pointer;transition:background .15s,color .15s;border-left:2px solid transparent;background:none;border-top:none;border-right:none;border-bottom:none;font-family:inherit;text-align:left; }
        .side-nav-item svg { width:16px;height:16px;flex-shrink:0; }
        .side-nav-item:hover { background:#f0f8f9;color:#005969; }
        .side-nav-item.active { background:#e0f2f4;color:#005969;border-left-color:#005969;font-weight:500; }
        .side-nav-item+.side-nav-item { border-top:1px solid #ddeef1; }
        .panel { display:none; }
        .panel.active { display:block; }
        .card { background:#fff;border-radius:10px;border:1px solid #ddeef1;box-shadow:0 2px 24px rgba(0,26,32,.09); }
        .card-head { padding:20px 24px 16px;border-bottom:1px solid #ddeef1; }
        .card-head h2 { font-family:'Playfair Display',serif;font-size:1.3rem;color:#005969;font-weight:400; }
        .card-head p { font-size:12px;color:#6b8b91;margin-top:3px; }
        .card-body { padding:24px; }
        .orders-table-wrap { overflow-x:auto;-webkit-overflow-scrolling:touch; }
        .orders-table { width:100%;border-collapse:collapse; }
        .orders-table th { font-size:11px;font-weight:500;color:#6b8b91;text-transform:uppercase;letter-spacing:.05em;padding:10px 14px;text-align:left;border-bottom:1px solid #ddeef1; }
        .orders-table td { padding:13px 14px;font-size:13px;border-bottom:1px solid #ddeef1; }
        .orders-table tr:last-child td { border-bottom:none; }
        .orders-table tr:hover td { background:#f0f8f9; }
        .order-num { font-family:'Cormorant Garamond',serif;color:#005969;font-weight:500; }
        .status-badge { display:inline-flex;align-items:center;gap:5px;padding:3px 10px;border-radius:99px;font-size:11px;font-weight:500; }
        .status-badge.draft,.status-badge.completed { background:#f0fdf4;color:#15803d; }
        .status-badge.to-deliver { background:#eff6ff;color:#1d4ed8; }
        .status-badge.cancelled { background:#fef2f2;color:#dc2626; }
        .status-badge.on-hold { background:#fefce8;color:#a16207; }
        .field { margin-bottom:18px; }
        .field label { display:block;font-size:12px;font-weight:500;color:#6b8b91;text-transform:uppercase;letter-spacing:.06em;margin-bottom:7px; }
        .field input { width:100%;padding:10px 14px;border:1.5px solid #c8e0e4;border-radius:6px;font-size:14px;color:#334d52;background:#f0f8f9;outline:none; }
        .field input[readonly] { cursor:default; }
        .empty-state { text-align:center;padding:48px 24px;color:#6b8b91; }
        .empty-state svg { width:40px;height:40px;margin:0 auto 12px;opacity:.35; }
        .empty-state h3 { font-family:'Playfair Display',serif;font-size:1.1rem;color:#334d52;margin-bottom:4px; }
        .empty-state p { font-size:13px; }
        .offers-grid { display:grid;gap:16px; }
        .offer-card { background:linear-gradient(135deg,#005969 0%,#007a8c 100%);border-radius:10px;padding:22px;color:#fff;position:relative;overflow:hidden; }
        .offer-card::before { content:'';position:absolute;right:-30px;top:-30px;width:120px;height:120px;border-radius:50%;background:rgba(255,255,255,.06); }
        .offer-code { font-family:'Courier New',monospace;font-size:18px;font-weight:700;letter-spacing:.12em;background:rgba(255,255,255,.15);border-radius:6px;padding:6px 14px;display:inline-block;margin-bottom:10px; }
        .offer-title { font-size:16px;font-weight:500;margin-bottom:4px; }
        .offer-desc { font-size:12px;opacity:.8;margin-bottom:12px; }
        .offer-min { font-size:11px;opacity:.65; }
        .copy-btn { position:absolute;right:18px;bottom:18px;background:rgba(255,255,255,.2);border:1px solid rgba(255,255,255,.3);color:#fff;border-radius:6px;padding:6px 14px;font-size:12px;cursor:pointer;transition:background .2s;font-family:inherit; }
        .copy-btn:hover { background:rgba(255,255,255,.3); }
        @media(max-width:700px) { .page-wrap{grid-template-columns:1fr;padding:20px 16px} }
        @media(max-width:480px) { .side-nav-item .label{display:none} .side-nav-item{justify-content:center;padding:13px} .user-block{padding:16px} }
      `}</style>
    </div>
  );
}
