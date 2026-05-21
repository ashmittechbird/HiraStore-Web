import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { useCart } from '@/store/cart';
import { useWishlist } from '@/store/wishlist';
import { useFrappeGetDocList } from 'frappe-react-sdk';
import { itemImage, itemImages, itemPrice, itemName, itemCategory, itemId } from '@/lib/api';

interface Product {
  name?: string; item_name?: string; item_group?: string; category?: string;
  standard_rate?: number; price_usd?: number; price?: number;
  image?: string; custom_item_images?: string; product_id?: string; disabled?: boolean; status?: string;
  weight_per_unit?: number; weight?: string; custom_material?: string;
  [key: string]: unknown;
}


const CATEGORIES = ['All', 'Earrings', 'Necklaces', 'Rings', 'Bracelets', 'Pendants', 'Bangles', 'Sets', 'Accessories'];
const BADGE_CYCLE = ['New', 'Bestseller', '', 'Limited', 'Trending', '', ''];
const PAGE_SIZE = 24;

function normalizeCategory(cat?: string) {
  if (!cat) return 'Other';
  const c = cat.toLowerCase();
  if (c.includes('earring') || c.includes('ear cuff')) return 'Earrings';
  if (c.includes('necklace') || c.includes('choker')) return 'Necklaces';
  if (c.includes('bracelet')) return 'Bracelets';
  if (c.includes('pendant')) return 'Pendants';
  if (c.includes('bangle')) return 'Bangles';
  if (c.includes('ring') && !c.includes('earring')) return 'Rings';
  if (c.includes('set')) return 'Sets';
  if (['accessories','anklet','charm','hair','waist','arm','toe','bag','watch'].some(w => c.includes(w))) return 'Accessories';
  return 'Other';
}


function itemWeight(item: Product): string {
  if (item.weight_per_unit) return `${item.weight_per_unit}g`;
  if (item.weight) return String(item.weight);
  return '';
}

