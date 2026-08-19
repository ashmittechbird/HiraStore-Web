import { useEffect, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useFrappeGetDoc } from '@/lib/frappe';
import { useCart } from '@/store/cart';
import { useWishlist } from '@/store/wishlist';
import { itemImage, itemImages, itemPrice, itemName, itemCategory } from '@/lib/api';

interface Product {
  name?: string; item_name?: string; item_group?: string; category?: string;
  standard_rate?: number; price_usd?: number; price?: number;
  image?: string; custom_item_images?: string; product_id?: string; description?: string;
  custom_material?: string; custom_short_description?: string;
  weight_per_unit?: number; weight?: string | number;
  [key: string]: unknown;
}

function stripHtml(html: string): string {
  if (typeof window === 'undefined') return html.replace(/<[^>]+>/g, '');
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return (tmp.textContent || tmp.innerText || '').trim();
}

export default function ProductPage() {
  const { id = '' } = useParams<{ id: string }>();
  const { data: item, isLoading: loading } = useFrappeGetDoc<Product>('Item', decodeURIComponent(id));
  const [activeIdx, setActiveIdx] = useState(0);
  const [zoomed, setZoomed] = useState(false);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const [toast, setToast] = useState('');
  const navigate = useNavigate();
  const wishToggle = useWishlist(s => s.toggle);
  const wishHas = useWishlist(s => s.has);
  const addItem = useCart(s => s.addItem);
  const updateQty = useCart(s => s.updateQty);
  const cartItems = useCart(s => s.items);

  useEffect(() => { setActiveIdx(0); }, [id]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  }

  function handleAdd() {
    if (!item) return;
    const itemId = item.name || item.product_id || decodeURIComponent(id);
    addItem({
      id: itemId,
      name: itemName(item as Parameters<typeof itemName>[0]),
      category: itemCategory(item as Parameters<typeof itemCategory>[0]),
      price: itemPrice(item as Parameters<typeof itemPrice>[0]),
      image: itemImage(item as Parameters<typeof itemImage>[0]),
    });
    if (qty > 1) useCart.getState().updateQty(itemId, qty);
    setAdded(true);
    showToast('Added to cart!');
    setTimeout(() => setAdded(false), 2000);
  }

  function handleBuyNow() {
    if (!item) return;
    const itemId = item.name || item.product_id || decodeURIComponent(id);
    sessionStorage.setItem('hs_buynow', JSON.stringify([{
      id: itemId,
      name: itemName(item as Parameters<typeof itemName>[0]),
      category: itemCategory(item as Parameters<typeof itemCategory>[0]),
      price: itemPrice(item as Parameters<typeof itemPrice>[0]),
      image: itemImage(item as Parameters<typeof itemImage>[0]),
      qty,
    }]));
    navigate('/checkout');
  }

  function toggleWishlist() {
    if (!item) return;
    const itemId = item.name || item.product_id || decodeURIComponent(id);
    const wasWished = wishHas(itemId);
    wishToggle({
      id: itemId,
      name: itemName(item as Parameters<typeof itemName>[0]),
      category: itemCategory(item as Parameters<typeof itemCategory>[0]),
      price: itemPrice(item as Parameters<typeof itemPrice>[0]),
      image: itemImage(item as Parameters<typeof itemImage>[0]),
    });
    showToast(wasWished ? 'Removed from wishlist' : 'Added to wishlist!');
  }

  if (loading) return (
    <div className="product-page">
      <div className="product-wrap">
        <div className="gallery">
          <div className="main-img-wrap skel" style={{ height: '460px' }} />
          <div className="thumb-row" style={{ marginTop: '12px' }}>
            {[0,1,2,3].map(i => <div key={i} className="thumb skel" />)}
          </div>
        </div>
        <div className="product-info">
          <div className="skel" style={{ height: '32px', width: '70%', marginBottom: '16px', borderRadius: '6px' }} />
          <div className="skel" style={{ height: '24px', width: '30%', borderRadius: '6px' }} />
        </div>
      </div>
    </div>
  );

  if (!item) return (
    <div style={{ textAlign: 'center', padding: '80px 24px' }}>
      <h2>Product not found</h2>
      <Link to="/shop" style={{ color: '#005969', marginTop: '16px', display: 'inline-block' }}>← Back to Shop</Link>
    </div>
  );

  const images = itemImages(item as Parameters<typeof itemImages>[0], 4);
  const price = itemPrice(item as Parameters<typeof itemPrice>[0]);
  const name = itemName(item as Parameters<typeof itemName>[0]);
  const category = itemCategory(item as Parameters<typeof itemCategory>[0]);
  const itemId = item.name || item.product_id || decodeURIComponent(id);
  const wished = wishHas(itemId);
  const cartQty = cartItems.find(c => c.id === itemId)?.qty || 0;

  return (
    <div className="product-page">
      {/* Breadcrumb */}
      <div className="breadcrumb">
        <Link to="/">Home</Link> ›
        <Link to="/shop">Shop</Link> ›
        <span>{name}</span>
      </div>

      <div className="product-wrap">
        {/* Gallery */}
        <div className="gallery">
          {/* Main image */}
          <div
            className={`main-img-wrap${zoomed ? ' zoomed' : ''}`}
            onClick={() => setZoomed(z => !z)}
            title={zoomed ? 'Click to zoom out' : 'Click to zoom in'}
          >
            <img
              src={images[activeIdx]}
              alt={name}
              className="main-img"
              key={images[activeIdx]}
            />
            <span className="zoom-hint">
            {zoomed
              ? <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7"/><line x1="16.5" y1="16.5" x2="22" y2="22"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
              : <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7"/><line x1="16.5" y1="16.5" x2="22" y2="22"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
            }
          </span>
          </div>

          {/* Thumbnails */}
          <div className="thumb-row">
            {images.map((src, i) => (
              <div
                key={i}
                className={`thumb${i === activeIdx ? ' active' : ''}`}
                onClick={() => setActiveIdx(i)}
              >
                <img src={src} alt={`${name} view ${i + 1}`} />
              </div>
            ))}
          </div>
        </div>

        {/* Info */}
        <div className="product-info">
          <div className="product-badge-row">
            {category && <span className="badge badge-cat">{category}</span>}
            {!!item.custom_is_featured && <span className="badge badge-featured">Featured</span>}
          </div>

          <h1 className="product-name">{name}</h1>
          <div className="product-price">${Number(price).toLocaleString('en-US')}</div>

          <div className="divider" />

          {/* Prefer the short description; fall back to the long one as plain text (HTML stripped to prevent XSS). */}
          {item.custom_short_description ? (
            <p className="product-desc">{item.custom_short_description as string}</p>
          ) : item.description ? (
            <p className="product-desc">{stripHtml(item.description as string)}</p>
          ) : null}

          {(item.custom_material || item.weight_per_unit || item.weight) && (
            <>
              {item.custom_material && (
                <div className="detail-row">
                  <span className="detail-label">Material</span>
                  <span className="detail-val">{item.custom_material as string}</span>
                </div>
              )}
              {(item.weight_per_unit || item.weight) && (
                <div className="detail-row">
                  <span className="detail-label">Weight</span>
                  <span className="detail-val">{item.weight_per_unit || item.weight} g</span>
                </div>
              )}
            </>
          )}

          <div className="divider" />

          {cartQty > 0 ? (
            /* In-cart stepper - replaces qty selector + add button */
            <div className="incart-stepper">
              <button type="button" className="incart-btn" onClick={() => updateQty(itemId, cartQty - 1)}>−</button>
              <div className="incart-mid">
                <span className="incart-num">{cartQty}</span>
                <span className="incart-label">in cart</span>
              </div>
              <button type="button" className="incart-btn" onClick={() => { addItem({ id: itemId, name, category, price, image: images[0] }); showToast('Added!'); }}>+</button>
            </div>
          ) : (
            /* Qty selector + add button when not in cart */
            <>
              <div className="qty-row">
                <span className="qty-label">Qty</span>
                <div className="qty-ctrl">
                  <button type="button" className="qty-btn" onClick={() => setQty(q => Math.max(1, q - 1))}>−</button>
                  <span className="qty-num">{qty}</span>
                  <button type="button" className="qty-btn" onClick={() => setQty(q => Math.min(10, q + 1))}>+</button>
                </div>
              </div>
              <button type="button" className={`btn-add${added ? ' added' : ''}`} onClick={handleAdd}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 001.98 1.61h9.72a2 2 0 001.98-1.61L23 6H6"/></svg>
                {added ? <>Added to Cart <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg></> : 'Add to Cart'}
              </button>
              <button type="button" className="btn-buy-now" onClick={handleBuyNow}>
                Buy Now
              </button>
            </>
          )}

          <button type="button" className={`btn-wish${wished ? ' wishlisted' : ''}`} onClick={toggleWishlist}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill={wished ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>
            {wished ? 'In Wishlist' : 'Add to Wishlist'}
          </button>

          {/* Trust */}
          <div className="trust-row">
            {[
              { icon: <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>, text: 'Premium Quality' },
              { icon: <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="1" y="3" width="13" height="13"/><polygon points="13 3 20 3 23 6 23 16 13 16 13 3"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="17.5" cy="18.5" r="2.5"/></svg>, text: 'Free shipping over $15' },
              { icon: <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 102.13-9.36L1 10"/></svg>, text: '30-day returns' },
              { icon: <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8"><polyline points="20 6 9 17 4 12"/></svg>, text: '1 year warranty' },
            ].map(t => (
              <div key={t.text} className="trust-item">
                <span style={{ display:'flex', alignItems:'center', color:'#005969' }}>{t.icon}</span>
                <span>{t.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Toast */}
      <div className={`toast${toast ? ' show' : ''}`}>{toast}</div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,400&family=Playfair+Display:ital,wght@0,400;0,700;1,400&display=swap');

        /* ── Page shell: lock to viewport ── */
        .product-page { background:#f8fbfc; height:calc(100vh - 72px); overflow:hidden; display:flex; flex-direction:column; }

        /* ── Breadcrumb: slim strip ── */
        .breadcrumb { max-width:1240px;margin:0 auto;width:100%;padding:8px 32px;font-size:11.5px;color:#6b8b91;display:flex;align-items:center;gap:6px;flex-shrink:0; }
        .breadcrumb a { color:#6b8b91;transition:color .2s; }
        .breadcrumb a:hover { color:#005969; }

        /* ── Main grid: fills remaining height ── */
        .product-wrap { max-width:1240px;margin:0 auto;width:100%;padding:0 32px 12px;display:grid;grid-template-columns:1fr 400px;gap:36px;flex:1;min-height:0; }

        /* ── Gallery: thumbs LEFT | main image RIGHT ── */
        .gallery { display:flex;flex-direction:row;gap:10px;height:100%;min-height:0;overflow:hidden; }

        /* Thumbnail strip - vertical column on left */
        .thumb-row { display:flex;flex-direction:column;gap:7px;width:66px;flex-shrink:0;overflow-y:auto;scrollbar-width:none;padding:2px 0; }
        .thumb-row::-webkit-scrollbar { display:none; }
        .thumb { width:62px;height:62px;border-radius:7px;border:2px solid transparent;overflow:hidden;cursor:pointer;background:#f0f8f9;transition:border-color .2s,opacity .2s;flex-shrink:0;opacity:.7; }
        .thumb:hover { border-color:#a8cfd5;opacity:1; }
        .thumb.active { border-color:#005969;box-shadow:0 0 0 1px #005969;opacity:1; }
        .thumb img { width:100%;height:100%;object-fit:cover; }

        /* Main image - takes all remaining width */
        .main-img-wrap { flex:1;min-width:0;border-radius:12px;overflow:hidden;background:#f0f8f9;border:1px solid #ddeef1;cursor:zoom-in;position:relative;height:100%; }
        .main-img-wrap.zoomed { cursor:zoom-out; }
        .main-img { width:100%;height:100%;object-fit:contain;transition:transform .5s ease; }
        .main-img-wrap:hover .main-img { transform:scale(1.04); }
        .main-img-wrap.zoomed .main-img { transform:scale(1.55); }
        .zoom-hint { position:absolute;bottom:10px;right:12px;background:rgba(255,255,255,.85);backdrop-filter:blur(4px);border-radius:6px;padding:5px 8px;pointer-events:none;opacity:.8;display:flex;align-items:center; }

        /* ── Info panel: internal scroll if content overflows ── */
        .product-info { height:100%;overflow-y:auto;padding-right:6px;display:flex;flex-direction:column; }
        .product-info::-webkit-scrollbar { width:3px; }
        .product-info::-webkit-scrollbar-thumb { background:#c8e0e4;border-radius:2px; }

        .product-badge-row { display:flex;gap:8px;margin-bottom:10px;flex-wrap:wrap;flex-shrink:0; }
        .badge { display:inline-flex;align-items:center;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:500; }
        .badge-cat { background:#e0f2f4;color:#005969; }
        .badge-featured { background:#fef9ec;color:#c9a84c;border:1px solid #f5e4a8; }
        .product-name { font-family:'Playfair Display',Georgia,serif;font-size:1.55rem;font-weight:400;color:#005969;line-height:1.25;margin-bottom:6px;flex-shrink:0; }
        .product-price { font-family:'Cormorant Garamond',Georgia,serif;font-size:1.7rem;color:#005969;font-weight:500;margin-bottom:0;flex-shrink:0; }
        .divider { height:1px;background:#ddeef1;margin:10px 0;flex-shrink:0; }
        .detail-row { display:flex;gap:8px;align-items:flex-start;margin-bottom:6px;font-size:13px;flex-shrink:0; }
        .detail-label { font-weight:500;color:#6b8b91;min-width:76px;font-size:11px;text-transform:uppercase;letter-spacing:.05em;padding-top:1px; }
        .detail-val { color:#334d52;line-height:1.5; }
        .product-desc { font-size:13px;color:#6b8b91;line-height:1.6;margin-bottom:6px;flex-shrink:0; }

        /* Qty */
        .qty-row { display:flex;align-items:center;gap:12px;margin-bottom:10px;flex-shrink:0; }
        .qty-label { font-size:11px;font-weight:600;color:#6b8b91;text-transform:uppercase;letter-spacing:.08em; }
        .qty-ctrl { display:flex;align-items:center;border:1.5px solid #c8e0e4;border-radius:8px;overflow:hidden;height:38px; }
        .qty-btn { width:38px;height:100%;display:flex;align-items:center;justify-content:center;background:#f5fbfc;border:none;cursor:pointer;color:#005969;font-size:18px;font-weight:300;transition:background .15s,color .15s;user-select:none;flex-shrink:0; }
        .qty-btn:hover { background:#dff0f3;color:#003d4a; }
        .qty-btn:active { transform:scale(0.85); }
        .qty-num { width:38px;text-align:center;font-size:14px;font-weight:600;color:#005969;user-select:none;border-left:1px solid #c8e0e4;border-right:1px solid #c8e0e4; }

        /* Buttons */
        .btn-add { width:100%;padding:13px 24px;background:#005969;color:#fff;font-size:14px;font-weight:500;border:none;border-radius:8px;cursor:pointer;transition:background .2s;display:flex;align-items:center;justify-content:center;gap:10px;margin-bottom:8px;flex-shrink:0; }
        .btn-add:hover { background:#003d4a; }
        .btn-add.added { background:#16a34a; }
        .btn-buy-now { width:100%;padding:13px 24px;background:#fff;color:#005969;font-size:14px;font-weight:600;border:2px solid #005969;border-radius:8px;cursor:pointer;transition:background .2s,color .2s;display:flex;align-items:center;justify-content:center;gap:10px;margin-bottom:8px;flex-shrink:0;letter-spacing:0.03em; }
        .btn-buy-now:hover { background:#005969;color:#fff; }
        .incart-stepper { display:flex;align-items:stretch;border:2px solid #005969;border-radius:10px;overflow:hidden;margin-bottom:8px;height:48px;background:#fff;flex-shrink:0; }
        .incart-btn { width:48px;min-width:48px;display:flex;align-items:center;justify-content:center;background:#005969;color:#fff;border:none;font-size:22px;font-weight:300;cursor:pointer;transition:background .15s;line-height:1;font-family:inherit;user-select:none;flex-shrink:0; }
        .incart-btn:hover { background:#003d4a; }
        .incart-btn:active { transform:scale(0.88); }
        .incart-mid { flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;border-left:1.5px solid #b8dde3;border-right:1.5px solid #b8dde3; }
        .incart-num { font-size:18px;font-weight:700;color:#005969;line-height:1; }
        .incart-label { font-size:9px;text-transform:uppercase;letter-spacing:.1em;color:#8ab0b7;font-weight:600; }
        .btn-wish { width:100%;padding:10px 24px;background:transparent;color:#334d52;font-size:13px;border:1.5px solid #c8e0e4;border-radius:8px;cursor:pointer;transition:all .2s;display:flex;align-items:center;justify-content:center;gap:8px;flex-shrink:0; }
        .btn-wish:hover { border-color:#005969;color:#005969;background:#f0f8f9; }
        .btn-wish.wishlisted { border-color:#005969;color:#005969;background:#e0f2f4; }

        /* Trust - 2x2 grid, compact */
        .trust-row { display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:10px;padding:10px 12px;background:#f0f8f9;border-radius:8px;border:1px solid #ddeef1;flex-shrink:0; }
        .trust-item { display:flex;align-items:center;gap:7px;font-size:11px;color:#6b8b91; }

        /* Toast */
        .toast { position:fixed;bottom:24px;left:50%;transform:translateX(-50%) translateY(80px);background:#005969;color:#fff;padding:12px 24px;border-radius:8px;font-size:13px;font-weight:500;opacity:0;transition:all .3s;z-index:9999;pointer-events:none;white-space:nowrap; }
        .toast.show { opacity:1;transform:translateX(-50%) translateY(0); }

        /* Skeleton */
        .skel { background:linear-gradient(90deg,#ddeef1 25%,#f0f8f9 50%,#ddeef1 75%);background-size:200% 100%;animation:shimmer 1.5s infinite;border-radius:12px; }
        @keyframes shimmer { 0%{background-position:200% 0}100%{background-position:-200% 0} }

        /* Mobile: stack vertically, allow scroll */
        @media(max-width:860px) {
          .product-page { height:auto;overflow:visible; }
          .product-wrap { grid-template-columns:1fr;padding:16px;gap:24px;height:auto;flex:none; }
          .gallery { flex-direction:column-reverse;height:auto; }
          .thumb-row { flex-direction:row;width:auto;height:64px;overflow-x:auto;overflow-y:hidden; }
          .thumb { width:60px;height:60px; }
          .main-img-wrap { height:320px;flex:none; }
          .product-info { height:auto;overflow:visible; }
        }
      `}</style>
    </div>
  );
}
