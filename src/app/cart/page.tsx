import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '@/store/cart';
import { useFrappePostCall } from 'frappe-react-sdk';

export default function CartPage() {
  const { items, removeItem, updateQty, clearCart, totalItems, totalPrice } = useCart();
  const [coupon, setCoupon] = useState('');
  const [discount, setDiscount] = useState(0);
  const [couponMsg, setCouponMsg] = useState('');
  const [couponLoading, setCouponLoading] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const navigate = useNavigate();

  const { call: frappeGetList } = useFrappePostCall<{ message: any[] }>('frappe.client.get_list');
  const { call: frappeGet } = useFrappePostCall<{ message: any }>('frappe.client.get');

  const subtotal = totalPrice();
  const shipping = subtotal >= 15 ? 0 : 5;
  const total = subtotal - discount + shipping;

  async function applyCoupon() {
    if (!coupon.trim()) return;
    setCouponLoading(true);
    setCouponMsg('');
    try {
      const today = new Date().toISOString().split('T')[0];
      const listRes = await frappeGetList({
        doctype: 'Coupon Code',
        fields: ['name', 'coupon_code', 'minimum_amount', 'valid_upto'],
        filters: [['coupon_code', '=', coupon.trim()]],
        limit: 1,
      });
      const hit = listRes.message?.[0];
      if (!hit) throw new Error('Invalid coupon code');
      if (hit.valid_upto && hit.valid_upto < today) throw new Error('This coupon code has expired');
      const docRes = await frappeGet({ doctype: 'Coupon Code', name: hit.name });
      const couponDoc = docRes.message;
      if (couponDoc.minimum_amount && subtotal < couponDoc.minimum_amount)
        throw new Error(`Minimum order $${couponDoc.minimum_amount} required`);
      const disc = couponDoc.discount_percentage
        ? +(subtotal * couponDoc.discount_percentage / 100).toFixed(2)
        : 0;
      setDiscount(disc);
      setCouponMsg(`✓ Coupon applied! You save $${disc.toFixed(2)}`);
    } catch (e: unknown) {
      setCouponMsg((e as Error).message || 'Invalid coupon');
      setDiscount(0);
    }
    setCouponLoading(false);
  }

  function handleRemove(id: string) {
    setRemoving(id);
    setTimeout(() => {
      removeItem(id);
      setRemoving(null);
    }, 350);
  }

  function handleCheckout() {
    // Save coupon/discount to session storage for checkout
    if (discount > 0) {
      sessionStorage.setItem('hs_coupon', JSON.stringify({ code: coupon, discount }));
    }
    navigate('/checkout');
  }

  const emptyOrFull = (
    <div className="cart-page">
      {/* Hero */}
      <div className="cart-hero">
        <div className="hero-ornament">
          <div className="hero-ornament-line" />
          <div className="hero-ornament-dot" />
          <div className="hero-ornament-line" />
        </div>
        <h1>Your <em>Cart</em></h1>
        <p>{totalItems()} item{totalItems() !== 1 ? 's' : ''}</p>
      </div>

      {items.length === 0 ? (
        <div className="empty-state visible">
          <div className="empty-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="32" height="32"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/></svg>
          </div>
          <h3>Your cart is empty</h3>
          <p>Looks like you haven&apos;t added anything yet.</p>
          <Link to="/shop" className="shop-btn">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
            Browse Collection
          </Link>
        </div>
      ) : (
        <div className="cart-wrapper">
          {/* Items panel */}
          <div className="cart-items-panel">
            <div className="section-label">Your Selections</div>
            <div className="cart-items-list">
              {items.map(item => (
                <div key={item.id} className={`cart-item${removing === item.id ? ' removing' : ''}`}>
                  <div className="item-image">
                    <img src={item.image || 'https://images.unsplash.com/photo-1605100804763-247f67b3557e?w=200'} alt={item.name} />
                  </div>
                  <div className="item-body">
                    <div className="item-meta">
                      <div className="item-category">{item.category}</div>
                      <div className="item-name">{item.name}</div>
                    </div>
                    <div className="item-controls">
                      <div className="qty-control">
                        <button className="qty-btn" onClick={() => updateQty(item.id, item.qty - 1)}>−</button>
                        <span className="qty-value">{item.qty}</span>
                        <button className="qty-btn" onClick={() => updateQty(item.id, item.qty + 1)}>+</button>
                      </div>
                      <button className="remove-btn" onClick={() => handleRemove(item.id)}>Remove</button>
                    </div>
                  </div>
                  <div className="item-price-col">
                    <div className="item-unit-price">${item.price.toFixed(2)} each</div>
                    <div className="item-total-price"><span className="currency">$</span>{(item.price * item.qty).toFixed(2)}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Promo code */}
            <div className="promo-section">
              <input
                className="promo-input"
                placeholder="Promo code"
                value={coupon}
                onChange={e => setCoupon(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && applyCoupon()}
              />
              <button className="promo-apply" onClick={applyCoupon} disabled={couponLoading}>
                {couponLoading ? '…' : 'Apply'}
              </button>
            </div>
            {couponMsg && (
              <div className={`promo-message${couponMsg.startsWith('✓') ? ' success' : ' error'}`}>{couponMsg}</div>
            )}
          </div>

          {/* Order Summary */}
          <div className="order-summary">
            <div className="summary-card">
              <div className="summary-header">
                <h2>Order Summary</h2>
                <p>{items.length} item{items.length !== 1 ? 's' : ''}</p>
              </div>
              <div className="summary-body">
                <div className="summary-row">
                  <span className="summary-row-label">Subtotal</span>
                  <span className="summary-row-value">${subtotal.toFixed(2)}</span>
                </div>
                {discount > 0 && (
                  <div className="summary-row">
                    <span className="summary-row-label">Discount</span>
                    <span className="summary-row-value discount">−${discount.toFixed(2)}</span>
                  </div>
                )}
                <div className="summary-row">
                  <span className="summary-row-label">Shipping</span>
                  <span className={`summary-row-value${shipping === 0 ? ' free' : ''}`}>{shipping === 0 ? 'Free' : `$${shipping.toFixed(2)}`}</span>
                </div>
                {shipping > 0 && (
                  <div style={{ fontSize: '12px', color: '#007a8c', background: '#e0f7fa', padding: '8px 12px', borderRadius: '4px', marginBottom: '8px' }}>
                    Add ${(15 - subtotal).toFixed(2)} more for free shipping
                  </div>
                )}
                <div className="summary-divider" />
                <div className="summary-total-row">
                  <span className="summary-total-label">Total</span>
                  <span className="summary-total-value">${total.toFixed(2)}</span>
                </div>
                <button className="checkout-btn" onClick={handleCheckout}>Proceed to Checkout</button>
                <Link to="/shop" className="continue-link">← Continue Shopping</Link>
                <button className="clear-link" onClick={clearCart}>Clear Cart</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{cartStyles}</style>
    </div>
  );

  return emptyOrFull;
}

const cartStyles = `
  .cart-page { background:#f8fbfc;min-height:100vh; }

  /* Hero */
  .cart-hero {
    background: linear-gradient(135deg, #001a20 0%, #003d4a 60%, #004d5e 100%);
    position: relative; overflow: hidden;
    padding: 52px 32px 44px; text-align: center;
  }
  .cart-hero::before {
    content: '';
    position: absolute; inset: 0;
    background: radial-gradient(ellipse at 20% 50%, rgba(0,122,140,0.25) 0%, transparent 60%),
                radial-gradient(ellipse at 80% 30%, rgba(0,89,105,0.18) 0%, transparent 55%);
  }
  .cart-hero::after {
    content: ''; position: absolute; bottom: 0; left: 0; right: 0;
    height: 1px; background: linear-gradient(90deg, transparent, #005969, transparent);
  }
  .hero-ornament { display:flex;align-items:center;justify-content:center;gap:16px;margin-bottom:16px;opacity:0.6; }
  .hero-ornament-line { height:1px;width:60px;background:linear-gradient(90deg,transparent,#007a8c); }
  .hero-ornament-line:last-child { background:linear-gradient(90deg,#007a8c,transparent); }
  .hero-ornament-dot { width:5px;height:5px;border-radius:50%;background:#007a8c; }
  .cart-hero h1 { font-family:'Playfair Display',serif;font-size:clamp(32px,5vw,48px);font-weight:400;color:#fff;letter-spacing:.02em;line-height:1.1;position:relative; }
  .cart-hero h1 em { color:#007a8c;font-style:italic; }
  .cart-hero p { margin-top:10px;font-size:13px;color:rgba(255,255,255,0.5);letter-spacing:.1em;text-transform:uppercase;position:relative; }

  /* Empty state */
  .empty-state { text-align:center;padding:80px 32px;display:flex;flex-direction:column;align-items:center;gap:20px; }
  .empty-icon { width:80px;height:80px;border-radius:50%;background:#e0f2f4;display:flex;align-items:center;justify-content:center;animation:float 3s ease-in-out infinite;color:#005969; }
  @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
  .empty-state h3 { font-family:'Playfair Display',serif;font-size:26px;font-weight:400;color:#001a20; }
  .empty-state p { font-size:14px;color:#6b8b91;max-width:280px;line-height:1.7; }
  .shop-btn { display:inline-flex;align-items:center;gap:8px;padding:13px 28px;background:#001a20;color:#fff;font-size:12px;font-weight:500;letter-spacing:.1em;text-transform:uppercase;border-radius:2px;transition:background .25s,transform .2s; }
  .shop-btn:hover { background:#003d4a;transform:translateY(-1px); }

  /* Layout */
  .cart-wrapper { max-width:1200px;margin:0 auto;padding:48px 32px 80px;display:grid;grid-template-columns:1fr 380px;gap:40px;align-items:start;position:relative;z-index:1; }

  /* Section label */
  .section-label { font-size:11px;font-weight:500;letter-spacing:.14em;text-transform:uppercase;color:#003d4a;margin-bottom:20px;display:flex;align-items:center;gap:12px; }
  .section-label::after { content:'';flex:1;height:1px;background:#c8e0e4; }

  /* Cart item */
  .cart-item { background:#fff;border:1px solid #ddeef1;border-radius:4px;margin-bottom:14px;display:grid;grid-template-columns:110px 1fr auto;gap:0;overflow:hidden;transition:box-shadow .3s,transform .3s;animation:slideIn .45s both; }
  .cart-item:hover { box-shadow:0 2px 40px rgba(0,26,32,.10);transform:translateY(-1px); }
  .cart-item.removing { animation:slideOut .4s forwards; }
  @keyframes slideIn { from{opacity:0;transform:translateX(-20px)} to{opacity:1;transform:translateX(0)} }
  @keyframes slideOut { from{opacity:1;transform:translateX(0) scaleY(1);max-height:200px} to{opacity:0;transform:translateX(-20px) scaleY(0.8);max-height:0;margin-bottom:0} }
  .item-image { width:110px;aspect-ratio:1;overflow:hidden;background:#f0f8f9;flex-shrink:0; }
  .item-image img { width:100%;height:100%;object-fit:cover;transition:transform .5s; }
  .cart-item:hover .item-image img { transform:scale(1.06); }
  .item-body { padding:18px 20px;display:flex;flex-direction:column;justify-content:space-between;gap:10px; }
  .item-meta { display:flex;flex-direction:column;gap:4px; }
  .item-category { font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:#005969;font-weight:500; }
  .item-name { font-family:'Cormorant Garamond','Playfair Display',serif;font-size:17px;font-weight:500;color:#001a20;line-height:1.3; }
  .item-controls { display:flex;align-items:center;gap:14px; }
  .qty-control { display:flex;align-items:center;gap:0;border:1px solid #c8e0e4;border-radius:3px;overflow:hidden; }
  .qty-btn { width:32px;height:32px;display:flex;align-items:center;justify-content:center;background:#f0f8f9;color:#334d52;font-size:16px;font-weight:300;transition:background .2s,color .2s;border:none;cursor:pointer;flex-shrink:0; }
  .qty-btn:hover { background:#005969;color:#fff; }
  .qty-value { width:40px;height:32px;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:500;color:#001a20;border-left:1px solid #c8e0e4;border-right:1px solid #c8e0e4;background:#fff; }
  .remove-btn { font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#6b8b91;padding:4px 0;border-bottom:1px solid transparent;transition:color .2s,border-color .2s;background:none;border-top:none;border-left:none;border-right:none;cursor:pointer; }
  .remove-btn:hover { color:#c0392b;border-bottom-color:#c0392b; }
  .item-price-col { padding:18px 20px 18px 0;display:flex;flex-direction:column;align-items:flex-end;justify-content:space-between;min-width:90px; }
  .item-unit-price { font-size:11px;color:#6b8b91;letter-spacing:.04em; }
  .item-total-price { font-family:'Cormorant Garamond','Playfair Display',serif;font-size:22px;font-weight:600;color:#001a20;letter-spacing:-.01em; }
  .currency { font-size:13px;font-weight:400;vertical-align:super;margin-right:2px; }

  /* Promo */
  .promo-section { margin-top:24px;border:1px dashed #c8e0e4;border-radius:4px;padding:16px 20px;display:flex;gap:10px;background:rgba(255,255,255,0.5); }
  .promo-input { flex:1;height:40px;border:1px solid #c8e0e4;border-radius:3px;padding:0 14px;font-size:13px;color:#001a20;background:#fff;outline:none;transition:border-color .2s;letter-spacing:.06em;text-transform:uppercase; }
  .promo-input::placeholder { text-transform:none;color:#6b8b91;letter-spacing:0; }
  .promo-input:focus { border-color:#005969; }
  .promo-apply { height:40px;padding:0 18px;background:#005969;color:#fff;font-size:12px;font-weight:500;letter-spacing:.08em;text-transform:uppercase;border-radius:3px;transition:background .2s;border:none;cursor:pointer;white-space:nowrap; }
  .promo-apply:hover { background:#003d4a; }
  .promo-apply:disabled { opacity:.6;cursor:not-allowed; }
  .promo-message { font-size:12px;margin-top:8px;padding:0 4px; }
  .promo-message.success { color:#27ae60; }
  .promo-message.error { color:#c0392b; }

  /* Summary card */
  .order-summary { position:sticky;top:90px; }
  .summary-card { background:#fff;border:1px solid #ddeef1;border-radius:4px;overflow:hidden;box-shadow:0 1px 12px rgba(0,26,32,.07); }
  .summary-header { background:linear-gradient(135deg,#001a20 0%,#003d4a 60%,#004d5e 100%);padding:20px 24px;position:relative;overflow:hidden; }
  .summary-header::after { content:'';position:absolute;bottom:0;left:0;right:0;height:1px;background:linear-gradient(90deg,transparent,rgba(0,89,105,.6),transparent); }
  .summary-header h2 { font-family:'Playfair Display',serif;font-size:18px;font-weight:400;color:#fff;letter-spacing:.04em; }
  .summary-header p { font-size:11px;color:rgba(255,255,255,0.4);margin-top:3px;letter-spacing:.08em;text-transform:uppercase; }
  .summary-body { padding:24px; }
  .summary-row { display:flex;justify-content:space-between;align-items:baseline;padding:10px 0;border-bottom:1px solid #ddeef1; }
  .summary-row:last-of-type { border-bottom:none; }
  .summary-row-label { font-size:13px;color:#334d52; }
  .summary-row-value { font-size:14px;font-weight:500;color:#001a20; }
  .summary-row-value.free { color:#27ae60;font-size:12px;letter-spacing:.06em;text-transform:uppercase; }
  .summary-row-value.discount { color:#003d4a; }
  .summary-divider { height:1px;background:linear-gradient(90deg,transparent,#c8e0e4,transparent);margin:16px 0; }
  .summary-total-row { display:flex;justify-content:space-between;align-items:baseline;padding:4px 0 20px; }
  .summary-total-label { font-family:'Cormorant Garamond',serif;font-size:16px;color:#001a20;letter-spacing:.02em; }
  .summary-total-value { font-family:'Playfair Display',serif;font-size:28px;font-weight:700;color:#001a20;letter-spacing:-.02em; }
  .checkout-btn { width:100%;padding:16px;background:#005969;color:#fff;border:none;border-radius:4px;font-size:13px;font-weight:500;letter-spacing:.1em;text-transform:uppercase;cursor:pointer;transition:background .2s,transform .1s;margin-bottom:12px; }
  .checkout-btn:hover { background:#003d4a;transform:translateY(-1px); }
  .continue-link { display:block;text-align:center;font-size:13px;color:#6b8b91;transition:color .2s;margin-bottom:8px; }
  .continue-link:hover { color:#005969; }
  .clear-link { display:block;width:100%;text-align:center;font-size:11px;color:#6b8b91;text-transform:uppercase;letter-spacing:.08em;text-decoration:underline;background:none;border:none;cursor:pointer;transition:color .2s;padding:4px 0; }
  .clear-link:hover { color:#c0392b; }

  @media(max-width:768px) { .cart-wrapper{grid-template-columns:1fr;padding:24px 16px} .order-summary{position:static} .cart-item{grid-template-columns:80px 1fr} .item-price-col{display:none} }
`;
