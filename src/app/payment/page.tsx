import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '@/store/cart';

declare global {
  interface Window {
    Square?: any;
  }
}

// Pulls a human-readable message out of a Frappe error response shape.
function extractFrappeError(data: any): string {
  try {
    if (data?._server_messages) {
      const parsed = JSON.parse(data._server_messages);
      const first = parsed[0];
      let msg: string;
      try { msg = JSON.parse(first).message || first; } catch { msg = first; }
      return msg.replace(/<[^>]+>/g, '').trim();
    }
    if (data?.exception) {
      const m = data.exception.split(':').slice(1).join(':').trim();
      if (m) return m;
    }
    if (data?.message && typeof data.message === 'string') return data.message;
  } catch { /* fall through */ }
  return '';
}

interface CheckoutData {
  customer: Record<string, string>;
  cart: Array<{ id: string; name: string; image: string; price: number; qty: number; category?: string; item_name?: string; price_usd?: number }>;
  couponCode?: string;
  discount?: number;
  shipping?: number;
  subtotal?: number;
  total?: number;
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
  const initRanRef = useRef(false);

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
    const csrf = document.cookie.match(/csrftoken=([^;]+)/)?.[1] || 'fetch';
    fetch('/api/method/square_payment.api.get_config', {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'X-Frappe-CSRF-Token': csrf },
    })
      .then(async r => {
        const body = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(extractFrappeError(body) || `Payment config error (${r.status})`);
        return body;
      })
      .then(res => {
        if (!res?.message || !res.message.app_id || !res.message.location_id) {
          setError('Square is not configured on the server. Please contact support.');
          return;
        }
        setSquareConfig(res.message);
      })
      .catch(err => setError('Could not load payment config: ' + (err?.message || err)));
  }, []);

  // Load Square SDK and initialize card form — guarded against StrictMode double-fire
  useEffect(() => {
    if (!squareConfig || !cardContainerRef.current || initRanRef.current) return;

    const src = squareConfig.environment === 'production'
      ? 'https://web.squarecdn.com/v1/square.js'
      : 'https://sandbox.web.squarecdn.com/v1/square.js';

    const scriptId = 'square-web-sdk-' + (squareConfig.environment === 'production' ? 'prod' : 'sandbox');
    const existing = document.getElementById(scriptId) as HTMLScriptElement | null;

    const start = () => { initRanRef.current = true; void initSquare(); };

    if (window.Square) { start(); return; }
    if (existing) { existing.addEventListener('load', start, { once: true }); return; }

    const script = document.createElement('script');
    script.id = scriptId;
    script.src = src;
    script.async = true;
    script.onload = start;
    script.onerror = () => setError('Failed to load Square payment SDK (network/CSP issue).');
    document.head.appendChild(script);
  }, [squareConfig]);

  async function initSquare() {
    if (!squareConfig || !cardContainerRef.current) return;
    try {
      if (!window.Square) {
        setError('Square payment SDK failed to load. Please refresh the page.');
        return;
      }
      const payments = await window.Square.payments(squareConfig.app_id, squareConfig.location_id);
      if (!payments) {
        setError('Could not initialize Square payments. Check your App ID and Location ID.');
        return;
      }
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

      // 2. Use the totals computed at checkout (single source of truth)
      const { cart, customer, couponCode, discount } = checkoutData;
      const subtotal = checkoutData.subtotal ?? cart.reduce((s, i) => s + i.price * i.qty, 0);
      const shipping = checkoutData.shipping ?? 0;
      const total = checkoutData.total ?? Math.max(0, subtotal - (discount || 0) + shipping);
      const amountCents = Math.round(total * 100);
      if (amountCents <= 0) throw new Error('Order total must be greater than zero.');

      // 3. Call Frappe backend to charge & create order
      const csrfToken = document.cookie.match(/csrftoken=([^;]+)/)?.[1] || 'fetch';
      const resp = await fetch('/api/method/square_payment.api.process_payment', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-Frappe-CSRF-Token': csrfToken,
        },
        body: JSON.stringify({
          source_id: sourceId,
          amount_cents: amountCents,
          customer: JSON.stringify(customer),
          cart_items: JSON.stringify(cart),
          coupon_code: couponCode || '',
          discount: discount || 0,
          shipping,
        }),
      });

      const data = await resp.json().catch(() => ({}));
      if (!resp.ok || data.exc || !data.message) {
        throw new Error(extractFrappeError(data) || `Payment failed (HTTP ${resp.status}). Please try again.`);
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
        paymentMethod: 'Square (Card)',
        subtotal,
        shipping,
        discount: discount || 0,
      }));
      navigate('/order-success');

    } catch (e: any) {
      setError(e.message || 'Payment failed. Please try again.');
    }
    setLoading(false);
  }

  if (!checkoutData) return <div style={{ textAlign: 'center', padding: '80px' }}>Loading…</div>;

  const subtotal = checkoutData.subtotal ?? checkoutData.cart.reduce((s, i) => s + i.price * i.qty, 0);
  const shipping = checkoutData.shipping ?? 0;
  const total = checkoutData.total ?? Math.max(0, subtotal - (checkoutData.discount || 0) + shipping);
  const itemCount = checkoutData.cart.reduce((s, i) => s + i.qty, 0);

  return (
    <div className="hira-pay">
      {/* Top bar — logo + steps */}
      <header className="hp-top">
        <Link to="/" className="hp-brand" aria-label="The Hira Store">
          <img src={`${import.meta.env.BASE_URL}site-images/hira-logo.png`} alt="" />
        </Link>
        <div className="hp-steps" aria-label="Checkout progress">
          <div className="hp-step done"><span className="hp-num"><svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg></span><span className="hp-label">Shipping</span></div>
          <span className="hp-div" />
          <div className="hp-step active"><span className="hp-num">2</span><span className="hp-label">Payment</span></div>
          <span className="hp-div" />
          <div className="hp-step"><span className="hp-num">3</span><span className="hp-label">Confirm</span></div>
        </div>
        <Link to="/checkout" className="hp-back" aria-label="Back to shipping">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
          </svg>
          <span>Back</span>
        </Link>
      </header>

      {/* Two-column body */}
      <div className="hp-body">
        {/* LEFT — payment form */}
        <section className="hp-form" aria-labelledby="hp-pay-title">
          <div className="hp-form-head">
            <p className="hp-eyebrow">Step 2 of 3</p>
            <h1 id="hp-pay-title">Payment Details</h1>
          </div>

          <div className="hp-form-body">
            {/* Delivery address chip */}
            <div className="hp-deliver">
              <div className="hp-deliver-head">
                <span className="hp-deliver-label">Delivering to</span>
                <Link to="/checkout" className="hp-deliver-edit">Edit</Link>
              </div>
              <div className="hp-deliver-name">{checkoutData.customer.fullName}</div>
              <div className="hp-deliver-line">
                {checkoutData.customer.address}, {checkoutData.customer.city}, {checkoutData.customer.state} {checkoutData.customer.zip} · {checkoutData.customer.phone}
              </div>
            </div>

            {/* Square card form */}
            <div className="hp-section-label">Card Details</div>
            <div className="hp-square">
              <div ref={cardContainerRef} id="square-card-container" />
              {!squareReady && !error && (
                <div className="hp-loading">
                  <div className="hp-spin-sm" />
                  <span>Loading secure payment form…</span>
                </div>
              )}
            </div>

            {error && (
              <div className="hp-error" role="alert">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                <span>{error}</span>
              </div>
            )}

            <button
              type="button"
              className="hp-pay-btn"
              onClick={handlePlaceOrder}
              disabled={loading || !squareReady}
            >
              {loading ? (
                <><span className="hp-spin" />Processing Payment…</>
              ) : (
                <>Pay ${total.toFixed(2)} <span aria-hidden="true">→</span></>
              )}
            </button>

            <p className="hp-secure">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="13" height="13"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
              Secured by Square. Card details are never stored on our servers.
            </p>
          </div>
        </section>

        {/* RIGHT — order summary */}
        <aside className="hp-summary" aria-label="Order summary">
          <div className="hp-summary-head">
            <h2>Order Summary</h2>
            <span className="hp-count">{itemCount} item{itemCount !== 1 ? 's' : ''}</span>
          </div>

          <div className="hp-items">
            {checkoutData.cart.map(item => (
              <div key={item.id} className="hp-item">
                <div className="hp-item-img">
                  <img src={item.image} alt={item.name} />
                  <span className="hp-item-qty">{item.qty}</span>
                </div>
                <div className="hp-item-name" title={item.name}>{item.name}</div>
                <div className="hp-item-price">${(item.price * item.qty).toFixed(2)}</div>
              </div>
            ))}
          </div>

          <div className="hp-totals">
            <div className="hp-row"><span>Subtotal</span><span>${subtotal.toFixed(2)}</span></div>
            <div className="hp-row"><span>Shipping</span><span className={shipping === 0 ? 'free' : ''}>{shipping > 0 ? `$${shipping.toFixed(2)}` : 'Free'}</span></div>
            {(checkoutData.discount || 0) > 0 && (
              <div className="hp-row discount"><span>Discount</span><span>−${checkoutData.discount!.toFixed(2)}</span></div>
            )}
            <div className="hp-row grand"><span>Total</span><span>${total.toFixed(2)}</span></div>
          </div>
        </aside>
      </div>

      <style>{styles}</style>
    </div>
  );
}