function ShopContent() {
  const [searchParams] = useSearchParams();
  const initialCat = searchParams.get('cat') || 'All';
  const initialSearch = searchParams.get('search') || '';

  const { data: allProducts = [], isLoading: loading } = useFrappeGetDocList<Product>('Item', {
    fields: ['name','item_name','item_group','standard_rate','custom_short_description','custom_material','custom_is_featured','image','custom_item_images','disabled','weight_per_unit'],
    filters: [['disabled', '=', 0], ['is_sales_item', '=', 1]],
    orderBy: { field: 'modified', order: 'desc' },
    limit: 500,
  });
  const [filtered, setFiltered] = useState<Product[]>([]);
  const [category, setCategory] = useState(initialCat);
  const [search, setSearch] = useState(initialSearch);
  const [sort, setSort] = useState('default');
  const navigate = useNavigate();
  const [page, setPage] = useState(0);
  const [displayed, setDisplayed] = useState<Product[]>([]);

  // Sync category when URL params change (navbar links)
  useEffect(() => {
    const cat = searchParams.get('cat') || 'All';
    setCategory(cat);
  }, [searchParams]);
  const wishlistItems = useWishlist(s => s.items);
  const wishToggle = useWishlist(s => s.toggle);
  const wishIds = new Set(wishlistItems.map(x => x.id));
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const [backTop, setBackTop] = useState(false);
  const [qvProduct, setQvProduct] = useState<Product | null>(null);
  const [qvAdded, setQvAdded] = useState(false);
  const [qvIdx, setQvIdx] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout>>();
  const addItem = useCart(s => s.addItem);
  const updateQty = useCart(s => s.updateQty);
  const cartItems = useCart(s => s.items);
  const cartQtyMap = useMemo(() => {
    const m: Record<string, number> = {};
    cartItems.forEach(i => { m[i.id] = i.qty; });
    return m;
  }, [cartItems]);


  // Cursor sparkle (4-point star diamonds)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    if (window.matchMedia('(hover: none)').matches) return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const onResize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    window.addEventListener('resize', onResize);
    const COLORS = ['#005969','#007a8c','#fff8ee','#003d4a','#ffffff','#ffe4b0'];
    type Sparkle = { x:number;y:number;vx:number;vy:number;r:number;alpha:number;color:string;rot:number;spin:number };
    const sparkles: Sparkle[] = [];
    const onMove = (e: MouseEvent) => {
      if (Math.random() < 0.32) {
        sparkles.push({
          x: e.clientX, y: e.clientY,
          vx: (Math.random()-0.5)*1.8, vy: (Math.random()-0.5)*1.8-0.6,
          r: Math.random()*3+1.5, alpha: 1,
          color: COLORS[Math.floor(Math.random()*COLORS.length)],
          rot: Math.random()*Math.PI*2, spin: (Math.random()-0.5)*0.2
        });
      }
    };
    let raf: number;
    const loop = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (let i = sparkles.length-1; i >= 0; i--) {
        const s = sparkles[i];
        s.x += s.vx; s.y += s.vy; s.vy += 0.04;
        s.alpha -= 0.022; s.rot += s.spin;
        if (s.alpha <= 0) { sparkles.splice(i,1); continue; }
        ctx.save();
        ctx.globalAlpha = s.alpha;
        ctx.fillStyle = s.color;
        ctx.translate(s.x, s.y);
        ctx.rotate(s.rot);
        ctx.beginPath();
        const r = s.r;
        for (let j = 0; j < 4; j++) {
          const angle = (j/4)*Math.PI*2+s.rot;
          const sr = j%2===0 ? r : r*0.4;
          if (j===0) ctx.moveTo(Math.cos(angle)*sr, Math.sin(angle)*sr);
          else ctx.lineTo(Math.cos(angle)*sr, Math.sin(angle)*sr);
        }
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
      raf = requestAnimationFrame(loop);
    };
    window.addEventListener('mousemove', onMove);
    raf = requestAnimationFrame(loop);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('resize', onResize); cancelAnimationFrame(raf); };
  }, []);

  // Scroll progress + back-to-top
  useEffect(() => {
    const bar = document.getElementById('scrollProgress');
    const onScroll = () => {
      const pct = (window.scrollY / (document.body.scrollHeight - window.innerHeight)) * 100;
      if (bar) bar.style.width = pct + '%';
      setBackTop(window.scrollY > 400);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);



  // Filter + sort
  const applyFilters = useCallback(() => {
    let result = [...allProducts];
    if (category !== 'All') {
      result = result.filter(p => normalizeCategory(itemCategory(p as Parameters<typeof itemCategory>[0])) === category);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(p =>
        itemName(p as Parameters<typeof itemName>[0]).toLowerCase().includes(q) ||
        itemCategory(p as Parameters<typeof itemCategory>[0]).toLowerCase().includes(q) ||
        ((p.custom_material || '') as string).toLowerCase().includes(q)
      );
    }
    if (sort === 'price-asc') result.sort((a,b) => itemPrice(a as Parameters<typeof itemPrice>[0]) - itemPrice(b as Parameters<typeof itemPrice>[0]));
    else if (sort === 'price-desc') result.sort((a,b) => itemPrice(b as Parameters<typeof itemPrice>[0]) - itemPrice(a as Parameters<typeof itemPrice>[0]));
    else if (sort === 'name-asc') result.sort((a,b) => itemName(a as Parameters<typeof itemName>[0]).localeCompare(itemName(b as Parameters<typeof itemName>[0])));
    setFiltered(result);
    setPage(0);
    setDisplayed(result.slice(0, PAGE_SIZE));
  }, [allProducts, category, search, sort]);

  useEffect(() => { applyFilters(); }, [applyFilters]);

  function loadMore() {
    const nextPage = page + 1;
    setPage(nextPage);
    setDisplayed(filtered.slice(0, (nextPage+1)*PAGE_SIZE));
  }

  function handleAdd(item: Product) {
    const id = itemId(item as Parameters<typeof itemId>[0]);
    addItem({ id, name: itemName(item as Parameters<typeof itemName>[0]), category: itemCategory(item as Parameters<typeof itemCategory>[0]), price: itemPrice(item as Parameters<typeof itemPrice>[0]), image: itemImage(item as Parameters<typeof itemImage>[0]) });
    setAddedIds(prev => new Set(prev).add(id));
    setTimeout(() => setAddedIds(prev => { const s = new Set(prev); s.delete(id); return s; }), 1600);
  }

  function toggleWish(item: Product) {
    const id = itemId(item as Parameters<typeof itemId>[0]);
    wishToggle({
      id,
      name: itemName(item as Parameters<typeof itemName>[0]),
      price: itemPrice(item as Parameters<typeof itemPrice>[0]),
      image: itemImage(item as Parameters<typeof itemImage>[0]),
      category: itemCategory(item as Parameters<typeof itemCategory>[0]),
    });
  }

  function openQV(item: Product) { setQvProduct(item); setQvAdded(false); setQvIdx(0); }
  function closeQV() { setQvProduct(null); }

  function handleQVAdd() {
    if (!qvProduct) return;
    handleAdd(qvProduct);
    setQvAdded(true);
    setTimeout(() => setQvAdded(false), 1600);
  }

  const hasMore = (page+1)*PAGE_SIZE < filtered.length;

  return (
    <>
      <canvas ref={canvasRef} aria-hidden="true" style={{ position:'fixed',top:0,left:0,width:'100%',height:'100%',pointerEvents:'none',zIndex:9999 }} />
      <div id="scrollProgress" style={{ position:'fixed',top:0,left:0,width:'0%',height:'3px',background:'linear-gradient(90deg,#005969,#007a8c)',zIndex:101,transition:'width 0.1s' }} />

      {/* Page Header */}
      <div className="page-header">
        <div className="page-header-left">
          <nav className="breadcrumb" aria-label="Breadcrumb">
            <Link to="/">Home</Link>
            <span className="breadcrumb-sep">›</span>
            <span>All Products</span>
          </nav>
          <h1 className="page-title">The Full Collection</h1>
          <p className="page-subtitle" id="pageSubtitle">
            {loading ? 'Loading products…' : `${allProducts.length} handcrafted jewellery pieces`}
          </p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="shop-toolbar">
        <div className="search-wrap">
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><line x1="16.5" y1="16.5" x2="22" y2="22"/></svg>
          <input
            type="search" className="search-input"
            placeholder="Search earrings, rings, necklaces…"
            defaultValue={initialSearch}
            onChange={e => {
              clearTimeout(searchTimer.current);
              const val = e.target.value;
              searchTimer.current = setTimeout(() => setSearch(val.trim()), 300);
            }}
            aria-label="Search products"
          />
        </div>
        <select className="sort-select" value={sort} onChange={e => setSort(e.target.value)} aria-label="Sort products">
          <option value="default">Sort: Featured</option>
          <option value="price-asc">Price: Low to High</option>
          <option value="price-desc">Price: High to Low</option>
          <option value="name-asc">Name: A to Z</option>
        </select>
        <p className="product-count">
          <strong>{filtered.length}</strong> product{filtered.length !== 1 ? 's' : ''} found
        </p>
      </div>

      {/* Filter Tabs */}
      <div className="shop-filters" role="group" aria-label="Filter by category">
        {CATEGORIES.map(cat => (
          <button key={cat} className={`filter-btn${category === cat ? ' active' : ''}`} data-cat={cat}
            onClick={() => { setCategory(cat); window.scrollTo({ top: 300, behavior: 'smooth' }); }}>
            {cat}
          </button>
        ))}
      </div>

      {/* Products */}
      <div className="products-container">
        {loading ? (
          <div className="skeleton-grid">
            {Array.from({ length: 8 }).map((_,i) => (
              <div key={i} className="skeleton-card">
                <div className="skeleton-img" />
                <div className="skeleton-info">
                  <div className="skeleton-line wide" />
                  <div className="skeleton-line medium" />
                  <div className="skeleton-line short" />
                </div>
              </div>
            ))}
          </div>
        ) : displayed.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon"><svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="#005969" strokeWidth="1.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg></div>
            <h3>No products found</h3>
            <p>Try a different search term or category filter.</p>
            <button onClick={() => { setCategory('All'); setSearch(''); }}>Clear Filters</button>
          </div>
        ) : (
          <>
            <div className="products-grid" role="list" aria-label="Products">
              {displayed.map((item, idx) => {
                const id = itemId(item as Parameters<typeof itemId>[0]);
                const name = itemName(item as Parameters<typeof itemName>[0]);
                const price = itemPrice(item as Parameters<typeof itemPrice>[0]);
                const img = itemImage(item as Parameters<typeof itemImage>[0]);
                const cat = normalizeCategory(itemCategory(item as Parameters<typeof itemCategory>[0]));
                const weight = itemWeight(item);
                const badge = BADGE_CYCLE[idx % BADGE_CYCLE.length];
                const metaLine = [weight, cat].filter(Boolean).join(' · ');
                const isWished = wishIds.has(id);
                const isAdded = addedIds.has(id);
                const cartQty = cartQtyMap[id] || 0;
                const delayClass = `reveal-delay-${(idx % 4)+1}`;
                return (
                  <article key={id} className={`product-card reveal ${delayClass}`} data-category={cat} data-id={id} role="listitem" onClick={() => navigate('/product/' + encodeURIComponent(id))} style={{ cursor: 'pointer' }}>
                    <div className="product-img-wrap">
                      <img src={img} alt={name} loading="lazy" onError={e => { (e.target as HTMLImageElement).style.display='none'; }} />
                      {/* badge: cart indicator takes priority over promo label */}
                      {cartQty > 0
                        ? <span className="card-cart-badge"><svg viewBox="0 0 24 24" width="9" height="9" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/></svg> {cartQty}</span>
                        : badge && <span className="product-badge">{badge}</span>
                      }
                      <button className={`product-wish${isWished ? ' wished' : ''}`} aria-label={`${isWished ? 'Remove' : 'Add'} ${name} to wishlist`}
                        onClick={e => { e.stopPropagation(); toggleWish(item); }}>
                        <svg viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>
                      </button>
                      <div className="product-actions">
                        {cartQty > 0 ? (
                          <div className="prod-stepper" onClick={e => e.stopPropagation()}>
                            <button className="prod-stepper-btn" aria-label="Remove one" onClick={e => { e.stopPropagation(); updateQty(id, cartQty - 1); }}>−</button>
                            <span className="prod-stepper-count">{cartQty}</span>
                            <button className="prod-stepper-btn" aria-label="Add one" onClick={e => { e.stopPropagation(); addItem({ id, name, category: cat, price, image: img }); }}>+</button>
                          </div>
                        ) : (
                          <button className={`product-action-btn pa-primary${isAdded ? ' cart-added' : ''}`} onClick={e => { e.stopPropagation(); handleAdd(item); }}>
                            {isAdded ? 'Added ✓' : 'Add to Cart'}
                          </button>
                        )}
                        <button className="product-action-btn pa-secondary" onClick={e => { e.stopPropagation(); openQV(item); }}>
                          Quick View
                        </button>
                      </div>
                    </div>
                    <div className="product-info">
                      {metaLine && <p className="product-meta">{metaLine}</p>}
                      <h3 className="product-name">{name}</h3>
                      <div className="product-price">
                        <span className="price-current">{price > 0 ? `$${price.toLocaleString('en-US')}` : 'Price on request'}</span>
                        <div className="product-rating"><span className="stars">★★★★★</span></div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>

            {hasMore && (
              <div className="center-cta">
                <button className="btn-outline" onClick={loadMore}>
                  Load More
                  <svg viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Heritage / Our Story */}
      <section className="heritage-section">
        <div className="heritage-img-wrap">
          <img src="https://images.unsplash.com/photo-1613945407943-59cd755fd69e?w=1000&q=85" alt="Handcrafted Jewelry from Rajasthan" />
        </div>
        <div className="heritage-content">
          <h2 className="heritage-title">Roots in Rajasthan,<br/>Crafted for the World</h2>
          <p className="heritage-desc">Every piece of Hira jewelry carries the legacy of expert artisans from Rajasthan. We blend generations of traditional craftsmanship with modern design to create demi-fine jewelry that elevates your everyday style.</p>
          <Link to="/about" className="btn-story">Discover Our Story</Link>
        </div>
      </section>

      {/* Back to Top */}
      <button className={`back-top${backTop ? ' visible' : ''}`} aria-label="Back to top"
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
        <svg viewBox="0 0 24 24"><polyline points="18 15 12 9 6 15"/></svg>
      </button>

      {/* Quick View Modal */}
      {qvProduct && (() => {
        const id = itemId(qvProduct as Parameters<typeof itemId>[0]);
        const name = itemName(qvProduct as Parameters<typeof itemName>[0]);
        const price = itemPrice(qvProduct as Parameters<typeof itemPrice>[0]);
        const imgs = itemImages(qvProduct as Parameters<typeof itemImages>[0], 4);
        const cat = itemCategory(qvProduct as Parameters<typeof itemCategory>[0]);
        const img = itemImage(qvProduct as Parameters<typeof itemImage>[0]);
        const weight = itemWeight(qvProduct);
        const priceStr = price > 0 ? `$${price.toLocaleString('en-US')}` : 'Price on request';
        const qvCartQty = cartQtyMap[id] || 0;
        return (
          <div id="qvOverlay" style={{ display:'flex',position:'fixed',inset:0,background:'rgba(0,0,0,0.6)',backdropFilter:'blur(5px)',zIndex:1000,alignItems:'center',justifyContent:'center',padding:'16px' }}
            onClick={e => { if (e.target === e.currentTarget) closeQV(); }}>
            <div id="qvBox" style={{ background:'#fff',maxWidth:'900px',width:'100%',maxHeight:'90vh',overflowY:'auto',position:'relative',display:'grid',gridTemplateColumns:'1fr 1fr' }}>
              <button onClick={closeQV} style={{ position:'absolute',top:'16px',right:'16px',background:'rgba(255,255,255,0.9)',border:'none',width:'32px',height:'32px',borderRadius:'50%',cursor:'pointer',zIndex:10,display:'flex',alignItems:'center',justifyContent:'center' }}>
                <svg viewBox="0 0 24 24" width="16" height="16" stroke="#2c2c2c" strokeWidth="2" fill="none"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
              <div style={{ display:'flex',flexDirection:'column',background:'#faf9f7',minHeight:'340px' }}>
                <div style={{ flex:1,overflow:'hidden',display:'flex',alignItems:'center',justifyContent:'center' }}>
                  <img src={imgs[qvIdx]} alt={name} style={{ width:'100%',height:'100%',objectFit:'cover',transition:'opacity 0.2s' }} key={qvIdx} />
                </div>
                {imgs.length > 1 && (
                  <div style={{ display:'flex',gap:'6px',padding:'10px',background:'#fff',borderTop:'1px solid #f0f0f0' }}>
                    {imgs.map((src, i) => (
                      <div key={i} onClick={() => setQvIdx(i)} style={{ width:'52px',height:'52px',flexShrink:0,cursor:'pointer',overflow:'hidden',border:`2px solid ${i === qvIdx ? '#2c2c2c' : 'transparent'}`,transition:'border-color 0.2s',background:'#faf9f7' }}>
                        <img src={src} alt={`${name} ${i+1}`} style={{ width:'100%',height:'100%',objectFit:'cover' }} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div style={{ padding:'40px',display:'flex',flexDirection:'column',justifyContent:'center',gap:0 }}>
                <div style={{ fontSize:'10px',letterSpacing:'0.2em',textTransform:'uppercase',color:'#737373',marginBottom:'12px' }}>{cat}</div>
                <h2 style={{ fontFamily:'Playfair Display,serif',fontSize:'28px',fontWeight:400,color:'#2c2c2c',marginBottom:'8px',lineHeight:1.2 }}>{name}</h2>
                <div style={{ fontSize:'20px',fontWeight:600,color:'#2c2c2c',margin:'16px 0' }}>{priceStr}</div>
                <div style={{ fontSize:'12px',color:'#737373',marginBottom:'8px' }}>{[weight, id].filter(Boolean).join(' · ')}</div>
                <div style={{ display:'flex',flexDirection:'column',gap:'12px',marginTop:'24px',marginBottom:'24px' }}>
                  {qvCartQty > 0 ? (
                    <div style={{ display:'flex',alignItems:'center',border:'1.5px solid #2c2c2c',overflow:'hidden' }}>
                      <button onClick={() => updateQty(id, qvCartQty - 1)} style={{ width:'48px',height:'48px',background:'#2c2c2c',color:'#fff',border:'none',fontSize:'20px',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,transition:'background 0.15s',fontFamily:'inherit' }}>−</button>
                      <span style={{ flex:1,textAlign:'center',fontSize:'14px',fontWeight:700,color:'#2c2c2c' }}>{qvCartQty} in cart</span>
                      <button onClick={() => addItem({ id, name, category: cat, price, image: img })} style={{ width:'48px',height:'48px',background:'#2c2c2c',color:'#fff',border:'none',fontSize:'20px',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,transition:'background 0.15s',fontFamily:'inherit' }}>+</button>
                    </div>
                  ) : (
                    <button onClick={handleQVAdd} style={{ background: qvAdded ? '#2eaa6e' : '#2c2c2c',color:'#fff',padding:'16px',fontSize:'11px',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.1em',border:'none',cursor:'pointer',transition:'background 0.3s',fontFamily:'inherit' }}>
                      {qvAdded ? 'Added ✓' : 'Add to Cart'}
                    </button>
                  )}
                  <button onClick={() => { closeQV(); sessionStorage.setItem('hs_buynow', JSON.stringify([{ id, name, category: cat, price, image: img, qty: 1 }])); navigate('/checkout'); }} style={{ background:'transparent',color:'#2c2c2c',padding:'16px',fontSize:'11px',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.1em',border:'2px solid #2c2c2c',cursor:'pointer',transition:'background .2s,color .2s',fontFamily:'inherit' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background='#2c2c2c'; (e.currentTarget as HTMLButtonElement).style.color='#fff'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background='transparent'; (e.currentTarget as HTMLButtonElement).style.color='#2c2c2c'; }}>
                    Buy Now
                  </button>
                </div>
                <Link to={`/product/${encodeURIComponent(id)}`} style={{ fontSize:'12px',color:'#737373',textDecoration:'underline',textUnderlineOffset:'4px',textAlign:'center' }}>
                  View Full Details
                </Link>
              </div>
            </div>
          </div>
        );
      })()}

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@300;400;600;700;800&family=Poppins:wght@300;400;500;600&display=swap');

        :root {
          --gold:#005969; --gold-dark:#003d4a; --gold-light:#007a8c;
          --bg:#ffffff; --text:#555555; --text-dark:#2c2c2c; --text-light:#888888;
          --border:#e8e0d8; --surface:#faf8f5;
          --font-body:'Poppins',sans-serif; --font-head:'Nunito',sans-serif;
          --ease-out:cubic-bezier(0.22,1,0.36,1);
        }

        /* PAGE HEADER */
        .page-header { padding:60px 48px 40px; max-width:1296px; margin:0 auto; display:flex; align-items:flex-end; justify-content:space-between; flex-wrap:wrap; gap:20px; }
        .breadcrumb { font-size:12px; color:var(--text-light); margin-bottom:12px; display:flex; align-items:center; gap:8px; }
        .breadcrumb a:hover { color:var(--gold); }
        .breadcrumb-sep { opacity:0.4; }
        .page-title { font-family:var(--font-head); font-size:clamp(32px,4vw,48px); font-weight:800; color:var(--text-dark); line-height:1.1; }
        .page-subtitle { font-size:15px; color:var(--text-light); margin-top:8px; }

        /* TOOLBAR */
        .shop-toolbar { max-width:1296px; margin:0 auto 24px; padding:0 48px; display:flex; align-items:center; gap:16px; flex-wrap:wrap; }
        .search-wrap { position:relative; flex:1; min-width:220px; max-width:400px; }
        .search-wrap svg { position:absolute; left:14px; top:50%; transform:translateY(-50%); width:16px; height:16px; fill:none; stroke:var(--text-light); stroke-width:2; pointer-events:none; }
        .search-input { width:100%; padding:10px 14px 10px 40px; border:1.5px solid var(--border); border-radius:8px; font-size:13px; font-family:var(--font-body); color:var(--text-dark); background:var(--surface); outline:none; transition:border-color 0.2s,box-shadow 0.2s; }
        .search-input:focus { border-color:var(--gold); box-shadow:0 0 0 3px rgba(0,89,105,0.1); }
        .search-input::placeholder { color:var(--text-light); }
        .sort-select { padding:10px 36px 10px 14px; border:1.5px solid var(--border); border-radius:8px; font-size:13px; font-family:var(--font-body); color:var(--text-dark); background:var(--surface) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24'%3E%3Cpolyline points='6 9 12 15 18 9' fill='none' stroke='%23888' stroke-width='2'/%3E%3C/svg%3E") no-repeat right 12px center; appearance:none; outline:none; cursor:pointer; transition:border-color 0.2s; }
        .sort-select:focus { border-color:var(--gold); }
        .product-count { margin-left:auto; font-size:13px; color:var(--text-light); white-space:nowrap; }
        .product-count strong { color:var(--text-dark); font-weight:600; }

        /* FILTER TABS */
        .shop-filters { max-width:1296px; margin:0 auto 32px; padding:0 48px; display:flex; gap:10px; flex-wrap:wrap; }
        .filter-btn { padding:8px 20px; border-radius:24px; border:1.5px solid var(--border); font-size:12px; font-weight:600; letter-spacing:0.06em; text-transform:uppercase; color:var(--text); background:transparent; cursor:pointer; transition:all 0.2s var(--ease-out); }
        .filter-btn:hover { border-color:var(--gold); color:var(--gold); }
        .filter-btn.active { background:var(--gold); border-color:var(--gold); color:#fff; }

        /* PRODUCTS GRID */
        .products-container { max-width:1296px; margin:0 auto; padding:0 48px 80px; }
        .products-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:28px; }

        /* PRODUCT CARD */
        .product-card { cursor:pointer; background:#fff; border:1px solid rgba(0,0,0,0.07); transition:box-shadow 0.3s ease,border-color 0.3s ease; }
        .product-card:hover { box-shadow:0 8px 40px rgba(0,0,0,0.10); border-color:rgba(0,89,105,0.15); }

        /* Image */
        .product-img-wrap { position:relative; overflow:hidden; aspect-ratio:3/4; background:#f5f2ee; }
        .product-img-wrap img { width:100%; height:100%; object-fit:cover; transition:transform 0.7s cubic-bezier(0.22,1,0.36,1); }
        .product-card:hover .product-img-wrap img { transform:scale(1.05); }

        /* Badge */
        .product-badge { position:absolute; top:12px; left:12px; background:rgba(255,255,255,0.90); backdrop-filter:blur(6px); -webkit-backdrop-filter:blur(6px); color:#005969; font-size:9px; font-weight:700; letter-spacing:0.12em; text-transform:uppercase; padding:4px 9px; border-radius:2px; }
        .card-cart-badge { position:absolute; top:10px; left:10px; background:#005969; color:#fff; font-size:10px; font-weight:700; padding:3px 8px 3px 6px; border-radius:99px; display:flex; align-items:center; gap:4px; pointer-events:none; z-index:3; line-height:1; box-shadow:0 2px 10px rgba(0,89,105,0.35); }

        /* In-card stepper */
        .prod-stepper { flex:1; display:flex; align-items:center; height:42px; border:1.5px solid #005969; border-radius:4px; overflow:hidden; background:#fff; }
        .prod-stepper-btn { width:42px; min-width:42px; height:100%; display:flex; align-items:center; justify-content:center; background:#005969; color:#fff; border:none; font-size:20px; font-weight:300; cursor:pointer; transition:background 0.15s,transform 0.08s; line-height:1; padding:0; font-family:inherit; flex-shrink:0; user-select:none; }
        .prod-stepper-btn:hover { background:#003d4a; }
        .prod-stepper-btn:active { transform:scale(0.85); }
        .prod-stepper-count { flex:1; display:flex; align-items:center; justify-content:center; background:#fff; font-size:14px; font-weight:700; color:#005969; user-select:none; border-left:1px solid #b8dde3; border-right:1px solid #b8dde3; }

        /* Wishlist — always visible, subtle until interacted */
        .product-wish { position:absolute; top:12px; right:12px; width:34px; height:34px; background:rgba(255,255,255,0.88); backdrop-filter:blur(6px); -webkit-backdrop-filter:blur(6px); border-radius:50%; display:flex; align-items:center; justify-content:center; opacity:0.7; transition:opacity 0.2s,transform 0.25s cubic-bezier(0.34,1.56,0.64,1),background 0.2s; border:none; cursor:pointer; touch-action:manipulation; }
        .product-wish:hover { opacity:1; transform:scale(1.12); background:rgba(255,255,255,0.98); }
        .product-wish.wished { opacity:1; }
        .product-wish svg { width:15px; height:15px; fill:none; stroke:#1a1a1a; stroke-width:1.8; }
        .product-wish.wished svg { fill:#e04040; stroke:#e04040; }

        /* Actions panel */
        .product-actions { position:absolute; bottom:0; left:0; right:0; background:rgba(255,255,255,0.97); backdrop-filter:blur(10px); -webkit-backdrop-filter:blur(10px); padding:12px 14px; transform:translateY(100%); transition:transform 0.32s cubic-bezier(0.22,1,0.36,1); display:flex; gap:8px; border-top:1px solid rgba(0,0,0,0.06); }
        .product-card:hover .product-actions { transform:translateY(0); }

        /* Action buttons */
        .product-action-btn { flex:1; padding:11px 8px; font-size:12px; font-weight:600; letter-spacing:0.06em; text-transform:uppercase; transition:background 0.2s,color 0.2s,border-color 0.2s; cursor:pointer; border:none; font-family:var(--font-body); touch-action:manipulation; }
        .product-action-btn.pa-primary { background:var(--gold); color:#fff; }
        .product-action-btn.pa-primary:hover { background:var(--gold-dark); }
        .product-action-btn.pa-primary.cart-added { background:#2eaa6e; }
        .product-action-btn.pa-secondary { border:1px solid #d8d8d8; color:#555; background:transparent; flex:1; }
        .product-action-btn.pa-secondary:hover { border-color:var(--gold); color:var(--gold); }

        /* Product info */
        .product-info { padding:14px 12px 18px; }
        .product-meta { font-size:10px; font-weight:600; color:var(--text-light); margin-bottom:6px; letter-spacing:0.1em; text-transform:uppercase; }
        .product-name { font-family:var(--font-head); font-size:15px; font-weight:700; color:var(--text-dark); margin-bottom:10px; line-height:1.4; transition:color 0.2s; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
        .product-card:hover .product-name { color:var(--gold-dark); }
        .product-price { display:flex; align-items:center; justify-content:space-between; }
        .price-current { font-size:16px; font-weight:600; color:var(--text-dark); font-variant-numeric:tabular-nums; }
        .product-rating { display:flex; align-items:center; }
        .stars { color:#c9a84c; font-size:11px; letter-spacing:0.5px; }

        /* SKELETON */
        .skeleton-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:28px; }
        .skeleton-card { overflow:hidden; border:1px solid rgba(0,0,0,0.06); }
        .skeleton-img { aspect-ratio:3/4; background:#f0ebe4; position:relative; overflow:hidden; }
        .skeleton-info { padding:16px 0 8px; display:flex; flex-direction:column; gap:10px; }
        .skeleton-line { height:14px; border-radius:4px; background:#f0ebe4; position:relative; overflow:hidden; }
        .skeleton-line.short { width:60%; }
        .skeleton-line.medium { width:80%; }
        .skeleton-line.wide { width:100%; }
        .skeleton-img::after,.skeleton-line::after { content:''; position:absolute; inset:0; background:linear-gradient(90deg,transparent 0%,rgba(255,255,255,0.6) 50%,transparent 100%); background-size:200% 100%; animation:shimmer 1.4s infinite; }
        @keyframes shimmer { 0%{background-position:200% 0}100%{background-position:-200% 0} }

        /* EMPTY STATE */
        .empty-state { text-align:center; padding:80px 20px; }
        .empty-state-icon { font-size:48px; margin-bottom:20px; }
        .empty-state h3 { font-family:var(--font-head); font-size:24px; font-weight:700; color:var(--text-dark); margin-bottom:10px; }
        .empty-state p { color:var(--text-light); margin-bottom:24px; }
        .empty-state button { padding:12px 28px; background:var(--gold); color:#fff; font-size:13px; font-weight:600; letter-spacing:0.06em; text-transform:uppercase; border-radius:4px; border:none; cursor:pointer; transition:background 0.2s; }
        .empty-state button:hover { background:var(--gold-dark); }

        /* LOAD MORE */
        .center-cta { text-align:center; margin-top:48px; }
        .btn-outline { display:inline-flex; align-items:center; gap:10px; padding:14px 40px; border:1.5px solid var(--text-dark); color:var(--text-dark); font-size:12px; font-weight:700; letter-spacing:0.12em; text-transform:uppercase; transition:all 0.3s var(--ease-out); cursor:pointer; background:transparent; font-family:var(--font-body); }
        .btn-outline svg { width:16px; height:16px; fill:none; stroke:currentColor; stroke-width:2; transition:transform 0.3s var(--ease-out); }
        .btn-outline:hover { background:var(--text-dark); color:#fff; border-color:var(--text-dark); }
        .btn-outline:hover svg { transform:translateX(4px); }

        /* REVEAL ANIMATIONS */
        .reveal { opacity:0; transform:translateY(20px); transition:opacity 0.6s var(--ease-out),transform 0.6s var(--ease-out); }
        .reveal.visible { opacity:1; transform:translateY(0); }
        .reveal-delay-1 { transition-delay:0.05s; }
        .reveal-delay-2 { transition-delay:0.12s; }
        .reveal-delay-3 { transition-delay:0.19s; }
        .reveal-delay-4 { transition-delay:0.26s; }

        /* HERITAGE SECTION */
        .heritage-section { display:grid; grid-template-columns:1fr 1fr; align-items:center; background:var(--surface); overflow:hidden; }
        .heritage-img-wrap { position:relative; height:100%; min-height:460px; overflow:hidden; }
        .heritage-img-wrap img { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; }
        .heritage-content { padding:80px 10%; }
        .heritage-title { font-family:'Playfair Display',serif; font-size:30px; font-weight:400; color:var(--text-dark); margin-bottom:20px; line-height:1.3; }
        .heritage-desc { font-size:15px; color:var(--text-light); line-height:1.8; margin-bottom:32px; max-width:400px; }
        .btn-story { display:inline-flex; align-items:center; justify-content:center; border:1px solid var(--text-dark); color:var(--text-dark); padding:14px 40px; font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:0.15em; transition:all 0.3s; text-decoration:none; }
        .btn-story:hover { background:var(--text-dark); color:#fff; }

        /* BACK TO TOP */
        .back-top { position:fixed; bottom:32px; right:32px; width:44px; height:44px; background:var(--gold); color:#fff; border-radius:50%; display:flex; align-items:center; justify-content:center; opacity:0; pointer-events:none; transform:translateY(12px); transition:opacity 0.3s,transform 0.3s var(--ease-out); z-index:50; border:none; cursor:pointer; }
        .back-top.visible { opacity:1; pointer-events:auto; transform:translateY(0); }
        .back-top svg { width:20px; height:20px; fill:none; stroke:currentColor; stroke-width:2.5; }

        /* RESPONSIVE */
        @media (max-width:1024px) {
          .products-grid,.skeleton-grid { grid-template-columns:repeat(3,1fr); }
        }
        @media (max-width:768px) {
          .page-header { padding:32px 16px 20px; }
          .shop-toolbar { padding:0 16px; flex-wrap:wrap; gap:10px; }
          .search-wrap { max-width:100%; flex:1 1 100%; }
          .sort-select { width:100%; }
          .shop-filters { padding:0 16px; overflow-x:auto; flex-wrap:nowrap; -webkit-overflow-scrolling:touch; scrollbar-width:none; }
          .shop-filters::-webkit-scrollbar { display:none; }
          .filter-btn { flex-shrink:0; }
          .products-container { padding:0 16px 60px; }
          .products-grid,.skeleton-grid { grid-template-columns:repeat(2,1fr); gap:16px; }
          .heritage-section { grid-template-columns:1fr; }
          .heritage-img-wrap { min-height:300px; }
          .heritage-content { padding:48px 24px; text-align:center; }
        }
        @media (max-width:480px) {
          .products-grid,.skeleton-grid { grid-template-columns:repeat(2,1fr); gap:12px; }
          .product-name { font-size:14px; }
          .price-current { font-size:15px; }
        }
      `}</style>
    </>
  );
}

// Scroll reveal observer
function RevealObserver() {
  useEffect(() => {
    const obs = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); obs.unobserve(e.target); } });
    }, { threshold: 0.1 });
    const observe = () => document.querySelectorAll('.reveal:not(.visible)').forEach(el => obs.observe(el));
    observe();
    const timer = setInterval(observe, 500);
    return () => { obs.disconnect(); clearInterval(timer); };
  }, []);
  return null;
}

export default function ShopPage() {
  return (
    <>
      <ShopContent />
      <RevealObserver />
    </>
  );
}
