import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '@/store/cart';
import { call, placeOrder } from '@/lib/backend';
import { useBackendMode } from '@/lib/frappe';

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
  shipping?: number;
  subtotal?: number;
  total?: number;
}

export default function PaymentPage() {
  const navigate = useNavigate();
  const { clearCart } = useCart();
  const mode = useBackendMode();
  const [checkoutData, setCheckoutData] = useState<CheckoutData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [payMethod, setPayMethod] = useState<'card' | 'cod'>('card');

  // Square (live backend only)
  const [squareReady, setSquareReady] = useState(false);
  const [squareConfig, setSquareConfig] = useState<{ app_id: string; location_id: string; environment: string } | null>(null);
  const [gatewayChecked, setGatewayChecked] = useState(false);
  const cardRef = useRef<any>(null);
  const cardContainerRef = useRef<HTMLDivElement>(null);
  const initRanRef = useRef(false);

  // Offline card form — used when no Square gateway is configured, so the
  // checkout is still demonstrable end to end without taking a real payment.
  const [testCard, setTestCard] = useState({ number: '', exp: '', cvc: '', name: '' });

  const squareLive = !!squareConfig;

  // Load the basket handed over by checkout
  useEffect(() => {
    try {
      const data = JSON.parse(sessionStorage.getItem('hs_checkout') || 'null');
      if (!data || !data.cart || data.cart.length === 0) { navigate('/cart'); return; }
      setCheckoutData(data);
    } catch { navigate('/cart'); }
  }, [navigate]);

  // Ask the backend whether a card gateway is configured.
  useEffect(() => {
    let alive = true;
    call('square_payment.api.get_config')
      .then(res => {
        if (!alive) return;
        const cfg = res?.message;
        if (cfg?.app_id && cfg?.location_id) setSquareConfig(cfg);
      })
      .catch(() => { /* no gateway — the offline card form takes over */ })
      .finally(() => { if (alive) setGatewayChecked(true); });
    return () => { alive = false; };
  }, []);

  // Mount the Square card element — guarded against StrictMode double-fire
  useEffect(() => {
    if (!squareConfig || !cardContainerRef.current || initRanRef.current) return;
    if (payMethod !== 'card') return;

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
    script.onerror = () => setError('Failed to load the Square payment SDK (network or CSP issue).');
    document.head.appendChild(script);
  }, [squareConfig, payMethod]);

  async function initSquare() {
    if (!squareConfig || !cardContainerRef.current) return;
    try {
      if (!window.Square) { setError('Square payment SDK failed to load. Please refresh the page.'); return; }
      const payments = await window.Square.payments(squareConfig.app_id, squareConfig.location_id);
      if (!payments) { setError('Could not initialize Square payments. Check the App ID and Location ID.'); return; }
      const card = await payments.card();
      await card.attach(cardContainerRef.current);
      cardRef.current = card;
      setSquareReady(true);
    } catch (e: any) {
      setError('Could not initialize the payment form: ' + (e?.message || e));
    }
  }

  /** Basic client-side sanity check for the offline card form. */
  function validateTestCard(): string {
    const digits = testCard.number.replace(/\D/g, '');
    if (!testCard.name.trim()) return 'Enter the name on the card';
    if (digits.length < 13 || digits.length > 19) return 'Enter a valid card number';
    if (!/^\d{2}\s*\/\s*\d{2,4}$/.test(testCard.exp)) return 'Enter the expiry as MM/YY';
    if (!/^\d{3,4}$/.test(testCard.cvc)) return 'Enter a valid CVC';
    return '';
  }

  async function handlePlaceOrder() {
    if (!checkoutData) return;
    setError('');

    const { cart, customer, couponCode, discount } = checkoutData;
    const subtotal = checkoutData.subtotal ?? cart.reduce((s, i) => s + i.price * i.qty, 0);
    const shipping = checkoutData.shipping ?? 0;
    const total = checkoutData.total ?? Math.max(0, subtotal - (discount || 0) + shipping);

    if (total <= 0) { setError('Order total must be greater than zero.'); return; }

    let sourceId: string | undefined;

    if (payMethod === 'card') {
      if (squareLive) {
        if (!cardRef.current) { setError('The card form is still loading. Please wait a moment.'); return; }
        setLoading(true);
        try {
          const result = await cardRef.current.tokenize();
          if (result.status !== 'OK') {
            throw new Error(result.errors?.map((e: any) => e.message).join(', ') || 'Card could not be verified');
          }
          sourceId = result.token;
        } catch (e: any) {
          setError(e.message || 'Card could not be verified.');
          setLoading(false);
          return;
        }
      } else {
        const invalid = validateTestCard();
        if (invalid) { setError(invalid); return; }
        sourceId = 'offline_' + testCard.number.replace(/\D/g, '').slice(-4);
        setLoading(true);
      }
    } else {
      setLoading(true);
    }

    try {
      const placed = await placeOrder({
        customer, cart, subtotal, discount: discount || 0, shipping, total,
        couponCode, paymentMethod: payMethod, sourceId,
      });

      clearCart();
      sessionStorage.removeItem('hs_checkout');
      sessionStorage.removeItem('hs_coupon');
      sessionStorage.removeItem('hs_buynow');
      sessionStorage.setItem('hs_order_success', JSON.stringify({
        orderId: placed.orderId,
        paymentId: placed.paymentId,
        customer,
        total,
        paymentMethod: payMethod === 'cod'
          ? 'Cash on Delivery'
          : squareLive ? 'Square (Card)' : 'Card',
        subtotal,
        shipping,
        discount: discount || 0,
      }));
      navigate('/order-success');
    } catch (e: any) {
      setError(e?.message || 'We could not place your order. Please try again.');
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

            {/* Payment method */}
            <div className="hp-section-label">Payment Method</div>
            <div className="hp-methods" role="radiogroup" aria-label="Payment method">
              <button
                type="button"
                role="radio"
                aria-checked={payMethod === 'card'}
                className={`hp-method${payMethod === 'card' ? ' on' : ''}`}
                onClick={() => { setPayMethod('card'); setError(''); }}
              >
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
                <span className="hp-method-name">Card</span>
                <span className="hp-method-sub">Visa · Mastercard · Amex</span>
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={payMethod === 'cod'}
                className={`hp-method${payMethod === 'cod' ? ' on' : ''}`}
                onClick={() => { setPayMethod('cod'); setError(''); }}
              >
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/></svg>
                <span className="hp-method-name">Cash on Delivery</span>
                <span className="hp-method-sub">Pay when it arrives</span>
              </button>
            </div>

            {payMethod === 'card' && squareLive && (
              <>
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
              </>
            )}

            {payMethod === 'card' && gatewayChecked && !squareLive && (
              <>
                <div className="hp-section-label">Card Details</div>
                <div className="hp-testnote" role="note">
                  <strong>Test mode.</strong> No live card gateway is connected, so this
                  card is not charged — the order is still placed and appears in your
                  account and in the admin panel. Use any well-formed card number.
                </div>
                <div className="hp-card-form">
                  <label className="hp-cf-field hp-cf-wide">
                    <span>Name on card</span>
                    <input
                      value={testCard.name}
                      onChange={e => setTestCard(c => ({ ...c, name: e.target.value }))}
                      placeholder="Priya Sharma"
                      autoComplete="cc-name"
                    />
                  </label>
                  <label className="hp-cf-field hp-cf-wide">
                    <span>Card number</span>
                    <input
                      value={testCard.number}
                      onChange={e => setTestCard(c => ({
                        ...c,
                        number: e.target.value.replace(/\D/g, '').slice(0, 19).replace(/(.{4})/g, '$1 ').trim(),
                      }))}
                      placeholder="4242 4242 4242 4242"
                      inputMode="numeric"
                      autoComplete="cc-number"
                    />
                  </label>
                  <label className="hp-cf-field">
                    <span>Expiry</span>
                    <input
                      value={testCard.exp}
                      onChange={e => {
                        const d = e.target.value.replace(/\D/g, '').slice(0, 4);
                        setTestCard(c => ({ ...c, exp: d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d }));
                      }}
                      placeholder="MM/YY"
                      inputMode="numeric"
                      autoComplete="cc-exp"
                    />
                  </label>
                  <label className="hp-cf-field">
                    <span>CVC</span>
                    <input
                      value={testCard.cvc}
                      onChange={e => setTestCard(c => ({ ...c, cvc: e.target.value.replace(/\D/g, '').slice(0, 4) }))}
                      placeholder="123"
                      inputMode="numeric"
                      autoComplete="cc-csc"
                    />
                  </label>
                </div>
              </>
            )}

            {payMethod === 'card' && !gatewayChecked && (
              <div className="hp-loading"><div className="hp-spin-sm" /><span>Checking payment options…</span></div>
            )}

            {payMethod === 'cod' && (
              <div className="hp-cod">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M20 6H4a2 2 0 00-2 2v8a2 2 0 002 2h16a2 2 0 002-2V8a2 2 0 00-2-2z"/><circle cx="12" cy="12" r="2.5"/></svg>
                <div>
                  <strong>Pay in cash when your order arrives.</strong>
                  <p>Keep ${total.toFixed(2)} ready for the delivery partner. You can inspect the parcel before paying.</p>
                </div>
              </div>
            )}

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
              disabled={loading || (payMethod === 'card' && (!gatewayChecked || (squareLive && !squareReady)))}
            >
              {loading ? (
                <><span className="hp-spin" />{payMethod === 'cod' ? 'Placing Order…' : 'Processing Payment…'}</>
              ) : payMethod === 'cod' ? (
                <>Place Order · ${total.toFixed(2)} <span aria-hidden="true">→</span></>
              ) : (
                <>Pay ${total.toFixed(2)} <span aria-hidden="true">→</span></>
              )}
            </button>

            <p className="hp-secure">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="13" height="13"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
              {payMethod === 'cod'
                ? 'No payment is taken now. You pay the delivery partner in cash.'
                : squareLive
                  ? 'Secured by Square. Card details are never stored on our servers.'
                  : 'Test mode — no card is charged and no card details are stored.'}
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
  /* Payment method picker */
  .hp-methods { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:22px; }
  .hp-method {
    display:flex; flex-direction:column; align-items:flex-start; gap:2px;
    padding:14px 14px 12px; border:1.5px solid #e3eef0; border-radius:10px;
    background:#fff; cursor:pointer; text-align:left; color:#5b7a80;
    transition:border-color .18s, background .18s, color .18s;
  }
  .hp-method:hover { border-color:#b9d9de; }
  .hp-method.on { border-color:#005969; background:#f2fafb; color:#005969; }
  .hp-method svg { margin-bottom:6px; }
  .hp-method-name { font-size:13.5px; font-weight:600; color:#25454a; letter-spacing:.01em; }
  .hp-method.on .hp-method-name { color:#005969; }
  .hp-method-sub { font-size:11px; color:#8aa5aa; }

  /* Offline card form */
  .hp-card-form { display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:18px; }
  .hp-cf-wide { grid-column:1 / -1; }
  .hp-cf-field { display:flex; flex-direction:column; gap:6px; }
  .hp-cf-field span { font-size:11px; font-weight:600; letter-spacing:.08em; text-transform:uppercase; color:#8aa5aa; }
  .hp-cf-field input {
    padding:12px 13px; border:1.5px solid #e3eef0; border-radius:8px;
    font-size:14px; font-family:inherit; color:#25454a; background:#fff; outline:none;
    transition:border-color .18s;
  }
  .hp-cf-field input:focus { border-color:#005969; }
  .hp-cf-field input::placeholder { color:#b9cbcf; }

  .hp-testnote {
    display:block; padding:11px 13px; margin-bottom:14px;
    background:#fff8ee; border:1px solid #f0e0c4; border-radius:8px;
    font-size:12px; line-height:1.55; color:#8a6d3b;
  }
  .hp-testnote strong { color:#6b5228; }

  /* Cash on delivery panel */
  .hp-cod {
    display:flex; gap:12px; align-items:flex-start;
    padding:16px; margin-bottom:20px;
    background:#f2fafb; border:1.5px solid #cfe6ea; border-radius:10px; color:#005969;
  }
  .hp-cod strong { display:block; font-size:13.5px; margin-bottom:4px; color:#25454a; }
  .hp-cod p { font-size:12.5px; line-height:1.55; color:#5b7a80; margin:0; }

  @media (max-width: 560px) {
    .hp-methods { grid-template-columns:1fr; }
    .hp-card-form { grid-template-columns:1fr 1fr; }
  }

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
