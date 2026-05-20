import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '@/store/cart';

declare global {
  interface Window {
    Square?: any;
  }
}

interface CheckoutData {
  customer: Record<string, string>;
  cart: Array<{ id: string; name: string; image: string; price: number; qty: number; category?: string; item_name?: string; price_usd?: number }>;
  couponCode?: string;
  discount?: number;
}

export default function PaymentPage() {
  const navigate = useNavigate();
  const { clearCart } = useCart();
  const [checkoutData, setCheckoutData] = useState<CheckoutData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [squareReady, setSquareReady] = useState(false);
  const [squareConfig, setSquareConfig] = useState<{ app_id: string; location_id: string; environment: string } | null>(null);
  const cardRef = useRef<any>(null);
  const cardContainerRef = useRef<HTMLDivElement>(null);

  // Load checkout data from sessionStorage
  useEffect(() => {
    try {
      const data = JSON.parse(sessionStorage.getItem('hs_checkout') || 'null');
      if (!data || !data.cart || data.cart.length === 0) { navigate('/cart'); return; }
      setCheckoutData(data);
    } catch { navigate('/cart'); }
  }, []);

  // Fetch Square config from backend
  useEffect(() => {
    fetch('/api/method/hira_payment.api.get_square_config', {
      headers: { 'Content-Type': 'application/json', 'X-Frappe-CSRF-Token': 'fetch' },
    })
      .then(r => r.json())
      .then(res => {
        if (res.message) setSquareConfig(res.message);
      })
      .catch(() => setError('Could not load payment config. Please refresh.'));
  }, []);

  // Load Square SDK and initialize card form
  useEffect(() => {
    if (!squareConfig) return;

    const scriptId = 'square-web-sdk';
    if (document.getElementById(scriptId)) {
      initSquare();
      return;
    }

    const src = squareConfig.environment === 'production'
      ? 'https://web.squarecdn.com/v1/square.js'
      : 'https://sandbox.web.squarecdn.com/v1/square.js';

    const script = document.createElement('script');
    script.id = scriptId;
    script.src = src;
    script.onload = initSquare;
    script.onerror = () => setError('Failed to load Square payment SDK.');
    document.head.appendChild(script);
  }, [squareConfig]);

  async function initSquare() {
    if (!squareConfig || !cardContainerRef.current) return;
    try {
      const payments = window.Square?.payments(squareConfig.app_id, squareConfig.location_id);
      const card = await payments.card();
      await card.attach(cardContainerRef.current);
      cardRef.current = card;
      setSquareReady(true);
    } catch (e: any) {
      setError('Could not initialize payment form: ' + (e?.message || e));
    }
  }

  async function handlePlaceOrder() {
    if (!checkoutData || !cardRef.current) return;
    setLoading(true);
    setError('');

    try {
      // 1. Tokenize card via Square SDK
      const result = await cardRef.current.tokenize();
      if (result.status !== 'OK') {
        const msgs = result.errors?.map((e: any) => e.message).join(', ') || 'Card tokenization failed';
        throw new Error(msgs);
      }
      const sourceId = result.token;

      // 2. Calculate amount in cents
      const { cart, customer, couponCode, discount } = checkoutData;
      const subtotal = cart.reduce((s, i) => s + i.price * i.qty, 0);
      const total = subtotal - (discount || 0);
      const amountCents = Math.round(total * 100);

      // 3. Call Frappe backend to charge & create order
      const csrfToken = document.cookie.match(/csrftoken=([^;]+)/)?.[1] || '';
      const resp = await fetch('/api/method/hira_payment.api.process_payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Frappe-CSRF-Token': csrfToken || 'fetch',
        },
        body: JSON.stringify({
          source_id: sourceId,
          amount_cents: amountCents,
          customer: JSON.stringify(customer),
          cart_items: JSON.stringify(cart),
          coupon_code: couponCode || '',
          discount: discount || 0,
        }),
      });

      const data = await resp.json();
      if (!resp.ok || data.exc) {
        const msg = data.exc_type === 'ValidationError'
          ? data._server_messages ? JSON.parse(JSON.parse(data._server_messages)[0]).message : 'Payment failed'
          : data.message || 'Payment failed. Please try again.';
        throw new Error(msg);
      }

      const { order_id, payment_id } = data.message;

      clearCart();
      sessionStorage.removeItem('hs_checkout');
      sessionStorage.removeItem('hs_coupon');
      sessionStorage.setItem('hs_order_success', JSON.stringify({
        orderId: order_id,
        paymentId: payment_id,
        customer,
        total,
      }));
      navigate('/order-success');

    } catch (e: any) {
      setError(e.message || 'Payment failed. Please try again.');
    }
    setLoading(false);
  }

  if (!checkoutData) return <div style={{ textAlign: 'center', padding: '80px' }}>Loading…</div>;

  const subtotal = checkoutData.cart.reduce((s, i) => s + i.price * i.qty, 0);
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
          <div className="card">
            <div className="card-head">
              <h2>Payment Details</h2>
              <p>Shipping to {checkoutData.customer.city}, {checkoutData.customer.state}</p>
            </div>
            <div className="card-body">

              {/* Delivery address */}
              <div className="address-box">
                <div className="address-label">Deliver to</div>
                <div className="address-name">{checkoutData.customer.fullName}</div>
                <div className="address-line">{checkoutData.customer.address}</div>
                <div className="address-line">{checkoutData.customer.city}, {checkoutData.customer.state} {checkoutData.customer.zip}</div>
                <div className="address-line">{checkoutData.customer.phone}</div>
              </div>

              {/* Square Card Form */}
              <div className="pm-label">Card Details</div>
              <div className="square-card-wrap">
                <div ref={cardContainerRef} id="square-card-container" />
                {!squareReady && !error && (
                  <div className="card-loading">
                    <div className="spinner" />
                    <span>Loading secure payment form…</span>
                  </div>
                )}
              </div>

              <div className="order-total-display">
                <span>Order Total</span>
                <span className="total-amount">${total.toFixed(2)}</span>
              </div>

              {error && <div className="form-error">{error}</div>}

              <button
                className="btn-place-order"
                onClick={handlePlaceOrder}
                disabled={loading || !squareReady}
              >
                {loading ? 'Processing Payment…' : `Pay $${total.toFixed(2)} →`}
              </button>

              <p className="security-note">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
                Secured by Square — your card details are never stored
              </p>
            </div>
          </div>

          <Link to="/checkout" className="back-link">← Back to Shipping</Link>
        </div>

        {/* Order Summary */}
        <div className="pay-summary">
          <div className="card">
            <div className="card-head"><h2>Order Summary</h2></div>
            <div className="summary-items">
              {checkoutData.cart.map(item => (
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
              {(checkoutData.discount || 0) > 0 && (
                <div className="total-row" style={{ color: '#16a34a' }}>
                  <span>Discount</span><span>−${checkoutData.discount!.toFixed(2)}</span>
                </div>
              )}
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
        .pm-label { font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:#6b8b91;margin-bottom:12px; }
        .square-card-wrap { border:1.5px solid #c8e0e4;border-radius:8px;padding:16px;min-height:90px;margin-bottom:20px;background:#fff;position:relative; }
        .card-loading { display:flex;align-items:center;gap:10px;color:#6b8b91;font-size:13px;padding:8px 0; }
        .spinner { width:18px;height:18px;border:2px solid #c8e0e4;border-top-color:#005969;border-radius:50%;animation:spin .7s linear infinite;flex-shrink:0; }
        @keyframes spin { to { transform:rotate(360deg); } }
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
