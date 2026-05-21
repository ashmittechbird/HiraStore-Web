import { useEffect, useState, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useFrappeGetDocList } from 'frappe-react-sdk';
import { itemImage, itemImages, itemPrice, itemName, itemCategory, itemId } from '@/lib/api';
import { useCart } from '@/store/cart';
import { useWishlist } from '@/store/wishlist';

const HERO_IMAGES = [
  'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=2000&q=85',
  'https://images.unsplash.com/photo-1611591437281-460bfbe1220a?w=2000&q=85',
  'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=2000&q=85',
];

const BADGE_CYCLE = ['New', 'Bestseller', '', 'Limited', 'Trending', '', ''];

const CATEGORIES = [
  { name: 'Necklaces', img: 'https://images.unsplash.com/photo-1599643477877-530eb83abc8e?w=400&q=85', cat: 'Necklaces' },
  { name: 'Earrings',  img: 'https://images.unsplash.com/photo-1617038220319-276d3cfab638?w=400&q=85', cat: 'Earrings' },
  { name: 'Rings',     img: 'https://images.unsplash.com/photo-1605100804763-247f67b3557e?w=400&q=85', cat: 'Rings' },
  { name: 'Bracelets', img: 'https://images.unsplash.com/photo-1611591437281-460bfbe1220a?w=400&q=85', cat: 'Bracelets' },
  { name: 'Gift Sets', img: 'https://images.unsplash.com/photo-1598560917807-1bae44bd2be8?w=400&q=85', cat: 'GiftSets' },
];

const TESTIMONIALS = [
  { name: 'Anuska Ananya, 24', text: 'Hira Store is my go-to place for jewellery. I love that I can wear their jewellery to work, dates, parties and brunches. It goes with everything and makes my outfits look stylish and trendy.', img: 'https://images.unsplash.com/photo-1602173574767-37ac01994b2a?w=500&q=80', rot: '-4deg' },
  { name: 'Priya Singh, 34',   text: 'I had trouble finding jewellery that suited my minimalist style, but Hira\'s sleek and elegant designs were exactly what I was looking for. They have pieces for every style and occasion.', img: 'https://images.unsplash.com/photo-1611591437281-460bfbe1220a?w=500&q=80', rot: '2deg' },
  { name: 'Avni Sharma, 27',   text: 'Me and my friends love Hira\'s unique designs. Their pieces add a pop of colour to my outfits. The jewellery is stylish, modern and a breath of fresh air.', img: 'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=500&q=80', rot: '-2deg' },
  { name: 'Meera Kapoor, 31',  text: 'I gifted a Hira necklace to my sister and she absolutely loved it. The packaging was beautiful and the quality is stunning. Will definitely be ordering again!', img: 'https://images.unsplash.com/photo-1573408301185-9519f94816b5?w=500&q=80', rot: '3deg' },
  { name: 'Riya Mehta, 29',    text: 'The craftsmanship is absolutely beautiful. Every piece I\'ve bought from Hira Store feels so luxurious and special. My friends always ask me where I got my jewellery from!', img: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=500&q=80', rot: '-3deg' },
];

const UGC_IMAGES = [
  'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=400&q=80',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&q=80',
  'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&q=80',
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&q=80',
];

interface Product {
  name?: string;
  item_name?: string;
  item_group?: string;
  category?: string;
  standard_rate?: number;
  price_usd?: number;
  price?: number;
  image?: string;
  product_id?: string;
  disabled?: boolean;
  status?: string;
  [key: string]: unknown;
}

function useReveal() {
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -50px 0px' }
    );
    document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, []);
}

