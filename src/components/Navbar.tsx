import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useFrappeAuth } from 'frappe-react-sdk';
import { useCart } from '@/store/cart';
import { useWishlist } from '@/store/wishlist';

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const totalItems = useCart(s => s.items.reduce((sum, item) => sum + item.qty, 0));
  const wishCount = useWishlist(s => s.items.length);
  const { currentUser } = useFrappeAuth();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (!currentUser) { setIsAdmin(false); return; }
    if (currentUser === 'Administrator') { setIsAdmin(true); return; }
    fetch(`/api/method/frappe.client.get_list?doctype=Has Role&filters=[["parent","=","${currentUser}"],["role","=","System Manager"]]&limit=1`, {
      credentials: 'include',
    })
      .then(r => r.json())
      .then(d => setIsAdmin(Array.isArray(d.message) && d.message.length > 0))
      .catch(() => setIsAdmin(false));
  }, [currentUser]);

  return (
    <>
      {/* Announcement Bar */}
      <div className="announcement">
        <div className="marquee-inner">
          <span>Free Shipping on orders over $15</span>
          <span>1 Year Warranty</span>
          <span>Premium Quality Jewellery</span>
          <span>Free Shipping on orders over $15</span>
          <span>1 Year Warranty</span>
          <span>Premium Quality Jewellery</span>
        </div>
      </div>

      <nav className={`nav${scrolled ? ' scrolled' : ''}`} id="navbar">
        <div className="nav-left">
          <button className="hamburger" aria-label="Menu" onClick={() => setMobileOpen(true)}>
            <svg viewBox="0 0 24 24"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
          </button>
          <ul className="nav-links">
            <li><Link to="/shop">Shop All</Link></li>
            <li><Link to="/shop?cat=Necklaces">Necklaces</Link></li>
            <li><Link to="/shop?cat=Earrings">Earrings</Link></li>
            <li><Link to="/shop?cat=Rings">Rings</Link></li>
            <li><Link to="/about">Our Story</Link></li>
          </ul>
        </div>

        <Link to="/" className="nav-center nav-logo">
          <img src="https://wearparts.norework.in/wp-content/uploads/2023/09/Hira-1.png" alt="The Hira Store" />
        </Link>

        <div className="nav-right">
          {isAdmin && (
            <Link to="/admin" className="nav-admin-btn" aria-label="Admin Panel">
              <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>
              <span>Admin</span>
            </Link>
          )}
          <Link to="/account" className="nav-icon" aria-label="Account">
            <svg viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          </Link>
          <div className="cart-wrap">
            <Link to="/wishlist" className={`nav-icon${wishCount > 0 ? ' wish-active' : ''}`} aria-label="Wishlist">
              <svg viewBox="0 0 24 24" fill={wishCount > 0 ? 'currentColor' : 'none'}><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>
            </Link>
            {wishCount > 0 && (
              <span className="cart-badge wish-badge" >{wishCount}</span>
            )}
          </div>
          <div className="cart-wrap">
            <Link to="/cart" className="nav-icon" aria-label="Cart">
              <svg viewBox="0 0 24 24"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/></svg>
            </Link>
            {totalItems > 0 && (
              <span className="cart-badge" >{totalItems}</span>
            )}
          </div>
        </div>
      </nav>

      {/* Mobile Nav */}
      <div className={`mobile-nav${mobileOpen ? ' open' : ''}`}>
        <div className="mobile-nav-overlay" onClick={() => setMobileOpen(false)} />
        <div className="mobile-nav-drawer">
          <div className="mobile-nav-header">
            <img src="https://wearparts.norework.in/wp-content/uploads/2023/09/Hira-1.png" alt="Hira" style={{ height: '24px' }} />
            <button className="mobile-nav-close" onClick={() => setMobileOpen(false)}>
              <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
          <ul className="mobile-nav-links" onClick={() => setMobileOpen(false)}>
            <li><Link to="/shop">Shop All</Link></li>
            <li><Link to="/shop?cat=Necklaces">Necklaces</Link></li>
            <li><Link to="/shop?cat=Earrings">Earrings</Link></li>
            <li><Link to="/shop?cat=Rings">Rings</Link></li>
            <li><Link to="/shop?cat=Bracelets">Bracelets</Link></li>
            <li><Link to="/about">Our Story</Link></li>
            {isAdmin && <li><Link to="/admin" className="mobile-admin-link">Admin Panel</Link></li>}
          </ul>
        </div>
      </div>

      <style>{`
        .announcement { background: var(--surface); color: var(--text-main); font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase; font-weight: 600; padding: 10px 0; text-align: center; border-bottom: 1px solid var(--border); overflow: hidden; position: relative; }
        .marquee-inner { display: inline-flex; animation: marquee 20s linear infinite; white-space: nowrap; }
        .marquee-inner span { padding: 0 40px; }
        @keyframes marquee { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }

        .nav { position: sticky; top: 0; z-index: 100; background: rgba(255,255,255,0.98); backdrop-filter: blur(10px); border-bottom: 1px solid transparent; display: flex; align-items: center; justify-content: space-between; padding: 0 40px; height: 72px; transition: border-color 0.3s; }
        .nav.scrolled { border-color: var(--border); }
        .nav-left, .nav-right { flex: 1; display: flex; align-items: center; }
        .nav-right { justify-content: flex-end; gap: 20px; }
        .nav-center { flex: 0 0 auto; }
        .nav-logo img { height: 48px; width: auto; filter: contrast(1.2); }
        .nav-links { display: flex; gap: 32px; list-style: none; }
        .nav-links a { font-size: 12px; font-weight: 500; color: var(--text-main); text-transform: uppercase; letter-spacing: 0.05em; transition: color 0.3s; position: relative; }
        .nav-links a::after { content: ''; position: absolute; bottom: -4px; left: 0; width: 0; height: 1px; background: var(--text-main); transition: width 0.3s var(--ease-out); }
        .nav-links a:hover::after { width: 100%; }
        .nav-icon { display: flex; align-items: center; justify-content: center; width: 40px; height: 40px; color: var(--text-main); transition: transform 0.2s var(--ease-out); position: relative; }
        .nav-icon:hover { transform: scale(1.1); color: var(--accent-gold); }
        .nav-icon svg { width: 20px; height: 20px; stroke-width: 1.5; fill: none; stroke: currentColor; }
        .cart-wrap { position: relative; }
        .cart-badge { position: absolute; top: -4px; right: -4px; background: #005969; color: #fff; font-size: 10px; font-weight: 700; min-width: 18px; height: 18px; padding: 0 4px; display: flex; align-items: center; justify-content: center; border-radius: 99px; pointer-events: none; border: 2px solid #fff; line-height: 1; }
        .wish-badge { background: #e11d48; }
        .nav-icon.wish-active { color: #e11d48; }
        .nav-icon.wish-active:hover { color: #be123c; }
        .nav-admin-btn { display: flex; align-items: center; gap: 6px; padding: 6px 14px; background: #005969; color: #fff; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; border-radius: 4px; transition: background 0.2s; }
        .nav-admin-btn:hover { background: #003d4a; color: #fff; }
        .nav-admin-btn svg { width: 14px; height: 14px; fill: none; stroke: currentColor; stroke-width: 1.8; flex-shrink: 0; }
        .mobile-admin-link { color: #005969 !important; font-weight: 600 !important; }

        .hamburger { display: none; width: 40px; height: 40px; align-items: center; justify-content: center; }
        .hamburger svg { width: 24px; height: 24px; stroke: var(--text-main); stroke-width: 1.5; fill: none; }
        .mobile-nav { position: fixed; inset: 0; z-index: 300; pointer-events: none; }
        .mobile-nav.open { pointer-events: auto; }
        .mobile-nav-overlay { position: absolute; inset: 0; background: rgba(0,0,0,0.4); opacity: 0; transition: opacity 0.3s; }
        .mobile-nav.open .mobile-nav-overlay { opacity: 1; }
        .mobile-nav-drawer { position: absolute; top: 0; left: 0; bottom: 0; width: 300px; background: #fff; transform: translateX(-100%); transition: transform 0.4s var(--ease-out); display: flex; flex-direction: column; }
        .mobile-nav.open .mobile-nav-drawer { transform: translateX(0); }
        .mobile-nav-header { padding: 20px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border); }
        .mobile-nav-close { width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; }
        .mobile-nav-close svg { width: 20px; height: 20px; stroke: var(--text-main); stroke-width: 1.5; fill: none; }
        .mobile-nav-links { list-style: none; padding: 20px 0; }
        .mobile-nav-links li a { display: block; padding: 12px 24px; font-size: 14px; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 500; border-bottom: 1px solid var(--surface); }

        @media (max-width: 768px) {
          .nav { padding: 0 16px; height: 60px; }
          .nav-links { display: none; }
          .hamburger { display: flex; }
          .nav-right { gap: 4px; }
          .nav-logo img { height: 38px; }
          .nav-icon { width: 36px; height: 36px; }
          .nav-icon svg { width: 18px; height: 18px; }
          .announcement { font-size: 10px; padding: 8px 0; }
        }
      `}</style>
    </>
  );
}
