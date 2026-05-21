import { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '@/store/cart';
import { useWishlist, WishItem } from '@/store/wishlist';

export default function WishlistPage() {
  const items = useWishlist(s => s.items);
  const toggle = useWishlist(s => s.toggle);
  const addItem = useCart(s => s.addItem);
  const updateQty = useCart(s => s.updateQty);
  const cartItems = useCart(s => s.items);
  const navigate = useNavigate();
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());

  const cartQtyMap = useMemo(() => {
    const m: Record<string, number> = {};
    cartItems.forEach(i => { m[i.id] = i.qty; });
    return m;
  }, [cartItems]);

  function handleAdd(item: WishItem) {
    addItem({ id: item.id, name: item.name, category: item.category, price: item.price, image: item.image });
    setAddedIds(prev => new Set(prev).add(item.id));
    setTimeout(() => setAddedIds(prev => { const s = new Set(prev); s.delete(item.id); return s; }), 1600);
  }

  return (
    <div className="wishlist-page">
      <div className="wl-header">
        <div className="breadcrumb">
          <Link to="/">Home</Link>
          <span className="breadcrumb-sep">›</span>
          <span>Wishlist</span>
        </div>
        <h1 className="page-title">My Wishlist</h1>
        <p className="page-subtitle">{items.length} item{items.length !== 1 ? 's' : ''} saved</p>
      </div>

      <div className="wl-container">
        {items.length === 0 ? (
          <div className="wl-empty">
            <div className="empty-icon">
              <svg viewBox="0 0 24 24" width="56" height="56" fill="none" stroke="#005969" strokeWidth="1.2"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>
            </div>
            <h2>Your wishlist is empty</h2>
            <p>Save pieces you love and come back to them anytime.</p>
            <Link to="/shop" className="btn-shop">Browse Jewelry</Link>
          </div>
        ) : (
          <div className="products-grid">
            {items.map(item => {
              const isAdded = addedIds.has(item.id);
              const cartQty = cartQtyMap[item.id] || 0;
              const priceStr = item.price > 0 ? `$${Number(item.price).toLocaleString('en-US')}` : 'Price on request';
              return (
                <article key={item.id} className="product-card" role="listitem"
                  onClick={() => navigate(`/product/${encodeURIComponent(item.id)}`)}
                  style={{ cursor: 'pointer' }}>
                  <div className="product-img-wrap">
                    <img src={item.image} alt={item.name} loading="lazy" />
                    {cartQty > 0 && (
                      <span className="card-cart-badge">
                        <svg viewBox="0 0 24 24" width="9" height="9" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/></svg>
                        {cartQty}
                      </span>
                    )}
                    <button
                      className="product-wish wished"
                      aria-label={`Remove ${item.name} from wishlist`}
                      onClick={e => { e.stopPropagation(); toggle(item); }}
                    >
                      <svg viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>
                    </button>
                    <div className="product-actions">
                      {cartQty > 0 ? (
                        <div className="prod-stepper" onClick={e => e.stopPropagation()}>
                          <button className="prod-stepper-btn" aria-label="Remove one" onClick={e => { e.stopPropagation(); updateQty(item.id, cartQty - 1); }}>−</button>
                          <span className="prod-stepper-count">{cartQty}</span>
                          <button className="prod-stepper-btn" aria-label="Add one" onClick={e => { e.stopPropagation(); addItem({ id: item.id, name: item.name, category: item.category, price: item.price, image: item.image }); }}>+</button>
                        </div>
                      ) : (
                        <button
                          className={`product-action-btn pa-primary${isAdded ? ' cart-added' : ''}`}
                          onClick={e => { e.stopPropagation(); handleAdd(item); }}
                        >
                          {isAdded ? 'Added ✓' : 'Add to Cart'}
                        </button>
                      )}
                      <button className="product-action-btn pa-buy-now" onClick={e => { e.stopPropagation(); sessionStorage.setItem('hs_buynow', JSON.stringify([{ id: item.id, name: item.name, category: item.category, price: item.price, image: item.image, qty: 1 }])); navigate('/checkout'); }}>
                        Buy Now
                      </button>
                    </div>
                  </div>
                  <div className="product-info">
                    <p className="product-meta">{item.category}</p>
                    <h3 className="product-name">{item.name}</h3>
                    <div className="product-price">
                      <span className="price-current">{priceStr}</span>
                      <div className="product-rating"><span className="stars">★★★★★</span></div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      <style>{`
        .wishlist-page { background:#fff; min-height:100vh; }
        .wl-header { padding:60px 48px 40px; max-width:1296px; margin:0 auto; }
        .breadcrumb { font-size:12px; color:#888; margin-bottom:12px; display:flex; align-items:center; gap:8px; }
        .breadcrumb a { color:#888; transition:color .2s; text-decoration:none; }
        .breadcrumb a:hover { color:#005969; }
        .breadcrumb-sep { opacity:.4; }
        .page-title { font-family:'Playfair Display',serif; font-size:clamp(32px,4vw,48px); font-weight:800; color:#2c2c2c; line-height:1.1; }
        .page-subtitle { font-size:15px; color:#888; margin-top:8px; }
        .wl-container { max-width:1296px; margin:0 auto; padding:0 48px 80px; }

        .products-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:28px; }

        .product-card { cursor:pointer; background:#fff; border:1px solid rgba(0,0,0,0.07); transition:box-shadow 0.3s ease,border-color 0.3s ease; }
        .product-card:hover { box-shadow:0 8px 40px rgba(0,0,0,0.10); border-color:rgba(0,89,105,0.15); }
        .product-img-wrap { position:relative; overflow:hidden; aspect-ratio:3/4; background:#f5f2ee; }
        .product-img-wrap img { width:100%; height:100%; object-fit:cover; transition:transform 0.7s cubic-bezier(0.22,1,0.36,1); display:block; }
        .product-card:hover .product-img-wrap img { transform:scale(1.05); }

        .card-cart-badge { position:absolute; top:10px; left:10px; background:#005969; color:#fff; font-size:10px; font-weight:700; padding:3px 8px 3px 6px; border-radius:99px; display:flex; align-items:center; gap:4px; pointer-events:none; z-index:3; line-height:1; box-shadow:0 2px 10px rgba(0,89,105,0.35); }

        .prod-stepper { flex:1; display:flex; align-items:center; height:42px; border:1.5px solid #005969; border-radius:4px; overflow:hidden; background:#fff; }
        .prod-stepper-btn { width:42px; min-width:42px; height:100%; display:flex; align-items:center; justify-content:center; background:#005969; color:#fff; border:none; font-size:20px; font-weight:300; cursor:pointer; transition:background 0.15s,transform 0.08s; line-height:1; padding:0; font-family:inherit; flex-shrink:0; user-select:none; }
        .prod-stepper-btn:hover { background:#003d4a; }
        .prod-stepper-btn:active { transform:scale(0.85); }
        .prod-stepper-count { flex:1; display:flex; align-items:center; justify-content:center; background:#fff; font-size:14px; font-weight:700; color:#005969; user-select:none; border-left:1px solid #b8dde3; border-right:1px solid #b8dde3; }

        .product-wish { position:absolute; top:12px; right:12px; width:34px; height:34px; background:rgba(255,255,255,0.88); backdrop-filter:blur(6px); -webkit-backdrop-filter:blur(6px); border-radius:50%; display:flex; align-items:center; justify-content:center; opacity:0.7; transition:opacity 0.2s,transform 0.25s cubic-bezier(0.34,1.56,0.64,1),background 0.2s; border:none; cursor:pointer; touch-action:manipulation; }
        .product-wish:hover { opacity:1; transform:scale(1.12); background:rgba(255,255,255,0.98); }
        .product-wish.wished { opacity:1; }
        .product-wish svg { width:15px; height:15px; fill:none; stroke:#1a1a1a; stroke-width:1.8; }
        .product-wish.wished svg { fill:#e04040; stroke:#e04040; }

        .product-actions { position:absolute; bottom:0; left:0; right:0; background:rgba(255,255,255,0.97); backdrop-filter:blur(10px); -webkit-backdrop-filter:blur(10px); padding:12px 14px; transform:translateY(100%); transition:transform 0.32s cubic-bezier(0.22,1,0.36,1); display:flex; gap:8px; border-top:1px solid rgba(0,0,0,0.06); }
        .product-card:hover .product-actions { transform:translateY(0); }
        .product-action-btn { flex:1; padding:11px 8px; font-size:12px; font-weight:600; letter-spacing:0.06em; text-transform:uppercase; transition:background 0.2s,color 0.2s,border-color 0.2s; cursor:pointer; border:none; font-family:inherit; touch-action:manipulation; text-align:center; text-decoration:none; display:flex; align-items:center; justify-content:center; }
        .product-action-btn.pa-primary { background:#005969; color:#fff; }
        .product-action-btn.pa-primary:hover { background:#003d4a; }
        .product-action-btn.pa-primary.cart-added { background:#2eaa6e; }
        .product-action-btn.pa-secondary { border:1px solid #d8d8d8; color:#555; background:transparent; }
        .product-action-btn.pa-secondary:hover { border-color:#005969; color:#005969; }
        .product-action-btn.pa-buy-now { border:2px solid #005969; color:#005969; background:transparent; font-weight:700; }
        .product-action-btn.pa-buy-now:hover { background:#005969; color:#fff; }

        .product-info { padding:14px 12px 18px; }
        .product-meta { font-size:10px; font-weight:600; color:#888; margin-bottom:6px; letter-spacing:0.1em; text-transform:uppercase; }
        .product-name { font-size:15px; font-weight:700; color:#2c2c2c; margin-bottom:10px; line-height:1.4; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; transition:color 0.2s; }
        .product-card:hover .product-name { color:#003d4a; }
        .product-price { display:flex; align-items:center; justify-content:space-between; }
        .price-current { font-size:16px; font-weight:600; color:#2c2c2c; font-variant-numeric:tabular-nums; }
        .product-rating { display:flex; align-items:center; }
        .stars { color:#c9a84c; font-size:11px; letter-spacing:0.5px; }

        .wl-empty { text-align:center; padding:80px 20px; }
        .empty-icon { margin-bottom:20px; opacity:0.35; display:flex; justify-content:center; }
        .wl-empty h2 { font-family:'Playfair Display',serif; font-size:26px; font-weight:700; color:#2c2c2c; margin-bottom:10px; }
        .wl-empty p { color:#888; margin-bottom:28px; font-size:14px; }
        .btn-shop { display:inline-flex; align-items:center; gap:8px; padding:13px 32px; background:#005969; color:#fff; font-size:12px; font-weight:600; letter-spacing:.1em; text-transform:uppercase; border-radius:3px; transition:background .2s; text-decoration:none; }
        .btn-shop:hover { background:#003d4a; }

        @media(max-width:1024px) { .products-grid { grid-template-columns:repeat(3,1fr); } }
        @media(max-width:768px) { .products-grid { grid-template-columns:repeat(2,1fr); gap:16px; } .wl-container { padding:0 20px 60px; } .wl-header { padding:32px 20px 20px; } }
        @media(max-width:480px) { .products-grid { grid-template-columns:repeat(2,1fr); gap:12px; } }
      `}</style>
    </div>
  );
}
