import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

interface OrderData {
  orderId: string;
  paymentId?: string;
  customer: { fullName: string; email: string; address: string; city: string; state: string; zip: string };
  total: number;
  paymentMethod?: string;
  /** Square's own hosted receipt. Absent in demo mode. */
  receiptUrl?: string;
  subtotal?: number;
  shipping?: number;
  discount?: number;
}

const HIRA_LOGO = `${import.meta.env.BASE_URL}site-images/hira-logo.png`;

export default function OrderSuccessPage() {
  const [order, setOrder] = useState<OrderData | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    try {
      const data = JSON.parse(sessionStorage.getItem('hs_order_success') || 'null');
      if (!data) { navigate('/'); return; }
      setOrder(data);
    } catch {
      navigate('/');
    }
  }, []);

  // Pre-compute sparkle bursts (8 rays + 12 dots)
  const rays = useMemo(() => Array.from({ length: 12 }, (_, i) => i), []);
  const confetti = useMemo(() => Array.from({ length: 22 }, (_, i) => ({
    i,
    // Deterministic pseudo-random so layout is stable
    left: ((i * 53 + 7) % 100),
    delay: ((i * 37) % 100) / 100,
    duration: 3.2 + ((i * 17) % 100) / 100 * 2.6,
    color: i % 3 === 0 ? '#c8a97e' : i % 3 === 1 ? '#005969' : '#e8c89a',
    size: 6 + (i % 4) * 2,
    rot: (i * 47) % 360,
  })), []);

  if (!order) return <div style={{ textAlign: 'center', padding: '80px' }}>Loading…</div>;

  const deliveryLine = [order.customer.address, order.customer.city, order.customer.state, order.customer.zip]
    .filter(Boolean).join(', ');

  return (
    <div className="hira-success">
      {/* Confetti — gentle background, no interaction */}
      <div className="hs-confetti" aria-hidden="true">
        {confetti.map(c => (
          <span
            key={c.i}
            className="hs-confetto"
            style={{
              left: `${c.left}%`,
              width: `${c.size}px`,
              height: `${c.size * 1.4}px`,
              background: c.color,
              animationDelay: `${c.delay}s`,
              animationDuration: `${c.duration}s`,
              transform: `rotate(${c.rot}deg)`,
            }}
          />
        ))}
      </div>

      {/* Subtle radial glow behind everything */}
      <div className="hs-glow" aria-hidden="true" />

      <main className="hs-card">
        {/* Header brand */}
        <img className="hs-logo" src={HIRA_LOGO} alt="The Hira Store" />

        {/* Check + sparkle burst */}
        <div className="hs-check-wrap">
          {/* Rotating halo */}
          <div className="hs-halo" aria-hidden="true" />

          {/* Sparkle rays bursting outward */}
          <div className="hs-rays" aria-hidden="true">
            {rays.map(i => (
              <span
                key={i}
                className="hs-ray"
                style={{ transform: `rotate(${i * 30}deg)`, animationDelay: `${0.4 + i * 0.03}s` }}
              />
            ))}
          </div>

          {/* Check circle */}
          <div className="hs-circle">
            <svg viewBox="0 0 52 52">
              <circle className="hs-circle-ring" cx="26" cy="26" r="24" fill="none" stroke="#005969" strokeWidth="2.5" />
              <path className="hs-check" d="M14 27 l8 8 l16 -18" fill="none" stroke="#005969" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </div>

        {/* Title block */}
        <p className="hs-eyebrow">Thank you</p>
        <h1 className="hs-title">Order Confirmed!</h1>
        <p className="hs-sub">
          Your handcrafted Hira piece is being prepared with care, <span className="hs-name">{order.customer.fullName.split(' ')[0] || 'beautiful'}</span>.
        </p>

        {/* Order strip */}
        <div className="hs-order">
          <div className="hs-order-id">
            <span className="hs-order-label">Order</span>
            <span className="hs-order-num">{order.orderId}</span>
          </div>
          <div className="hs-order-meta">
            <div className="hs-meta-row"><span>Delivery</span><span title={deliveryLine || '—'}>{deliveryLine || '—'}</span></div>
            <div className="hs-meta-row"><span>Payment</span><span>{order.paymentMethod || 'Card'}</span></div>
            <div className="hs-meta-row total">
              <span>Total Paid</span>
              <span className="hs-total">${order.total.toFixed(2)}</span>
            </div>
            {order.receiptUrl && (
              <div className="hs-meta-row">
                <span>Receipt</span>
                <a href={order.receiptUrl} target="_blank" rel="noopener noreferrer">View card receipt</a>
              </div>
            )}
          </div>
        </div>

        {/* Next steps — three tiny chips */}
        <div className="hs-next">
          <div className="hs-chip">
            <span className="hs-chip-ico" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 4h16v16H4z"/><path d="M4 4l8 8 8-8"/></svg>
            </span>
            <span>Email receipt sent</span>
          </div>
          <div className="hs-chip">
            <span className="hs-chip-ico" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="2" y="6" width="20" height="14" rx="2"/><path d="M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"/></svg>
            </span>
            <span>Ships in 2–3 days</span>
          </div>
          <div className="hs-chip">
            <span className="hs-chip-ico" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            </span>
            <span>Track from account</span>
          </div>
        </div>

        {/* Actions */}
        <div className="hs-actions">
          <Link to="/account" className="hs-btn-primary">View My Orders</Link>
          <Link to="/shop" className="hs-btn-ghost">Continue Shopping →</Link>
        </div>
      </main>

      <style>{styles}</style>
    </div>
  );
}

