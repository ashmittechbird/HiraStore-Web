import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useFrappeAuth, useFrappeGetDoc, useFrappePostCall } from 'frappe-react-sdk';
import { useCart } from '@/store/cart';

interface FrappeUser { full_name?: string; email?: string; }

export default function CheckoutPage() {
  const { items, totalPrice } = useCart();
  const navigate = useNavigate();
  const [form, setForm] = useState({ fullName: '', email: '', phone: '', address: '', city: '', state: '', zip: '' });
  const [coupon, setCoupon] = useState('');
  const [discount, setDiscount] = useState(0);
  const [couponMsg, setCouponMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Buy Now: single item bypassing cart
  const [buyNowItems] = useState<typeof items | null>(() => {
    try { return JSON.parse(sessionStorage.getItem('hs_buynow') || 'null'); } catch { return null; }
  });
  const effectiveItems = buyNowItems ?? items;

  const { currentUser, isLoading: authLoading } = useFrappeAuth();
  // Only fetch the User doc when currentUser is actually set — avoids GET /api/.../User/undefined noise.
  const { data: userDoc } = useFrappeGetDoc<FrappeUser>('User', currentUser || undefined);
  const { call: frappeGetList } = useFrappePostCall<{ message: any[] }>('frappe.client.get_list');
  const { call: frappeGet } = useFrappePostCall<{ message: any }>('frappe.client.get');

  const subtotal = effectiveItems.reduce((s, i) => s + i.price * i.qty, 0);
  const total = Math.max(0, subtotal - discount);

  // Redirect unauthenticated users
  useEffect(() => {
    if (!authLoading && !currentUser) navigate('/login?return=/checkout');
  }, [authLoading, currentUser, navigate]);

  // Pre-fill from Frappe user doc once it resolves
  useEffect(() => {
    if (!currentUser) return;
    const emailLike = /.+@.+\..+/.test(currentUser);
    setForm(f => ({
      ...f,
      fullName: f.fullName || userDoc?.full_name || '',
      email: f.email || userDoc?.email || (emailLike ? currentUser : ''),
    }));
  }, [currentUser, userDoc]);

  // Pre-fill saved address + coupon from previous step — once on mount
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('hs_saved_address') || '{}');
      setForm(f => ({ ...f, ...saved }));
    } catch { /* ok */ }
    try {
      const c = JSON.parse(sessionStorage.getItem('hs_coupon') || 'null');
      if (c) { setCoupon(c.code); setDiscount(c.discount); }
    } catch { /* ok */ }
  }, []);

  function update(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }));
  }

  async function applyCoupon() {
    if (!coupon.trim()) return;
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
      setCouponMsg(`Coupon applied! Saving $${disc.toFixed(2)}`);
      sessionStorage.setItem('hs_coupon', JSON.stringify({ code: coupon.trim(), discount: disc }));
    } catch (e: unknown) {
      setCouponMsg((e as Error).message || 'Invalid coupon');
      setDiscount(0);
      sessionStorage.removeItem('hs_coupon');
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const { fullName, email, phone, address, city, state, zip } = form;
    if (!fullName || !email || !phone || !address || !city || !state || !zip) {
      setError('Please fill all required fields');
      return;
    }
    setError('');
    // Save address for next time
    localStorage.setItem('hs_saved_address', JSON.stringify({ address, city, state, zip, phone }));
    // Save checkout data for payment page (clamp discount, include shipping)
    const safeDiscount = Math.min(discount, subtotal);
    const shipping = 0;
    sessionStorage.setItem('hs_checkout', JSON.stringify({
      customer: form,
      cart: effectiveItems,
      couponCode: coupon,
      discount: safeDiscount,
      shipping,
      subtotal,
      total: Math.max(0, subtotal - safeDiscount + shipping),
    }));
    if (buyNowItems) sessionStorage.removeItem('hs_buynow');
    navigate('/payment');
  }

  if (effectiveItems.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '80px 24px' }}>
        <h2>Your cart is empty</h2>
        <Link to="/shop" style={{ color: '#005969', marginTop: '16px', display: 'inline-block' }}>← Continue Shopping</Link>
      </div>
    );
  }

  return (
    <div className="checkout-page">
      {/* Steps */}
      <div className="steps">
        <div className="step active"><div className="step-num">1</div><span>Shipping</span></div>
        <div className="step-div" />
        <div className="step"><div className="step-num">2</div><span>Payment</span></div>
        <div className="step-div" />
        <div className="step"><div className="step-num">3</div><span>Confirm</span></div>
      </div>

      <div className="page-wrap">
        {/* Form */}
        <div>
          <form onSubmit={handleSubmit}>
            <div className="card">
              <div className="card-head">
                <h2>Shipping Address</h2>
                <p>Where should we deliver your order?</p>
              </div>
              <div className="card-body">
                <div className="field-row">
                  <div className="field-group"><label>Full Name *</label><input value={form.fullName} onChange={e => update('fullName', e.target.value)} placeholder="Your name" /></div>
                  <div className="field-group"><label>Email *</label><input type="email" value={form.email} onChange={e => update('email', e.target.value)} placeholder="your@email.com" autoComplete="email" /></div>
                </div>
                <div className="field-group"><label>Phone *</label><input value={form.phone} onChange={e => update('phone', e.target.value)} placeholder="+1 (555) 000-0000" /></div>
                <div className="field-group"><label>Address *</label><input value={form.address} onChange={e => update('address', e.target.value)} placeholder="Street address" /></div>
                <div className="field-row">
                  <div className="field-group"><label>City *</label><input value={form.city} onChange={e => update('city', e.target.value)} placeholder="City" /></div>
                  <div className="field-group"><label>State *</label><input value={form.state} onChange={e => update('state', e.target.value)} placeholder="State" /></div>
                </div>
                <div className="field-row">
                  <div className="field-group"><label>ZIP *</label><input value={form.zip} onChange={e => update('zip', e.target.value)} placeholder="12345" /></div>
                  <div />
                </div>

                {/* Coupon */}
                <div className="coupon-section">
                  <label>Promo Code</label>
                  <div className="coupon-row">
                    <input value={coupon} onChange={e => setCoupon(e.target.value)} placeholder="Enter code" />
                    <button type="button" className="btn-coupon" onClick={applyCoupon}>Apply</button>
                  </div>
                  {couponMsg && <div className={`coupon-msg${couponMsg.startsWith('Coupon applied') ? ' ok' : ' err'}`}>{couponMsg}</div>}
                </div>
              </div>
            </div>

            {error && <div className="form-error">{error}</div>}
            <button type="submit" className="btn-primary" disabled={loading}>
              Continue to Payment →
            </button>
            <p className="security-note">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
              Your information is encrypted and never shared
            </p>
          </form>
        </div>

        {/* Order Summary */}
        <div className="order-col">
          <div className="card">
            <div className="card-head"><h2>Order Summary</h2><p>{effectiveItems.length} item{effectiveItems.length !== 1 ? 's' : ''}</p></div>
            <div className="summary-items">
              {effectiveItems.map(item => (
                <div key={item.id} className="sum-item">
                  <div className="sum-img">
                    <img src={item.image} alt={item.name} />
                    <span className="sum-qty">{item.qty}</span>
                  </div>
                  <div className="sum-info">
                    <div className="sum-name">{item.name}</div>
                    <div className="sum-cat">{item.category}</div>
                  </div>
                  <div className="sum-price">${(item.price * item.qty).toFixed(2)}</div>
                </div>
              ))}
            </div>
            <div className="summary-totals">
              <div className="total-row"><span>Subtotal</span><span>${subtotal.toFixed(2)}</span></div>
              <div className="total-row"><span>Shipping</span><span>Free</span></div>
              {discount > 0 && <div className="total-row" style={{ color: '#16a34a' }}><span>Discount</span><span>−${discount.toFixed(2)}</span></div>}
              <div className="total-row grand"><span>Total</span><span>${total.toFixed(2)}</span></div>
            </div>
          </div>
        </div>
      </div>

      <style>{checkoutStyles}</style>
    </div>
  );
}

