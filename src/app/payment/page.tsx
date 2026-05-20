import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '@/store/cart';
import { useFrappeCreateDoc } from 'frappe-react-sdk';

export default function PaymentPage() {
  const navigate = useNavigate();
  const { clearCart } = useCart();
  const { createDoc } = useFrappeCreateDoc();
  const [checkoutData, setCheckoutData] = useState<{ customer: Record<string, string>; cart: unknown[]; couponCode?: string; discount?: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    try {
      const data = JSON.parse(sessionStorage.getItem('hs_checkout') || 'null');
      if (!data || !data.cart || data.cart.length === 0) {
        navigate('/cart');
        return;
      }
      setCheckoutData(data);
    } catch {
      navigate('/cart');
    }
  }, []);

  async function handlePlaceOrder() {
    if (!checkoutData) return;
    setLoading(true);
    setError('');
    try {
      const { customer, cart, couponCode, discount } = checkoutData;
      const today = new Date().toISOString().split('T')[0];
      const delivDate = new Date();
      delivDate.setDate(delivDate.getDate() + 7);

      // Ensure Customer record exists (silently ignored if already exists)
      await createDoc('Customer', {
        customer_name: customer.fullName,
        customer_type: 'Individual',
        customer_group: 'Individual',
        territory: 'All Territories',
        email_id: customer.email,
      }).catch(() => {});

      const result = await createDoc('Sales Order', {
        customer: customer.fullName,
        transaction_date: today,
        delivery_date: delivDate.toISOString().split('T')[0],
        contact_email: customer.email,
        contact_mobile: customer.phone,
        remarks: [`Payment ID: DEMO-${Date.now()}`, couponCode ? `Coupon: ${couponCode} (Discount: $${discount || 0})` : ''].filter(Boolean).join(' | '),
        items: (cart as Array<{ name?: string; id?: string; item_name?: string; qty?: number; price?: number; price_usd?: number }>).map(item => ({
          item_code: (item as any).name || (item as any).id,
          item_name: (item as any).item_name || (item as any).name || (item as any).id,
          qty: (item as any).qty || 1,
          rate: parseFloat(String((item as any).price_usd || (item as any).price || 0)),
          uom: 'Nos',
        })),
      });

      clearCart();
      sessionStorage.removeItem('hs_checkout');
      sessionStorage.removeItem('hs_coupon');
      sessionStorage.setItem('hs_order_success', JSON.stringify({
        orderId: (result as any).name || 'HS-' + Date.now(),
        customer,
        total: (cart as Array<{ price: number; qty: number }>).reduce((s, i) => s + i.price * i.qty, 0) - (discount || 0),
      }));
      navigate('/order-success');
    } catch (e: unknown) {
      setError((e as Error).message || 'Order failed. Please try again.');
    }
    setLoading(false);
  }

  if (!checkoutData) return (
    <div style={{ textAlign: 'center', padding: '80px' }}>Loading…</div>
  );

  const subtotal = (checkoutData.cart as Array<{ price: number; qty: number }>).reduce((s, i) => s + i.price * i.qty, 0);
  const total = subtotal - (checkoutData.discount || 0);

  return (
    <div className="payment-page">
      {/* Steps */}
      <div className="steps">
        <div className="step done"><div className="step-num">✓</div><span>Shipping</span></div>
        <div className="step-div" />
        <div className="step active"><div className="step-num">2</div><span>Payment</span></div>
        <div className="step-div" />
        <div className="step"><div className="step-num">3</div><span>Confirm</span></div>
      </div>

      <div className="pay-wrap">
        <div className="pay-main">
          {/* Order Review */}
          <div className="card">
            <div className="card-head">
              <h2>Review & Confirm</h2>
              <p>Shipping to {checkoutData.customer.city}, {checkoutData.customer.state}</p>
            </div>
            <div className="card-body">
              <div className="address-box">
                <div className="address-label">Deliver to</div>
                <div className="address-name">{checkoutData.customer.fullName}</div>
                <div className="address-line">{checkoutData.customer.address}</div>
                <div className="address-line">{checkoutData.customer.city}, {checkoutData.customer.state} {checkoutData.customer.zip}</div>
                <div className="address-line">{checkoutData.customer.phone}</div>
              </div>

              {/* Payment Method */}
              <div className="payment-method-section">
                <div className="pm-label">Payment Method</div>
                <div className="pm-options">
                  <label className="pm-option selected">
                    <input type="radio" name="pm" defaultChecked />
                    <span>Cash on Delivery</span>
                    <span className="pm-desc">Pay when your order arrives</span>
                  </label>
                </div>
              </div>

              <div className="order-total-display">
                <span>Order Total</span>
                <span className="total-amount">${total.toFixed(2)}</span>
              </div>

              {error && <div className="form-error">{error}</div>}

              <button className="btn-place-order" onClick={handlePlaceOrder} disabled={loading}>
                {loading ? 'Placing Order…' : 'Place Order →'}
              </button>

              <p className="security-note">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
                Secure order placement
              </p>
            </div>
          </div>

          <Link to="/checkout" className="back-link">← Back to Shipping</Link>
        </div>

        {/* Summary */}
        <div className="pay-summary">
          <div className="card">
            <div className="card-head"><h2>Order Summary</h2></div>
            <div className="summary-items">
              {(checkoutData.cart as Array<{ id: string; name: string; image: string; price: number; qty: number; category?: string }>).map(item => (
                <div key={item.id} className="sum-item">
                  <div className="sum-img">
                    <img src={item.image} alt={item.name} />
                    <span className="sum-qty">{item.qty}</span>
                  </div>
                  <div className="sum-info">
                    <div className="sum-name">{item.name}</div>
                  </div>
                  <div className="sum-price">${(item.price * item.qty).toFixed(2)}</div>
                </div>
              ))}
            </div>
            <div className="summary-totals">
              <div className="total-row"><span>Subtotal</span><span>${subtotal.toFixed(2)}</span></div>
              <div className="total-row"><span>Shipping</span><span>Free</span></div>
              {(checkoutData.discount || 0) > 0 && <div className="total-row" style={{ color: '#16a34a' }}><span>Discount</span><span>−${checkoutData.discount!.toFixed(2)}</span></div>}
              <div className="total-row grand"><span>Total</span><span>${total.toFixed(2)}</span></div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .payment-page { background:#f8fbfc;min-height:80vh; }
        .steps { display:flex;justify-content:center;gap:0;padding:28px 0 8px;background:#fff;border-bottom:1px solid #ddeef1; }
        .step { display:flex;align-items:center;gap:8px;font-size:13px;color:#6b8b91;padding:0 20px; }
        .step.active { color:#005969;font-weight:500; }
        .step.done { color:#007a8c; }
        .step-num { width:24px;height:24px;border-radius:50%;border:1.5px solid currentColor;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:600; }
        .step.active .step-num { background:#005969;border-color:#005969;color:#fff; }
        .step-div { width:40px;height:1px;background:#c8e0e4; }
        .pay-wrap { max-width:1040px;margin:0 auto;padding:40px 24px;display:grid;grid-template-columns:1fr 360px;gap:32px;align-items:start; }
        .card { background:#fff;border-radius:10px;border:1px solid #ddeef1;box-shadow:0 2px 24px rgba(0,26,32,.09); }
        .card-head { padding:24px 28px 20px;border-bottom:1px solid #ddeef1; }
        .card-head h2 { font-family:'Playfair Display',serif;font-size:1.4rem;color:#005969;font-weight:400; }
        .card-head p { font-size:13px;color:#6b8b91;margin-top:4px; }
        .card-body { padding:24px 28px; }
        .address-box { background:#f0f8f9;border-radius:8px;padding:16px;margin-bottom:24px; }
        .address-label { font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:#6b8b91;margin-bottom:8px; }
        .address-name { font-size:15px;font-weight:600;color:#334d52;margin-bottom:4px; }
        .address-line { font-size:13px;color:#6b8b91;line-height:1.6; }
        .payment-method-section { margin-bottom:24px; }
        .pm-label { font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:#6b8b91;margin-bottom:12px; }
        .pm-option { display:flex;align-items:center;gap:12px;padding:14px 16px;border:2px solid #005969;border-radius:8px;cursor:pointer;background:#f0f8f9; }
        .pm-option input { accent-color:#005969; }
        .pm-option span:first-of-type { font-weight:600;color:#334d52;font-size:14px; }
        .pm-desc { margin-left:auto;font-size:12px;color:#6b8b91; }
        .order-total-display { display:flex;justify-content:space-between;align-items:center;padding:16px;background:#f0f8f9;border-radius:8px;margin-bottom:20px; }
        .order-total-display span:first-child { font-size:14px;color:#6b8b91;font-weight:500; }
        .total-amount { font-size:22px;font-weight:700;color:#005969;font-family:'Playfair Display',serif; }
        .form-error { background:#fef2f2;color:#dc2626;padding:12px 16px;border-radius:8px;font-size:13px;margin-bottom:16px; }
        .btn-place-order { width:100%;padding:16px;background:#005969;color:#fff;border:none;border-radius:8px;font-size:14px;font-weight:700;cursor:pointer;transition:background .2s;text-transform:uppercase;letter-spacing:.08em;margin-bottom:12px; }
        .btn-place-order:hover:not(:disabled) { background:#003d4a; }
        .btn-place-order:disabled { opacity:.6;cursor:not-allowed; }
        .security-note { display:flex;align-items:center;gap:8px;font-size:12px;color:#6b8b91;justify-content:center; }
        .back-link { display:inline-block;margin-top:16px;font-size:13px;color:#6b8b91;transition:color .2s; }
        .back-link:hover { color:#005969; }
        .summary-items { padding:16px 24px;border-bottom:1px solid #ddeef1; }
        .sum-item { display:flex;align-items:center;gap:12px;margin-bottom:16px; }
        .sum-img { position:relative;width:52px;height:52px;border-radius:8px;overflow:hidden;background:#f0f8f9;flex-shrink:0; }
        .sum-img img { width:100%;height:100%;object-fit:cover; }
        .sum-qty { position:absolute;top:-6px;right:-6px;background:#005969;color:#fff;font-size:10px;font-weight:700;width:18px;height:18px;border-radius:50%;display:flex;align-items:center;justify-content:center; }
        .sum-info { flex:1; }
        .sum-name { font-size:13px;font-weight:500;color:#334d52;line-height:1.3; }
        .sum-price { font-size:13px;font-weight:600;color:#334d52; }
        .summary-totals { padding:16px 24px; }
        .total-row { display:flex;justify-content:space-between;font-size:13px;margin-bottom:8px;color:#6b8b91; }
        .total-row.grand { font-size:15px;font-weight:700;color:#334d52;border-top:1px solid #ddeef1;padding-top:10px;margin-top:4px; }
        @media(max-width:768px) { .pay-wrap{grid-template-columns:1fr} .pay-summary{order:-1} }
      `}</style>
    </div>
  );
}