const styles = `
  /* Cover navbar + footer; own exactly one viewport */
  .hira-pay {
    position: fixed; inset: 0; z-index: 9000;
    display: grid; grid-template-rows: 64px 1fr;
    background: #fdfbf6;
    font-family: 'DM Sans', system-ui, sans-serif;
    color: #1a1a1a;
    overflow: hidden;
  }

  /* TOP BAR */
  .hp-top {
    display: grid; grid-template-columns: 1fr auto 1fr; align-items: center;
    padding: 0 28px;
    background: #fff;
    border-bottom: 1px solid #eee5d3;
  }
  .hp-brand { justify-self: start; display: inline-flex; align-items: center; }
  .hp-brand img { height: 36px; filter: contrast(1.2); }
  .hp-back {
    justify-self: end;
    display: inline-flex; align-items: center; gap: 6px;
    font-size: 12px; font-weight: 500; color: #6b8b91;
    text-decoration: none; letter-spacing: 0.04em;
    padding: 6px 12px; border-radius: 6px; transition: color .15s, background .15s;
  }
  .hp-back:hover { color: #005969; background: rgba(0,89,105,0.05); }

  .hp-steps {
    display: inline-flex; align-items: center; gap: 0;
  }
  .hp-step {
    display: inline-flex; align-items: center; gap: 8px;
    font-size: 12px; color: #a8a298; padding: 0 14px;
    letter-spacing: 0.04em;
  }
  .hp-step .hp-num {
    width: 22px; height: 22px; border-radius: 50%;
    border: 1.5px solid currentColor;
    display: inline-flex; align-items: center; justify-content: center;
    font-size: 10px; font-weight: 700;
  }
  .hp-step.done { color: #c8a97e; }
  .hp-step.done .hp-num { background: #c8a97e; color: #fff; border-color: #c8a97e; }
  .hp-step.active { color: #005969; font-weight: 600; }
  .hp-step.active .hp-num { background: #005969; color: #fff; border-color: #005969; }
  .hp-div { width: 28px; height: 1px; background: #e2dccd; }

  /* BODY */
  .hp-body {
    display: grid; grid-template-columns: 1fr 380px;
    overflow: hidden;
  }

  /* LEFT — form */
  .hp-form {
    overflow-y: auto;
    padding: 20px clamp(20px, 5vw, 56px) 18px;
    background: #fdfbf6;
  }
  .hp-form-head { margin-bottom: 14px; }
  .hp-eyebrow {
    font-size: 10px; letter-spacing: 0.28em; text-transform: uppercase;
    color: #c8a97e; font-weight: 600; margin-bottom: 4px;
  }
  .hp-form-head h1 {
    font-family: 'Playfair Display', serif; font-weight: 400;
    font-size: clamp(1.5rem, 2vw, 1.9rem); color: #005969; line-height: 1.1;
  }
  .hp-form-body { max-width: 540px; }

  .hp-deliver {
    background: #fff; border: 1px solid #eee5d3; border-radius: 10px;
    padding: 12px 14px; margin-bottom: 14px;
  }
  .hp-deliver-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
  .hp-deliver-label {
    font-size: 10px; font-weight: 600; letter-spacing: 0.12em;
    text-transform: uppercase; color: #6b8b91;
  }
  .hp-deliver-edit {
    font-size: 12px; color: #c8a97e; font-weight: 600;
    text-decoration: none; border-bottom: 1px solid transparent;
    transition: border-color .15s;
  }
  .hp-deliver-edit:hover { border-bottom-color: #c8a97e; }
  .hp-deliver-name { font-size: 14px; font-weight: 600; color: #1a1a1a; margin-bottom: 2px; }
  .hp-deliver-line { font-size: 12.5px; color: #6b8b91; line-height: 1.5; }

  .hp-section-label {
    font-size: 11px; font-weight: 600; letter-spacing: 0.12em;
    text-transform: uppercase; color: #6b8b91;
    margin-bottom: 8px;
  }
  .hp-square {
    border: 1.5px solid #e2dccd; border-radius: 10px;
    padding: 14px 16px; background: #fff;
    min-height: 88px; position: relative;
    transition: border-color .2s, box-shadow .2s;
    margin-bottom: 16px;
  }
  .hp-square:focus-within {
    border-color: #c8a97e;
    box-shadow: 0 0 0 3px rgba(200,169,126,0.18);
  }
  .hp-loading {
    display: flex; align-items: center; gap: 10px;
    color: #6b8b91; font-size: 13px;
  }
  .hp-spin-sm, .hp-spin {
    width: 16px; height: 16px;
    border: 2px solid #e2dccd; border-top-color: #005969;
    border-radius: 50%; animation: spin .7s linear infinite; flex-shrink: 0;
  }
  .hp-spin { border-color: rgba(255,255,255,0.35); border-top-color: #fff; }
  @keyframes spin { to { transform: rotate(360deg); } }

  .hp-error {
    display: flex; align-items: center; gap: 8px;
    background: #fff5f5; border: 1px solid #fecaca; color: #b91c1c;
    padding: 10px 12px; border-radius: 8px; font-size: 12.5px;
    margin-bottom: 14px;
  }

  .hp-pay-btn {
    width: 100%; padding: 14px 22px;
    background: #005969; color: #fff;
    border: 0; border-radius: 10px;
    font-family: inherit; font-size: 14px; font-weight: 700;
    letter-spacing: 0.1em; text-transform: uppercase;
    cursor: pointer; transition: background .2s, transform .1s;
    display: inline-flex; align-items: center; justify-content: center; gap: 10px;
  }
  .hp-pay-btn:hover:not(:disabled) { background: #003d4a; }
  .hp-pay-btn:active:not(:disabled) { transform: translateY(1px); }
  .hp-pay-btn:disabled { opacity: .55; cursor: not-allowed; }

  .hp-secure {
    margin-top: 12px;
    display: flex; align-items: center; justify-content: center; gap: 6px;
    font-size: 11.5px; color: #6b8b91;
  }

  /* RIGHT — summary */
  .hp-summary {
    background: #fff;
    border-left: 1px solid #eee5d3;
    padding: 28px 28px 24px;
    display: flex; flex-direction: column;
    overflow: hidden;
  }
  .hp-summary-head {
    display: flex; justify-content: space-between; align-items: baseline;
    margin-bottom: 16px;
    padding-bottom: 14px; border-bottom: 1px solid #eee5d3;
  }
  .hp-summary-head h2 {
    font-family: 'Playfair Display', serif; font-weight: 400;
    font-size: 1.25rem; color: #005969;
  }
  .hp-count { font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase; color: #6b8b91; font-weight: 600; }

  .hp-items {
    flex: 1; overflow-y: auto;
    display: flex; flex-direction: column; gap: 12px;
    padding-right: 4px;
  }
  .hp-items::-webkit-scrollbar { width: 6px; }
  .hp-items::-webkit-scrollbar-thumb { background: #e2dccd; border-radius: 99px; }
  .hp-item {
    display: grid; grid-template-columns: 44px 1fr auto; gap: 10px; align-items: center;
  }
  .hp-item-img {
    position: relative; width: 44px; height: 44px;
    border-radius: 8px; overflow: hidden; background: #faf6ec;
  }
  .hp-item-img img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .hp-item-qty {
    position: absolute; top: -4px; right: -4px;
    width: 18px; height: 18px; border-radius: 50%;
    background: #005969; color: #fff;
    font-size: 10px; font-weight: 700;
    display: flex; align-items: center; justify-content: center;
    border: 2px solid #fff;
  }
  .hp-item-name {
    font-size: 13px; font-weight: 500; color: #1a1a1a; line-height: 1.3;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .hp-item-price { font-size: 13px; font-weight: 600; color: #1a1a1a; }

  .hp-totals {
    margin-top: 16px; padding-top: 16px;
    border-top: 1px solid #eee5d3;
    display: flex; flex-direction: column; gap: 8px;
  }
  .hp-row {
    display: flex; justify-content: space-between;
    font-size: 13px; color: #6b8b91;
  }
  .hp-row .free { color: #16a34a; font-weight: 600; }
  .hp-row.discount { color: #16a34a; }
  .hp-row.grand {
    margin-top: 6px; padding-top: 12px;
    border-top: 1px solid #eee5d3;
    font-size: 16px; font-weight: 700; color: #005969;
    font-family: 'Playfair Display', serif;
  }
  .hp-row.grand span:last-child { font-size: 20px; }

  /* Tablet — stack summary above form */
  @media (max-width: 900px) {
    .hira-pay { grid-template-rows: 56px 1fr; }
    .hp-top { padding: 0 18px; }
    .hp-brand img { height: 28px; }
    .hp-step .hp-label { display: none; }
    .hp-div { width: 18px; }
    .hp-body { grid-template-columns: 1fr; grid-template-rows: auto 1fr; }
    .hp-summary {
      order: -1;
      border-left: 0; border-bottom: 1px solid #eee5d3;
      padding: 16px 18px;
    }
    .hp-summary-head { margin-bottom: 10px; padding-bottom: 10px; }
    .hp-items { max-height: 110px; }
    .hp-form { padding: 18px 18px 24px; }
    .hp-form-head { margin-bottom: 14px; }
    .hp-deliver { padding: 12px 14px; margin-bottom: 14px; }
  }

  @media (max-width: 480px) {
    .hp-back span { display: none; }
  }
`;