const styles = `
  /* Full viewport overlay — no scroll */
  .hira-success {
    position: fixed; inset: 0; z-index: 9000;
    background:
      radial-gradient(ellipse at 50% 0%, rgba(200,169,126,0.15) 0%, transparent 55%),
      linear-gradient(180deg, #fdfbf6 0%, #faf6ec 100%);
    font-family: 'DM Sans', system-ui, sans-serif;
    color: #1a1a1a;
    display: flex; align-items: center; justify-content: center;
    padding: 24px;
    overflow: hidden;
  }

  /* Radial glow behind card */
  .hs-glow {
    position: absolute; left: 50%; top: 38%;
    width: 700px; height: 700px;
    transform: translate(-50%, -50%);
    background: radial-gradient(circle, rgba(0,89,105,0.06) 0%, transparent 60%);
    pointer-events: none;
    animation: hs-glow-pulse 4s ease-in-out infinite;
  }
  @keyframes hs-glow-pulse {
    0%, 100% { opacity: 0.7; transform: translate(-50%, -50%) scale(1); }
    50% { opacity: 1; transform: translate(-50%, -50%) scale(1.05); }
  }

  /* Confetti rain — falls slowly past the card */
  .hs-confetti {
    position: absolute; inset: 0; overflow: hidden;
    pointer-events: none;
  }
  .hs-confetto {
    position: absolute; top: -30px;
    border-radius: 2px;
    opacity: 0;
    animation: hs-fall linear forwards;
  }
  @keyframes hs-fall {
    0%   { transform: translateY(-30px) rotate(0deg); opacity: 0; }
    8%   { opacity: 0.9; }
    100% { transform: translateY(110vh) rotate(720deg); opacity: 0.4; }
  }

  /* CARD */
  .hs-card {
    position: relative; z-index: 2;
    width: 100%; max-width: 520px;
    background: #fff;
    border: 1px solid #eee5d3;
    border-radius: 18px;
    padding: 20px 32px 22px;
    text-align: center;
    box-shadow:
      0 1px 0 rgba(255,255,255,0.6) inset,
      0 24px 60px -20px rgba(0,89,105,0.20),
      0 8px 24px -8px rgba(200,169,126,0.18);
    animation: hs-card-in 0.55s cubic-bezier(0.22, 1, 0.36, 1) both;
    max-height: calc(100vh - 32px);
    overflow: hidden;
  }
  @keyframes hs-card-in {
    from { opacity: 0; transform: translateY(20px) scale(0.97); }
    to   { opacity: 1; transform: translateY(0) scale(1); }
  }

  .hs-logo {
    height: 26px; margin: 0 auto 8px; display: block; filter: contrast(1.2);
    opacity: 0;
    animation: hs-fade-up 0.4s 0.6s ease-out both;
  }

  /* CHECK + RAYS */
  .hs-check-wrap {
    position: relative;
    width: 86px; height: 86px;
    margin: 2px auto 10px;
  }
  .hs-halo {
    position: absolute; inset: -10px;
    border-radius: 50%;
    border: 1.5px dashed rgba(200,169,126,0.55);
    animation: hs-halo-spin 14s linear infinite;
  }
  @keyframes hs-halo-spin { to { transform: rotate(360deg); } }

  .hs-rays { position: absolute; inset: 0; }
  .hs-ray {
    position: absolute; left: 50%; top: 50%;
    width: 2.5px; height: 14px;
    margin-left: -1.25px; margin-top: -52px;
    border-radius: 99px;
    background: linear-gradient(180deg, #c8a97e 0%, transparent 100%);
    transform-origin: 50% 52px;
    opacity: 0;
    animation: hs-ray-burst 0.7s cubic-bezier(0.22, 1, 0.36, 1) both;
  }
  @keyframes hs-ray-burst {
    0%   { opacity: 0; transform: translateY(20px) scale(0.5); }
    60%  { opacity: 1; }
    100% { opacity: 0; transform: translateY(-6px) scale(1); }
  }

  .hs-circle {
    position: absolute; inset: 8px;
    border-radius: 50%;
    background: radial-gradient(circle at 30% 30%, #ffffff 0%, #f0f8f9 100%);
    box-shadow:
      0 0 0 1.5px rgba(200,169,126,0.35),
      0 10px 32px -8px rgba(0,89,105,0.30);
    display: flex; align-items: center; justify-content: center;
    animation: hs-pop 0.5s cubic-bezier(0.22, 1, 0.36, 1) both;
  }
  @keyframes hs-pop {
    0%   { transform: scale(0); opacity: 0; }
    60%  { transform: scale(1.08); opacity: 1; }
    100% { transform: scale(1); }
  }
  .hs-circle svg { width: 44px; height: 44px; }
  .hs-circle-ring {
    stroke-dasharray: 151;
    stroke-dashoffset: 151;
    animation: hs-ring 0.6s 0.15s ease-out forwards;
  }
  @keyframes hs-ring { to { stroke-dashoffset: 0; } }
  .hs-check {
    stroke-dasharray: 60;
    stroke-dashoffset: 60;
    animation: hs-draw 0.45s 0.55s cubic-bezier(0.65, 0, 0.4, 1) forwards;
  }
  @keyframes hs-draw { to { stroke-dashoffset: 0; } }

  /* TITLE BLOCK */
  .hs-eyebrow {
    font-size: 10px; letter-spacing: 0.32em; text-transform: uppercase;
    color: #c8a97e; font-weight: 600;
    margin-bottom: 6px;
    opacity: 0; animation: hs-fade-up 0.5s 0.85s ease-out both;
  }
  .hs-title {
    font-family: 'Playfair Display', serif; font-weight: 400;
    font-size: clamp(1.5rem, 2.4vw, 1.85rem);
    color: #005969; line-height: 1.1; margin-bottom: 6px;
    opacity: 0; animation: hs-fade-up 0.5s 0.95s ease-out both;
  }
  .hs-sub {
    font-size: 13px; color: #6b8b91; line-height: 1.5;
    margin-bottom: 12px; max-width: 380px; margin-left: auto; margin-right: auto;
    opacity: 0; animation: hs-fade-up 0.5s 1.05s ease-out both;
  }
  .hs-name { color: #c8a97e; font-weight: 600; font-style: italic; }

  @keyframes hs-fade-up {
    from { opacity: 0; transform: translateY(8px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  /* ORDER STRIP */
  .hs-order {
    background: linear-gradient(180deg, #fdfbf6 0%, #faf6ec 100%);
    border: 1px solid #eee5d3; border-radius: 12px;
    padding: 12px 16px;
    margin-bottom: 12px;
    text-align: left;
    opacity: 0; animation: hs-fade-up 0.5s 1.15s ease-out both;
  }
  .hs-order-id {
    display: flex; justify-content: space-between; align-items: baseline;
    padding-bottom: 8px; margin-bottom: 8px;
    border-bottom: 1px dashed #e2dccd;
  }
  .hs-order-label {
    font-size: 10px; letter-spacing: 0.18em; text-transform: uppercase;
    color: #6b8b91; font-weight: 600;
  }
  .hs-order-num {
    font-family: 'Playfair Display', serif; font-size: 1.05rem;
    color: #005969; font-weight: 500;
  }
  .hs-order-meta { display: flex; flex-direction: column; gap: 5px; }
  .hs-meta-row {
    display: flex; justify-content: space-between; gap: 14px;
    font-size: 12.5px; color: #6b8b91; align-items: baseline;
  }
  .hs-meta-row > span:last-child {
    color: #1a1a1a; font-weight: 500;
    text-align: right; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    max-width: 70%;
  }
  .hs-meta-row.total {
    margin-top: 4px; padding-top: 8px;
    border-top: 1px solid #eee5d3;
    font-size: 13px; color: #1a1a1a; font-weight: 600;
  }
  .hs-total {
    font-family: 'Playfair Display', serif;
    color: #005969; font-size: 18px; font-weight: 600;
  }

  /* NEXT STEPS — chip row */
  .hs-next {
    display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px;
    margin-bottom: 12px;
    opacity: 0; animation: hs-fade-up 0.5s 1.25s ease-out both;
  }
  .hs-chip {
    display: flex; flex-direction: column; align-items: center; gap: 4px;
    padding: 7px 6px;
    background: #f0f8f9;
    border: 1px solid #d6ebee;
    border-radius: 10px;
    font-size: 10.5px; color: #1a1a1a; font-weight: 500;
    text-align: center; line-height: 1.25;
  }
  .hs-chip-ico {
    width: 24px; height: 24px; border-radius: 50%;
    background: #fff; border: 1px solid #c8e0e4;
    color: #005969;
    display: flex; align-items: center; justify-content: center;
  }
  .hs-chip-ico svg { width: 12px; height: 12px; }

  /* ACTIONS */
  .hs-actions {
    display: flex; gap: 10px; align-items: center; justify-content: center;
    opacity: 0; animation: hs-fade-up 0.5s 1.35s ease-out both;
  }
  .hs-btn-primary, .hs-btn-ghost {
    padding: 11px 18px; border-radius: 10px;
    font-family: inherit; font-size: 12.5px; font-weight: 600;
    text-decoration: none; cursor: pointer;
    transition: background .2s, color .2s, border-color .2s, transform .1s;
    display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  }
  .hs-btn-primary {
    background: #005969; color: #fff;
    letter-spacing: 0.1em; text-transform: uppercase;
    box-shadow: 0 8px 20px -8px rgba(0,89,105,0.55);
  }
  .hs-btn-primary:hover { background: #003d4a; }
  .hs-btn-primary:active { transform: translateY(1px); }
  .hs-btn-ghost {
    background: transparent; color: #6b8b91;
    border-bottom: 1px solid transparent;
    padding: 12px 8px;
  }
  .hs-btn-ghost:hover { color: #005969; }

  /* Smaller screens */
  @media (max-width: 560px) {
    .hira-success { padding: 16px; }
    .hs-card { padding: 22px 22px 22px; border-radius: 16px; }
    .hs-check-wrap { width: 92px; height: 92px; margin-bottom: 10px; }
    .hs-circle svg { width: 46px; height: 46px; }
    .hs-next { grid-template-columns: 1fr; gap: 6px; }
    .hs-chip { flex-direction: row; justify-content: flex-start; padding: 8px 12px; font-size: 12px; }
    .hs-actions { flex-direction: column; gap: 8px; }
    .hs-btn-primary, .hs-btn-ghost { width: 100%; }
  }

  /* Respect reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .hs-confetto, .hs-halo, .hs-ray, .hs-glow { animation: none !important; }
    .hs-circle, .hs-card, .hs-logo, .hs-title, .hs-eyebrow, .hs-sub,
    .hs-order, .hs-next, .hs-actions { animation: none !important; opacity: 1 !important; }
    .hs-circle-ring, .hs-check { stroke-dashoffset: 0 !important; animation: none !important; }
  }
`;