const checkoutStyles = `
  .checkout-page { background:#f8fbfc;min-height:80vh; }
  .steps { display:flex;justify-content:center;gap:0;padding:28px 0 8px;background:#fff;border-bottom:1px solid #ddeef1; }
  .step { display:flex;align-items:center;gap:8px;font-size:13px;color:#6b8b91;padding:0 20px; }
  .step.active { color:#005969;font-weight:500; }
  .step-num { width:24px;height:24px;border-radius:50%;border:1.5px solid currentColor;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:600; }
  .step.active .step-num { background:#005969;border-color:#005969;color:#fff; }
  .step-div { width:40px;height:1px;background:#c8e0e4; }
  .page-wrap { max-width:1040px;margin:0 auto;padding:40px 24px;display:grid;grid-template-columns:1fr 380px;gap:32px;align-items:start; }
  .card { background:#fff;border-radius:10px;border:1px solid #ddeef1;box-shadow:0 2px 24px rgba(0,26,32,.09); }
  .card-head { padding:24px 28px 20px;border-bottom:1px solid #ddeef1; }
  .card-head h2 { font-family:'Playfair Display',serif;font-size:1.4rem;color:#005969;font-weight:400; }
  .card-head p { font-size:13px;color:#6b8b91;margin-top:4px; }
  .card-body { padding:24px 28px; }
  .field-row { display:grid;grid-template-columns:1fr 1fr;gap:16px; }
  .field-group { margin-bottom:16px; }
  .field-group label { display:block;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:#6b8b91;margin-bottom:6px; }
  .field-group input { width:100%;padding:11px 14px;border:1.5px solid #c8e0e4;border-radius:7px;font-size:14px;outline:none;transition:border-color .2s; }
  .field-group input:focus { border-color:#005969; }
  .coupon-section { margin-top:8px; }
  .coupon-section > label { display:block;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:#6b8b91;margin-bottom:6px; }
  .coupon-row { display:flex;gap:8px; }
  .coupon-row input { flex:1;padding:11px 14px;border:1.5px solid #c8e0e4;border-radius:7px;font-size:14px;outline:none;transition:border-color .2s; }
  .coupon-row input:focus { border-color:#005969; }
  .btn-coupon { padding:11px 20px;background:#005969;color:#fff;border:none;border-radius:7px;font-size:13px;font-weight:600;cursor:pointer;transition:background .2s; }
  .btn-coupon:hover { background:#003d4a; }
  .coupon-msg { font-size:12px;margin-top:8px; }
  .coupon-msg.ok { color:#16a34a; }
  .coupon-msg.err { color:#dc2626; }
  .form-error { background:#fef2f2;color:#dc2626;padding:12px 16px;border-radius:8px;font-size:13px;margin:16px 0; }
  .btn-primary { width:100%;margin-top:20px;padding:16px;background:#005969;color:#fff;border:none;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;transition:background .2s;text-transform:uppercase;letter-spacing:.08em; }
  .btn-primary:hover { background:#003d4a; }
  .security-note { display:flex;align-items:center;gap:8px;font-size:12px;color:#6b8b91;margin-top:14px;justify-content:center; }
  .security-note svg { width:14px;height:14px;flex-shrink:0; }
  .summary-items { padding:16px 24px;border-bottom:1px solid #ddeef1; }
  .sum-item { display:flex;align-items:center;gap:12px;margin-bottom:16px; }
  .sum-img { position:relative;width:56px;height:56px;border-radius:8px;overflow:hidden;background:#f0f8f9;flex-shrink:0; }
  .sum-img img { width:100%;height:100%;object-fit:cover; }
  .sum-qty { position:absolute;top:-6px;right:-6px;background:#005969;color:#fff;font-size:10px;font-weight:700;width:18px;height:18px;border-radius:50%;display:flex;align-items:center;justify-content:center; }
  .sum-info { flex:1; }
  .sum-name { font-size:13px;font-weight:500;color:#334d52;line-height:1.3; }
  .sum-cat { font-size:11px;color:#6b8b91;margin-top:2px; }
  .sum-price { font-size:14px;font-weight:600;color:#334d52; }
  .summary-totals { padding:16px 24px; }
  .total-row { display:flex;justify-content:space-between;font-size:14px;margin-bottom:10px;color:#6b8b91; }
  .total-row.grand { font-size:16px;font-weight:700;color:#334d52;border-top:1px solid #ddeef1;padding-top:12px;margin-top:4px; }
  @media(max-width:768px) { .page-wrap{grid-template-columns:1fr} .order-col{order:-1} .field-row{grid-template-columns:1fr} }
`;