function ProductCard({ item, onAddToCart, badge }: { item: Product; onAddToCart: (item: Product) => void; badge?: string }) {
  const [added, setAdded] = useState(false);
  const [popping, setPopping] = useState(false);
  const [qvOpen, setQvOpen] = useState(false);
  const [qvIdx, setQvIdx] = useState(0);
  const [qvAdded, setQvAdded] = useState(false);
  const navigate = useNavigate();
  const wishToggle = useWishlist(s => s.toggle);
  const wishHas = useWishlist(s => s.has);
  const updateQty = useCart(s => s.updateQty);
  const cartItems = useCart(s => s.items);
  const addItemDirect = useCart(s => s.addItem);
  const imgSrc = itemImage(item as Parameters<typeof itemImage>[0]);
  const imgs = itemImages(item as Parameters<typeof itemImages>[0], 4);
  const price = itemPrice(item as Parameters<typeof itemPrice>[0]);
  const name = itemName(item as Parameters<typeof itemName>[0]);
  const category = itemCategory(item as Parameters<typeof itemCategory>[0]);
  const id = itemId(item as Parameters<typeof itemId>[0]);
  const wished = wishHas(id);
  const cartQty = cartItems.find(i => i.id === id)?.qty || 0;
  const priceStr = price > 0 ? `$${Number(price).toLocaleString('en-US')}` : 'Price on request';

  function handleAdd() {
    if (added) return;
    onAddToCart(item);
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  }

  function handleWish() {
    wishToggle({ id, name, category, price, image: imgSrc });
    setPopping(true);
    setTimeout(() => setPopping(false), 400);
  }

  function handleQVAdd() {
    onAddToCart(item);
    setQvAdded(true);
    setTimeout(() => setQvAdded(false), 1600);
  }

  return (
    <>
      <div className="product-card" onClick={() => navigate(`/product/${encodeURIComponent(id)}`)} style={{ cursor: 'pointer' }}>
        <div className="product-img-wrap">
          <img src={imgSrc} alt={name} loading="lazy" />
          {cartQty > 0
            ? <span className="card-cart-badge"><svg viewBox="0 0 24 24" width="9" height="9" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/></svg> {cartQty}</span>
            : badge && <span className="product-badge">{badge}</span>
          }
          <button
            className={`product-wish${wished ? ' wished' : ''}${popping ? ' popping' : ''}`}
            onClick={e => { e.stopPropagation(); handleWish(); }}
            aria-label="Wishlist"
          >
            <svg viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>
          </button>
          <div className="product-actions">
            {cartQty > 0 ? (
              <div className="prod-stepper" onClick={e => e.stopPropagation()}>
                <button className="prod-stepper-btn" aria-label="Remove one" onClick={e => { e.stopPropagation(); updateQty(id, cartQty - 1); }}>−</button>
                <span className="prod-stepper-count">{cartQty}</span>
                <button className="prod-stepper-btn" aria-label="Add one" onClick={e => { e.stopPropagation(); addItemDirect({ id, name, category, price, image: imgSrc }); }}>+</button>
              </div>
            ) : (
              <button className={`product-action-btn pa-primary${added ? ' cart-added' : ''}`} onClick={e => { e.stopPropagation(); handleAdd(); }}>
                {added ? 'Added ✓' : 'Add to Cart'}
              </button>
            )}
            <button className="product-action-btn pa-secondary" onClick={e => { e.stopPropagation(); setQvOpen(true); setQvIdx(0); setQvAdded(false); }}>
              Quick View
            </button>
          </div>
        </div>
        <div className="product-info">
          <p className="product-meta">{category || 'Jewellery'}</p>
          <h3 className="product-name">{name}</h3>
          <div className="product-price">
            <span className="price-current">{priceStr}</span>
            <div className="product-rating"><span className="stars">★★★★★</span></div>
          </div>
        </div>
      </div>

      {qvOpen && (
        <div style={{ display:'flex',position:'fixed',inset:0,background:'rgba(0,0,0,0.6)',backdropFilter:'blur(5px)',zIndex:1000,alignItems:'center',justifyContent:'center',padding:'16px' }}
          onClick={() => setQvOpen(false)}>
          <div style={{ background:'#fff',maxWidth:'900px',width:'100%',maxHeight:'90vh',overflowY:'auto',position:'relative',display:'grid',gridTemplateColumns:'1fr 1fr' }}
            onClick={e => e.stopPropagation()}>
            <button onClick={() => setQvOpen(false)} style={{ position:'absolute',top:'16px',right:'16px',background:'rgba(255,255,255,0.9)',border:'none',width:'32px',height:'32px',borderRadius:'50%',cursor:'pointer',zIndex:10,display:'flex',alignItems:'center',justifyContent:'center' }}>
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
              <div style={{ fontSize:'10px',letterSpacing:'0.2em',textTransform:'uppercase',color:'#737373',marginBottom:'12px' }}>{category}</div>
              <h2 style={{ fontFamily:'Playfair Display,serif',fontSize:'28px',fontWeight:400,color:'#2c2c2c',marginBottom:'8px',lineHeight:1.2 }}>{name}</h2>
              <div style={{ fontSize:'20px',fontWeight:600,color:'#2c2c2c',margin:'16px 0' }}>{priceStr}</div>
              <div style={{ display:'flex',flexDirection:'column',gap:'12px',marginTop:'24px',marginBottom:'24px' }}>
                {cartQty > 0 ? (
                  <div style={{ display:'flex',alignItems:'center',border:'1.5px solid #2c2c2c',overflow:'hidden' }}>
                    <button onClick={() => updateQty(id, cartQty - 1)} style={{ width:'48px',height:'48px',background:'#2c2c2c',color:'#fff',border:'none',fontSize:'20px',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,transition:'background 0.15s',fontFamily:'inherit' }}>−</button>
                    <span style={{ flex:1,textAlign:'center',fontSize:'14px',fontWeight:700,color:'#2c2c2c' }}>{cartQty} in cart</span>
                    <button onClick={() => addItemDirect({ id, name, category, price, image: imgSrc })} style={{ width:'48px',height:'48px',background:'#2c2c2c',color:'#fff',border:'none',fontSize:'20px',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,transition:'background 0.15s',fontFamily:'inherit' }}>+</button>
                  </div>
                ) : (
                  <button onClick={handleQVAdd} style={{ background: qvAdded ? '#2eaa6e' : '#2c2c2c',color:'#fff',padding:'16px',fontSize:'11px',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.1em',border:'none',cursor:'pointer',transition:'background 0.3s',fontFamily:'inherit' }}>
                    {qvAdded ? 'Added ✓' : 'Add to Cart'}
                  </button>
                )}
                <button onClick={() => { setQvOpen(false); sessionStorage.setItem('hs_buynow', JSON.stringify([{ id, name, category, price, image: imgSrc, qty: 1 }])); navigate('/checkout'); }} style={{ background:'transparent',color:'#2c2c2c',padding:'16px',fontSize:'11px',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.1em',border:'2px solid #2c2c2c',cursor:'pointer',transition:'background .2s,color .2s',fontFamily:'inherit' }}
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
      )}
    </>
  );
}

const HP_FIELDS = ['name','item_name','item_group','standard_rate','image','custom_item_images','weight_per_unit','disabled'];

export default function HomePage() {
  const [heroIdx, setHeroIdx] = useState(0);
  const addItem = useCart(s => s.addItem);
  useReveal();

  const { data: featuredItems = [] } = useFrappeGetDocList<Product>('Item', {
    fields: HP_FIELDS,
    filters: [['custom_is_featured', '=', 1], ['disabled', '=', 0]],
    limit: 8,
    orderBy: { field: 'modified', order: 'desc' },
  });
  const { data: recentItems = [] } = useFrappeGetDocList<Product>('Item', {
    fields: HP_FIELDS,
    filters: [['disabled', '=', 0]],
    limit: 8,
    orderBy: { field: 'modified', order: 'desc' },
  });
  const { data: newArrivals = [] } = useFrappeGetDocList<Product>('Item', {
    fields: HP_FIELDS,
    filters: [['disabled', '=', 0]],
    limit: 4,
    orderBy: { field: 'creation', order: 'desc' },
  });

  const mostLoved = featuredItems.length > 0 ? featuredItems : recentItems;

  useEffect(() => {
    const t = setInterval(() => setHeroIdx(i => (i + 1) % HERO_IMAGES.length), 6000);
    return () => clearInterval(t);
  }, []);

  const handleAdd = useCallback((item: Product) => {
    addItem({
      id: itemId(item as Parameters<typeof itemId>[0]),
      name: itemName(item as Parameters<typeof itemName>[0]),
      category: itemCategory(item as Parameters<typeof itemCategory>[0]),
      price: itemPrice(item as Parameters<typeof itemPrice>[0]),
      image: itemImage(item as Parameters<typeof itemImage>[0]),
    });
  }, [addItem]);

  return (
    <>
      {/* Hero */}
      <section className="hero">
        <div className="hero-slider">
          {HERO_IMAGES.map((src, i) => (
            <img key={i} src={src} alt="Jewelry" className={`hero-img${i === heroIdx ? ' active' : ''}`} />
          ))}
        </div>
        <div className="hero-overlay" />
        <div className="hero-content">
          <p className="hero-eyebrow">The New Collection</p>
          <h1 className="hero-title">Everyday Elegance<br />Redefined.</h1>
          <Link to="/shop" className="hero-btn">Explore Collection</Link>
        </div>
      </section>

      {/* Trust Bar */}
      <div className="trust-bar">
        {[
          { icon: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>, text: 'Premium Quality' },
          { icon: <><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></>, text: 'Skin Friendly' },
          { icon: <><rect x="1" y="3" width="13" height="13"/><polygon points="13 3 20 3 23 6 23 16 13 16 13 3"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="17.5" cy="18.5" r="2.5"/></>, text: 'Free Shipping' },
          { icon: <path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>, text: 'Cash on Delivery' },
        ].map(({ icon, text }) => (
          <div key={text} className="trust-item">
            <svg viewBox="0 0 24 24">{icon}</svg>
            <span className="trust-text">{text}</span>
          </div>
        ))}
      </div>

      {/* Shop by Category */}
      <section className="section">
        <div className="section-header reveal">
          <h2 className="section-title">Shop by Category</h2>
          <p className="section-desc">Discover our range of meticulously crafted demi-fine jewelry.</p>
        </div>
        <div className="cat-grid">
          {CATEGORIES.map((c, i) => (
            <Link key={c.cat} to={`/shop?cat=${c.cat}`} className={`cat-card reveal reveal-delay-${(i % 4) + 1}`}>
              <div className="cat-img-wrap">
                <img src={c.img} alt={c.name} />
              </div>
              <span className="cat-name">{c.name}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* Most Loved */}
      <section className="section section-alt">
        <div className="section-inner">
          <div className="section-header reveal">
            <h2 className="section-title">Most Loved Pieces</h2>
            <p className="section-desc">Our highly coveted bestsellers, handcrafted to perfection.</p>
          </div>
          <div className="products-grid">
            {mostLoved.length === 0
              ? Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="product-card skeleton-card">
                    <div className="product-img-wrap" style={{ background: '#eaeaea', animation: 'shimmer 1.5s infinite' }} />
                  </div>
                ))
              : mostLoved.map((item, idx) => (
                  <ProductCard key={itemId(item as Parameters<typeof itemId>[0])} item={item} onAddToCart={handleAdd} badge={BADGE_CYCLE[idx % BADGE_CYCLE.length]} />
                ))
            }
          </div>
          <div className="center reveal">
            <Link to="/shop" className="btn-outline-center">Shop Bestsellers</Link>
          </div>
        </div>
      </section>

      {/* Philosophy */}
      <section className="philosophy-section reveal">
        <div className="philosophy-watermark">Hira</div>
        <div className="philosophy-content">
          <blockquote className="philosophy-quote">
            &ldquo;We believe that elegance is not a luxury reserved for special occasions &mdash; it is a feeling you deserve to carry with you, every day.&rdquo;
          </blockquote>
          <div className="philosophy-divider" />
          <div className="philosophy-label">The Hira Store Philosophy</div>
        </div>
      </section>

      {/* New Arrivals */}
      <section className="section section-alt">
        <div className="section-inner">
          <div className="section-header reveal">
            <h2 className="section-title">New Arrivals</h2>
            <p className="section-desc">Freshly handcrafted pieces just for you.</p>
          </div>
          <div className="products-grid">
            {newArrivals.length === 0
              ? Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="product-card">
                    <div className="product-img-wrap" style={{ background: '#eaeaea' }} />
                  </div>
                ))
              : newArrivals.map((item, idx) => (
                  <ProductCard key={itemId(item as Parameters<typeof itemId>[0])} item={item} onAddToCart={handleAdd} badge={BADGE_CYCLE[idx % BADGE_CYCLE.length]} />
                ))
            }
          </div>
          <div className="center reveal">
            <Link to="/shop" className="btn-outline-center">Shop New Arrivals</Link>
          </div>
        </div>
      </section>

      {/* Promo Banners */}
      <section className="section">
        <div className="promo-grid">
          <Link to="/shop?cat=Bridal" className="promo-card reveal">
            <img src="https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=800&q=85" alt="Bridal Edit" />
            <div className="promo-content">
              <h3 className="promo-title">The Bridal Edit</h3>
              <span className="promo-link">
                Explore Collection{' '}
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
                </svg>
              </span>
            </div>
          </Link>
          <Link to="/shop?cat=Gifts" className="promo-card reveal reveal-delay-2">
            <img src="https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=800&q=85" alt="Gifting" />
            <div className="promo-content">
              <h3 className="promo-title">Gifts of Love</h3>
              <span className="promo-link">
                Shop Gifts{' '}
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
                </svg>
              </span>
            </div>
          </Link>
        </div>
      </section>

      {/* Offer Banner */}
      <section className="offer-banner reveal">
        <div className="offer-model offer-model-left">
          <img src="https://images.unsplash.com/photo-1611085583191-a3b181a88401?w=900&q=90" alt="Model wearing earrings" />
        </div>
        <div className="offer-center">
          <div className="offer-tag">Limited Time</div>
          <p className="offer-eyebrow">Summer Edit — 2025</p>
          <div className="offer-divider" />
          <div className="offer-percent"><sup>UP TO </sup>30<sup>%</sup></div>
          <p className="offer-off">OFF</p>
          <h2 className="offer-headline">Adorn Yourself<br />for Less</h2>
          <p className="offer-subtext">Handcrafted artificial jewellery pieces, now at our best prices of the season.</p>
          <div className="offer-code-wrap">
            <span className="offer-code-label">Use Code</span>
            <span className="offer-code">HIRA30</span>
          </div>
          <Link to="/shop" className="offer-cta">Shop the Sale</Link>
        </div>
        <div className="offer-model offer-model-right">
          <img src="https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=900&q=90" alt="Model wearing necklace" />
        </div>
      </section>

      {/* Testimonials */}
      <section className="testimonials-section">
        <div className="section-header reveal" style={{ padding: '0 40px', marginBottom: '40px' }}>
          <h2 className="section-title">Loved by Our Customers</h2>
          <p className="section-desc">Real stories from real Hira wearers</p>
        </div>
        <div className="testimonials-carousel-wrap">
          <div className="testimonials-string-line" />
          <div className="testimonials-track-outer">
            <div className="testimonials-track">
              {[...TESTIMONIALS, ...TESTIMONIALS].map((t, i) => (
                <div key={i} className="polaroid-card" style={{ '--rot': t.rot } as React.CSSProperties}>
                  <div className="polaroid-clip" />
                  <div className="polaroid-inner">
                    <img src={t.img} alt={t.name} />
                  </div>
                  <div className="polaroid-caption">
                    <div className="polaroid-name">{t.name}</div>
                    <p className="polaroid-text">{t.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Instagram / UGC */}
      <section className="section">
        <div className="section-header reveal">
          <h2 className="section-title">Spotted in Hira</h2>
          <p className="section-desc">Tag @hirastore to be featured</p>
        </div>
        <div className="ig-grid">
          {UGC_IMAGES.map((src, i) => (
            <div key={i} className={`ig-item reveal reveal-delay-${i + 1}`}>
              <img src={src} alt="UGC" />
              <div className="ig-overlay">
                <svg viewBox="0 0 24 24">
                  <rect x="2" y="2" width="20" height="20" rx="5"/>
                  <path d="M16 11.37A4 4 0 1112.63 8 4 4 0 0116 11.37z"/>
                  <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>
                </svg>
              </div>
            </div>
          ))}
        </div>
      </section>

      <style>{`
        /* Hero */
        .hero { height: 85vh; min-height: 500px; position: relative; overflow: hidden; display: flex; align-items: center; justify-content: center; text-align: center; background: #e3dfd8; }
        .hero-slider { position: absolute; inset: 0; width: 100%; height: 100%; }
        .hero-img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; opacity: 0; transition: opacity 1.5s ease-in-out; }
        .hero-img.active { opacity: 1; animation: zoomOut 15s ease-out forwards; z-index: 1; }
        @keyframes zoomOut { from { transform: scale(1.1); } to { transform: scale(1); } }
        .hero-overlay { position: absolute; inset: 0; background: linear-gradient(to top, rgba(0,0,0,0.5), rgba(0,0,0,0.1)); z-index: 2; }
        .hero-content { position: relative; z-index: 10; color: #fff; max-width: 600px; padding: 0 20px; }
        .hero-eyebrow { font-size: 11px; letter-spacing: 0.25em; text-transform: uppercase; margin-bottom: 20px; font-weight: 600; opacity: 0; animation: fadeUp 1s 0.3s var(--ease-out) forwards; color: #f0ebe1; }
        .hero-title { font-family: var(--font-head); font-size: clamp(40px, 5vw, 64px); font-weight: 400; line-height: 1.15; margin-bottom: 30px; opacity: 0; animation: fadeUp 1s 0.5s var(--ease-out) forwards; }
        .hero-btn { display: inline-flex; align-items: center; gap: 10px; background: #fff; color: var(--text-main); padding: 16px 40px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.15em; transition: background 0.3s, transform 0.3s var(--ease-out); opacity: 0; animation: fadeUp 1s 0.7s var(--ease-out) forwards; border-radius: 2px; }
        .hero-btn:hover { background: var(--surface-hover); transform: translateY(-3px); }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }

        /* Trust Bar */
        .trust-bar { display: flex; justify-content: center; gap: 80px; padding: 24px 40px; background: #fff; border-bottom: 1px solid var(--border); flex-wrap: wrap; }
        .trust-item { display: flex; align-items: center; gap: 12px; color: var(--text-main); }
        .trust-item svg { width: 20px; height: 20px; stroke: var(--text-main); stroke-width: 1.5; fill: none; }
        .trust-text { font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em; font-weight: 600; }

        /* Sections */
        .section { padding: 33px 40px; max-width: 1300px; margin: 0 auto; }
        .section-alt { background: #effcff; padding: 33px 40px; }
        .section-inner { max-width: 1300px; margin: 0 auto; }
        .section-header { text-align: center; margin-bottom: 56px; }
        .section-title { font-family: var(--font-head); font-size: clamp(28px, 4vw, 36px); font-weight: 400; color: var(--text-main); margin-bottom: 16px; }
        .section-desc { font-size: 14px; color: var(--text-light); max-width: 500px; margin: 0 auto; }

        /* Reveal */
        .reveal { opacity: 0; transform: translateY(30px); transition: all 0.8s var(--ease-out); }
        .reveal.visible { opacity: 1; transform: translateY(0); }
        .reveal-delay-1 { transition-delay: 0.1s; }
        .reveal-delay-2 { transition-delay: 0.2s; }
        .reveal-delay-3 { transition-delay: 0.3s; }
        .reveal-delay-4 { transition-delay: 0.4s; }

        /* Category Grid */
        .cat-grid { display: grid; grid-template-columns: repeat(5,1fr); gap: 40px 20px; }
        .cat-card { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 16px; }
        .cat-img-wrap { width: 100%; aspect-ratio: 1; border-radius: 50%; overflow: hidden; background: var(--surface); transition: transform 0.4s var(--ease-spring); }
        .cat-img-wrap img { width: 100%; height: 100%; object-fit: cover; transition: transform 0.6s var(--ease-out); }
        .cat-card:hover .cat-img-wrap { transform: scale(1.03); }
        .cat-card:hover .cat-img-wrap img { transform: scale(1.1); }
        .cat-name { font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.1em; color: var(--text-main); }

        /* Products Grid */
        .products-grid { display: grid; grid-template-columns: repeat(4,1fr); gap: 28px; }
        .product-card { background: #fff; border: 1px solid rgba(0,0,0,0.07); transition: box-shadow 0.3s ease, border-color 0.3s ease; }
        .product-card:hover { box-shadow: 0 8px 40px rgba(0,0,0,0.10); border-color: rgba(0,89,105,0.15); }
        .product-img-wrap { position: relative; aspect-ratio: 3/4; overflow: hidden; background: #f5f2ee; }
        .product-img-wrap img { width: 100%; height: 100%; object-fit: cover; transition: transform 0.7s cubic-bezier(0.22,1,0.36,1); }
        .product-card:hover .product-img-wrap img { transform: scale(1.05); }

        .product-badge { position: absolute; top: 12px; left: 12px; background: rgba(255,255,255,0.90); backdrop-filter: blur(6px); color: #005969; font-size: 9px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; padding: 4px 9px; border-radius: 2px; }
        .card-cart-badge { position: absolute; top: 10px; left: 10px; background: #005969; color: #fff; font-size: 10px; font-weight: 700; padding: 3px 8px 3px 6px; border-radius: 99px; display: flex; align-items: center; gap: 4px; pointer-events: none; z-index: 3; line-height: 1; box-shadow: 0 2px 10px rgba(0,89,105,0.35); }

        .prod-stepper { flex: 1; display: flex; align-items: center; height: 42px; border: 1.5px solid #005969; border-radius: 4px; overflow: hidden; background: #fff; }
        .prod-stepper-btn { width: 42px; min-width: 42px; height: 100%; display: flex; align-items: center; justify-content: center; background: #005969; color: #fff; border: none; font-size: 20px; font-weight: 300; cursor: pointer; transition: background 0.15s, transform 0.08s; line-height: 1; padding: 0; font-family: inherit; flex-shrink: 0; user-select: none; }
        .prod-stepper-btn:hover { background: #003d4a; }
        .prod-stepper-btn:active { transform: scale(0.85); }
        .prod-stepper-count { flex: 1; display: flex; align-items: center; justify-content: center; background: #fff; font-size: 14px; font-weight: 700; color: #005969; user-select: none; border-left: 1px solid #b8dde3; border-right: 1px solid #b8dde3; }

        .product-wish { position: absolute; top: 12px; right: 12px; width: 34px; height: 34px; background: rgba(255,255,255,0.88); backdrop-filter: blur(6px); border-radius: 50%; display: flex; align-items: center; justify-content: center; opacity: 0.7; transition: opacity 0.2s, transform 0.25s cubic-bezier(0.34,1.56,0.64,1), background 0.2s; border: none; cursor: pointer; touch-action: manipulation; }
        .product-wish:hover { opacity: 1; transform: scale(1.12); background: rgba(255,255,255,0.98); }
        .product-wish.wished { opacity: 1; }
        .product-wish svg { width: 15px; height: 15px; fill: none; stroke: #1a1a1a; stroke-width: 1.8; }
        .product-wish.wished svg { fill: #e04040; stroke: #e04040; }
        .product-wish.popping { animation: pop 0.4s var(--ease-spring); }
        @keyframes pop { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.3); } }

        .product-actions { position: absolute; bottom: 0; left: 0; right: 0; background: rgba(255,255,255,0.97); backdrop-filter: blur(10px); padding: 12px 14px; transform: translateY(100%); transition: transform 0.32s cubic-bezier(0.22,1,0.36,1); display: flex; gap: 8px; border-top: 1px solid rgba(0,0,0,0.06); }
        .product-card:hover .product-actions { transform: translateY(0); }
        .product-action-btn { flex: 1; padding: 11px 8px; font-size: 12px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; transition: background 0.2s, color 0.2s, border-color 0.2s; cursor: pointer; border: none; font-family: inherit; touch-action: manipulation; }
        .pa-primary { background: #005969; color: #fff; }
        .pa-primary:hover { background: #003d4a; }
        .pa-primary.cart-added { background: #2eaa6e; }
        .pa-secondary { border: 1px solid #d8d8d8; color: #555; background: transparent; }
        .pa-secondary:hover { border-color: #005969; color: #005969; }
        .product-info { padding: 14px 12px 18px; }
        .product-name { font-family: var(--font-head); font-size: 15px; font-weight: 700; color: var(--text-main); margin-bottom: 10px; line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; transition: color 0.2s; }
        .product-card:hover .product-name { color: #003d4a; }
        .product-meta { font-size: 10px; font-weight: 600; color: var(--text-light); margin-bottom: 6px; letter-spacing: 0.1em; text-transform: uppercase; }
        .product-price { display: flex; align-items: center; justify-content: space-between; }
        .price-current { font-size: 16px; font-weight: 600; color: var(--text-main); }
        .product-rating { display: flex; align-items: center; }
        .stars { color: #c9a84c; font-size: 11px; letter-spacing: 0.5px; }

        /* Philosophy */
        .philosophy-section { padding: 120px 20px; text-align: center; background: #fff; position: relative; overflow: hidden; display: flex; flex-direction: column; align-items: center; justify-content: center; }
        .philosophy-watermark { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-family: var(--font-head); font-size: clamp(100px, 20vw, 300px); color: rgb(0 81 100 / 18%); z-index: 1; pointer-events: none; white-space: nowrap; }
        .philosophy-content { position: relative; z-index: 2; max-width: 800px; }
        .philosophy-quote { font-family: var(--font-head); font-size: clamp(24px, 4vw, 36px); font-style: italic; line-height: 1.5; color: var(--text-main); margin-bottom: 40px; }
        .philosophy-divider { width: 60px; height: 1px; background: var(--accent-gold); margin: 0 auto 20px auto; }
        .philosophy-label { font-size: 11px; letter-spacing: 0.2em; text-transform: uppercase; color: var(--text-light); font-weight: 600; }

        /* Promo Banners */
        .promo-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; }
        .promo-card { position: relative; aspect-ratio: 4/5; overflow: hidden; display: flex; align-items: flex-end; padding: 40px; background: #eee; }
        .promo-card img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; transition: transform 0.8s var(--ease-out); }
        .promo-card:hover img { transform: scale(1.05); }
        .promo-card::after { content: ''; position: absolute; inset: 0; background: linear-gradient(to top, rgba(0,0,0,0.6), transparent 60%); }
        .promo-content { position: relative; z-index: 10; color: #fff; }
        .promo-title { font-family: var(--font-head); font-size: 32px; margin-bottom: 16px; font-weight: 400; }
        .promo-link { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.1em; display: inline-flex; align-items: center; gap: 8px; border-bottom: 1px solid #fff; padding-bottom: 4px; transition: color 0.3s, border-color 0.3s; }
        .promo-card:hover .promo-link { color: var(--accent-gold); border-color: var(--accent-gold); }

        /* Offer Banner */
        .offer-banner { display: grid; grid-template-columns: 1fr 1.1fr 1fr; align-items: stretch; margin-bottom: 60px; overflow: hidden; background: #1a1209; min-height: 520px; position: relative; }
        .offer-model { position: relative; overflow: hidden; }
        .offer-model img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; object-position: top center; filter: brightness(0.82) saturate(1.1); transition: transform 0.9s var(--ease-out); }
        .offer-model:hover img { transform: scale(1.04); }
        .offer-model-left img { object-position: 60% top; }
        .offer-model-right img { object-position: 40% top; }
        .offer-center { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 64px 40px; text-align: center; position: relative; z-index: 2; background: #1a1209; }
        .offer-center::before, .offer-center::after { content: ''; position: absolute; left: 50%; transform: translateX(-50%); width: 1px; background: linear-gradient(to bottom, transparent, #c8a97e55, transparent); height: 100%; top: 0; pointer-events: none; }
        .offer-center::before { left: 0; }
        .offer-center::after { left: 100%; }
        .offer-eyebrow { font-size: 10px; letter-spacing: 0.25em; text-transform: uppercase; color: var(--accent-gold); font-weight: 600; margin-bottom: 20px; }
        .offer-divider { width: 40px; height: 1px; background: var(--accent-gold); margin: 0 auto 20px; opacity: 0.6; }
        .offer-percent { font-family: var(--font-head); font-size: clamp(64px, 8vw, 100px); font-weight: 400; color: #fff; line-height: 1; letter-spacing: -2px; margin-bottom: 4px; position: relative; display: inline-block; }
        .offer-percent sup { font-size: 0.35em; vertical-align: super; letter-spacing: 0; color: var(--accent-gold); }
        .offer-off { font-size: 11px; letter-spacing: 0.3em; text-transform: uppercase; color: var(--accent-gold); margin-bottom: 20px; }
        .offer-headline { font-family: var(--font-head); font-size: clamp(18px, 2.2vw, 26px); color: #f5ede0; font-weight: 400; font-style: italic; line-height: 1.4; margin-bottom: 16px; }
        .offer-subtext { font-size: 12.5px; color: #a08060; line-height: 1.8; margin-bottom: 32px; max-width: 220px; }
        .offer-code-wrap { border: 1px solid #c8a97e55; padding: 10px 22px; margin-bottom: 32px; display: flex; align-items: center; gap: 10px; }
        .offer-code-label { font-size: 9px; letter-spacing: 0.2em; text-transform: uppercase; color: #a08060; }
        .offer-code { font-size: 14px; font-weight: 600; letter-spacing: 0.12em; color: var(--accent-gold); }
        .offer-cta { display: inline-block; padding: 13px 36px; background: var(--accent-gold); color: #1a1209; font-size: 11px; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase; transition: background 0.2s, transform 0.2s; }
        .offer-cta:hover { background: #dfc090; transform: translateY(-1px); }
        .offer-tag { position: absolute; top: 24px; left: 50%; transform: translateX(-50%); background: #c8212155; color: #ffaaaa; font-size: 9px; letter-spacing: 0.2em; text-transform: uppercase; padding: 4px 14px; white-space: nowrap; }

        /* Testimonials */
        .testimonials-section { padding: 80px 0 60px; background: #fff9f9; overflow: hidden; }
        .testimonials-carousel-wrap { position: relative; padding-top: 44px; }
        .testimonials-string-line { position: absolute; top: 18px; left: 0; right: 0; height: 2px; background: repeating-linear-gradient(90deg, #c9a96e 0, #c9a96e 8px, transparent 8px, transparent 16px); z-index: 2; pointer-events: none; }
        .testimonials-track-outer { overflow: hidden; cursor: grab; }
        .testimonials-track-outer:active { cursor: grabbing; }
        .testimonials-track { display: flex; gap: 36px; padding: 10px 60px 40px; width: max-content; animation: testimonials-scroll 28s linear infinite; }
        .testimonials-track:hover { animation-play-state: paused; }
        @keyframes testimonials-scroll { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
        .polaroid-card { position: relative; background: #fff0f0; padding: 14px 14px 22px; width: 240px; box-shadow: 3px 4px 18px rgba(0,0,0,0.13); transform: rotate(var(--rot, 0deg)); transition: transform 0.3s ease, box-shadow 0.3s ease; flex-shrink: 0; z-index: 1; }
        .polaroid-card:hover { transform: rotate(0deg) scale(1.05); box-shadow: 6px 10px 30px rgba(0,0,0,0.2); z-index: 10; }
        .polaroid-clip { position: absolute; top: -14px; left: 50%; transform: translateX(-50%); width: 22px; height: 28px; background: #888; border-radius: 3px 3px 0 0; }
        .polaroid-clip::after { content: ''; position: absolute; top: 6px; left: 50%; transform: translateX(-50%); width: 8px; height: 14px; background: #555; border-radius: 2px; }
        .polaroid-inner { width: 100%; aspect-ratio: 4/3; overflow: hidden; }
        .polaroid-inner img { width: 100%; height: 100%; object-fit: cover; }
        .polaroid-caption { padding-top: 12px; }
        .polaroid-name { font-size: 13px; font-weight: 700; color: #333; margin-bottom: 6px; }
        .polaroid-text { font-size: 11.5px; color: #555; line-height: 1.6; margin: 0; }

        /* Instagram / UGC */
        .ig-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
        .ig-item { position: relative; aspect-ratio: 1; overflow: hidden; }
        .ig-item img { width: 100%; height: 100%; object-fit: cover; transition: transform 0.5s var(--ease-out); }
        .ig-item:hover img { transform: scale(1.05); }
        .ig-overlay { position: absolute; inset: 0; background: rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; opacity: 0; transition: opacity 0.3s; color: #fff; }
        .ig-item:hover .ig-overlay { opacity: 1; }
        .ig-overlay svg { width: 32px; height: 32px; fill: none; stroke: currentColor; stroke-width: 1.5; }

        /* Utilities */
        .center { text-align: center; }
        .btn-outline-center { display: inline-flex; align-items: center; justify-content: center; border: 1px solid var(--text-main); color: var(--text-main); padding: 14px 40px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.15em; transition: all 0.3s; margin-top: 48px; }
        .btn-outline-center:hover { background: var(--text-main); color: #fff; }
        @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }

        @media (max-width: 1024px) {
          .cat-grid { grid-template-columns: repeat(3, 1fr); }
          .products-grid { grid-template-columns: repeat(3, 1fr); }
          .promo-grid { grid-template-columns: 1fr; }
        }
        @media (max-width: 900px) {
          .offer-banner { grid-template-columns: 1fr; grid-template-rows: 300px auto 300px; }
          .offer-model { min-height: 300px; position: relative; }
          .offer-model img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
          .offer-center { padding: 48px 28px; }
          .offer-percent { font-size: 72px; }
        }
        @media (max-width: 768px) {
          .cat-grid { grid-template-columns: repeat(2, 1fr); gap: 16px; }
          .products-grid { grid-template-columns: repeat(2, 1fr); gap: 16px; }
          .trust-bar { flex-direction: column; align-items: flex-start; gap: 24px; }
          .section { padding: 60px 20px; }
          .section-alt { padding: 60px 20px; }
          .ig-grid { grid-template-columns: repeat(2, 1fr); }
          .polaroid-card { width: 200px; }
          .testimonials-track { gap: 24px; padding: 10px 30px 40px; }
        }
        @media (max-width: 480px) {
          .cat-grid { grid-template-columns: repeat(2, 1fr); }
          .products-grid { grid-template-columns: 1fr 1fr; gap: 20px 12px; }
          .offer-banner { grid-template-rows: 220px auto 220px; }
          .offer-model { min-height: 220px; }
          .offer-center { padding: 36px 20px; }
          .offer-code-wrap { flex-direction: column; gap: 4px; text-align: center; }
          .offer-subtext { max-width: 100%; }
        }
      `}</style>
    </>
  );
}
