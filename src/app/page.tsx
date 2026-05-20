import { useEffect, useState, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useFrappeGetDocList } from 'frappe-react-sdk';
import { itemImage, itemPrice, itemName, itemCategory, itemId } from '@/lib/api';
import { useCart } from '@/store/cart';
import { useWishlist } from '@/store/wishlist';

const HERO_IMAGES = [
  'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=2000&q=85',
  'https://images.unsplash.com/photo-1611591437281-460bfbe1220a?w=2000&q=85',
  'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=2000&q=85',
];

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

function ProductCard({ item, onAddToCart }: { item: Product; onAddToCart: (item: Product) => void }) {
  const [added, setAdded] = useState(false);
  const [popping, setPopping] = useState(false);
  const wishToggle = useWishlist(s => s.toggle);
  const wishHas = useWishlist(s => s.has);
  const imgSrc = itemImage(item as Parameters<typeof itemImage>[0]);
  const price = itemPrice(item as Parameters<typeof itemPrice>[0]);
  const name = itemName(item as Parameters<typeof itemName>[0]);
  const category = itemCategory(item as Parameters<typeof itemCategory>[0]);
  const id = itemId(item as Parameters<typeof itemId>[0]);
  const wished = wishHas(id);

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

  return (
    <div className="product-card">
      <div className="product-img-wrap">
        <img src={imgSrc} alt={name} loading="lazy" />
        <button
          className={`product-wish${wished ? ' wished' : ''}${popping ? ' popping' : ''}`}
          onClick={handleWish}
          aria-label="Wishlist"
        >
          <svg viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>
        </button>
        <div className="product-actions">
          <button className="product-action-btn pa-primary" onClick={handleAdd}>
            {added ? 'Added ✓' : 'Add to Cart'}
          </button>
          <Link to={`/product/${encodeURIComponent(id)}`} className="product-action-btn pa-secondary">
            Quick View
          </Link>
        </div>
      </div>
      <div className="product-info">
        <h3 className="product-name">{name}</h3>
        <p className="product-meta">{category || '925 Silver'}</p>
        <div className="product-price">${Number(price).toLocaleString('en-US')}</div>
      </div>
    </div>
  );
}

const HP_FIELDS = ['name','item_name','item_group','standard_rate','image','disabled'];

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
          { icon: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>, text: 'BIS Hallmarked' },
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
              : mostLoved.map(item => (
                  <ProductCard key={itemId(item as Parameters<typeof itemId>[0])} item={item} onAddToCart={handleAdd} />
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
              : newArrivals.map(item => (
                  <ProductCard key={itemId(item as Parameters<typeof itemId>[0])} item={item} onAddToCart={handleAdd} />
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
          <p className="offer-subtext">Handcrafted sterling silver &amp; gemstone pieces, now at our best prices of the season.</p>
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
        .products-grid { display: grid; grid-template-columns: repeat(4,1fr); gap: 40px 24px; }
        .product-card { position: relative; display: flex; flex-direction: column; }
        .product-img-wrap { position: relative; aspect-ratio: 4/5; overflow: hidden; background: var(--surface); margin-bottom: 20px; }
        .product-img-wrap img { width: 100%; height: 100%; object-fit: cover; transition: transform 0.7s var(--ease-out); }
        .product-card:hover .product-img-wrap img { transform: scale(1.06); }

        .product-wish { position: absolute; top: 12px; right: 12px; width: 34px; height: 34px; display: flex; align-items: center; justify-content: center; background: rgba(255,255,255,0.9); border-radius: 50%; opacity: 0; transform: translateY(-5px); transition: all 0.3s var(--ease-out); }
        .product-card:hover .product-wish { opacity: 1; transform: translateY(0); }
        .product-wish svg { width: 16px; height: 16px; fill: none; stroke: var(--text-main); stroke-width: 1.5; transition: fill 0.2s; }
        .product-wish.wished svg { fill: #e04040; stroke: #e04040; }
        .product-wish.popping { animation: pop 0.4s var(--ease-spring); }
        @keyframes pop { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.3); } }

        .product-actions { position: absolute; bottom: 0; left: 0; width: 100%; display: flex; transform: translateY(100%); transition: transform 0.4s var(--ease-out); }
        .product-card:hover .product-actions { transform: translateY(0); }
        .product-action-btn { flex: 1; padding: 14px 10px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; transition: background 0.3s; border-radius: 0; text-align: center; }
        .pa-primary { background: var(--text-main); color: #fff; }
        .pa-primary:hover { background: var(--accent-gold); }
        .pa-secondary { background: rgba(255,255,255,0.95); color: var(--text-main); }
        .pa-secondary:hover { background: #fff; color: var(--accent-gold); }
        .product-info { display: flex; flex-direction: column; gap: 6px; text-align: center; }
        .product-name { font-family: var(--font-head); font-size: 16px; font-weight: 500; color: var(--text-main); }
        .product-meta { font-size: 11px; color: var(--text-light); text-transform: uppercase; letter-spacing: 0.05em; }
        .product-price { font-size: 14px; font-weight: 600; color: var(--text-main); margin-top: 4px; }

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
