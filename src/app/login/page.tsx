import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useFrappeAuth, useBackendMode } from '@/lib/frappe';
import { DEMO_CREDENTIALS } from '@/lib/demoDb';
import { useWishlist } from '@/store/wishlist';

const SI = `${import.meta.env.BASE_URL}site-images`;
const HIRA_LOGO = `${import.meta.env.BASE_URL}site-images/hira-logo.png`;

function getSafeReturnPath(search: string): string {
  const ret = new URLSearchParams(search).get('return');
  if (ret && ret.startsWith('/') && !ret.startsWith('//')) return ret;
  return '/account';
}

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const setWishlistUser = useWishlist(s => s.setUser);
  const { login, currentUser } = useFrappeAuth();
  const mode = useBackendMode();
  const signupHref = location.search ? `/signup${location.search}` : '/signup';

  useEffect(() => {
    if (currentUser) navigate(getSafeReturnPath(location.search), { replace: true });
  }, [currentUser]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!email || !password) { setError('Username/email and password required'); return; }
    setLoading(true);
    try {
      await login({ username: email, password });
      setWishlistUser(email);
      navigate(getSafeReturnPath(location.search), { replace: true });
    } catch (err: unknown) {
      setError((err as Error).message || 'Invalid username/email or password');
    }
    setLoading(false);
  }

  return (
    <div className="hira-auth">
      {/* LEFT — hero panel */}
      <aside className="ha-hero" aria-hidden="true">
        <img className="ha-hero-img" src={`${SI}/hero-necklace-1.jpg`} alt="" />
        <div className="ha-hero-overlay" />
        <div className="ha-hero-content">
          <div className="ha-monogram">H</div>
          <p className="ha-eyebrow">The Hira Store</p>
          <h2 className="ha-tagline">Everyday Elegance<br />Redefined.</h2>
          <p className="ha-blurb">Handcrafted demi-fine jewelry, made for the moments that matter.</p>
        </div>
      </aside>

      {/* RIGHT — form */}
      <main className="ha-form-wrap">
        <Link to="/" className="ha-back" aria-label="Back to store">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
          </svg>
          Back to Store
        </Link>

        <div className="ha-form-inner">
          <img className="ha-logo" src={HIRA_LOGO} alt="The Hira Store" />
          <h1 className="ha-title">Welcome Back</h1>
          <p className="ha-sub">Sign in to continue your story with Hira.</p>

          {mode === 'demo' && (
            <button
              type="button"
              className="ha-demo-hint"
              onClick={() => { setEmail(DEMO_CREDENTIALS.email); setPassword(DEMO_CREDENTIALS.password); }}
            >
              <span className="ha-demo-title">Demo store — tap to fill the manager account</span>
              <span className="ha-demo-line">{DEMO_CREDENTIALS.email} · {DEMO_CREDENTIALS.password}</span>
            </button>
          )}

          <form onSubmit={handleSubmit} className="ha-form">
            <label className="ha-field">
              <span>Email or Username</span>
              <input
                type="text"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="your@email.com"
                autoComplete="username"
                autoFocus
              />
            </label>

            <label className="ha-field">
              <span>Password</span>
              <div className="ha-pwd-wrap">
                <input
                  type={showPwd ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="ha-pwd-toggle"
                  onClick={() => setShowPwd(p => !p)}
                  aria-label={showPwd ? 'Hide password' : 'Show password'}
                >
                  {showPwd ? (
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M17.94 17.94A10.94 10.94 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A10.94 10.94 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                  ) : (
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  )}
                </button>
              </div>
            </label>

            {error && (
              <div className="ha-error" role="alert">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                {error}
              </div>
            )}

            <button type="submit" className="ha-submit" disabled={loading}>
              {loading ? <><span className="ha-spin" />Signing in…</> : 'Sign In'}
            </button>
          </form>

          <p className="ha-footer">
            New here? <Link to={signupHref}>Create an account</Link>
          </p>
        </div>
      </main>

      <style>{styles}</style>
    </div>
  );
}

const styles = `
  /* Full-bleed overlay — covers navbar + footer so the page is exactly one viewport, no scroll. */
  .hira-auth {
    position: fixed; inset: 0; z-index: 9000;
    display: grid; grid-template-columns: 1.05fr 1fr;
    background: #fdfbf6;
    font-family: 'DM Sans', system-ui, sans-serif;
    color: #1a1a1a;
    overflow: hidden;
  }

  /* LEFT — hero panel */
  .ha-hero { position: relative; overflow: hidden; }
  .ha-hero-img { width: 100%; height: 100%; object-fit: cover; display: block; transform: scale(1.05); animation: kenburns 22s ease-in-out infinite alternate; }
  @keyframes kenburns { from { transform: scale(1.05) translate(0,0); } to { transform: scale(1.12) translate(-1%, -1%); } }
  .ha-hero-overlay {
    position: absolute; inset: 0;
    background: linear-gradient(180deg, rgba(0,40,48,0.50) 0%, rgba(0,40,48,0.30) 50%, rgba(0,40,48,0.65) 100%);
  }
  .ha-hero-content {
    position: absolute; inset: 0;
    display: flex; flex-direction: column; align-items: flex-start; justify-content: flex-end;
    padding: 56px 56px 60px;
    color: #fff;
  }
  .ha-monogram {
    width: 56px; height: 56px; border-radius: 50%;
    background: rgba(255,255,255,0.10);
    border: 1px solid rgba(255,255,255,0.55);
    display: flex; align-items: center; justify-content: center;
    font-family: 'Playfair Display', serif; font-size: 28px; font-weight: 500;
    margin-bottom: 24px;
    backdrop-filter: blur(6px);
  }
  .ha-eyebrow {
    font-size: 11px; letter-spacing: 0.32em; text-transform: uppercase;
    color: #c8a97e; font-weight: 600; margin-bottom: 12px;
  }
  .ha-tagline {
    font-family: 'Playfair Display', serif; font-weight: 400;
    font-size: clamp(1.9rem, 3vw, 2.6rem); line-height: 1.15;
    color: #fff; margin-bottom: 18px;
  }
  .ha-blurb {
    font-size: 14px; line-height: 1.55; max-width: 340px;
    color: rgba(255,255,255,0.85);
  }

  /* RIGHT — form panel */
  .ha-form-wrap {
    position: relative;
    display: flex; flex-direction: column;
    background: #fdfbf6;
    overflow-y: auto;
  }
  .ha-back {
    position: absolute; top: 22px; right: 28px;
    display: inline-flex; align-items: center; gap: 6px;
    font-size: 12px; font-weight: 500; color: #6b8b91;
    text-decoration: none; transition: color .2s;
    letter-spacing: 0.04em;
  }
  .ha-back:hover { color: #005969; }

  .ha-form-inner {
    width: 100%; max-width: 380px;
    margin: auto;
    padding: 56px 32px 40px;
  }
  .ha-logo { display: block; height: 42px; margin: 0 auto 26px; filter: contrast(1.2); }
  .ha-title {
    font-family: 'Playfair Display', serif; font-weight: 400;
    font-size: 1.85rem; line-height: 1.1; color: #005969;
    text-align: center; margin-bottom: 8px;
  }
  .ha-sub {
    text-align: center; font-size: 13px; color: #6b8b91;
    margin-bottom: 28px;
  }

  .ha-form { display: flex; flex-direction: column; gap: 16px; }
  .ha-field { display: block; }
  .ha-field > span {
    display: block;
    font-size: 11px; font-weight: 600; letter-spacing: 0.08em;
    text-transform: uppercase; color: #6b8b91;
    margin-bottom: 6px;
  }
  .ha-field input {
    width: 100%; box-sizing: border-box;
    padding: 11px 14px;
    border: 1.5px solid #e2dccd; border-radius: 8px;
    background: #fff; font-size: 14px; color: #1a1a1a;
    font-family: inherit; outline: none;
    transition: border-color .18s, box-shadow .18s, background .18s;
  }
  .ha-field input::placeholder { color: #a8a298; }
  .ha-field input:focus {
    border-color: #c8a97e;
    box-shadow: 0 0 0 3px rgba(200,169,126,0.18);
    background: #fff;
  }

  .ha-pwd-wrap { position: relative; }
  .ha-pwd-wrap input { padding-right: 42px; }
  .ha-pwd-toggle {
    position: absolute; right: 8px; top: 50%; transform: translateY(-50%);
    width: 30px; height: 30px;
    display: flex; align-items: center; justify-content: center;
    background: transparent; border: 0; cursor: pointer;
    color: #6b8b91; border-radius: 6px; transition: color .15s, background .15s;
  }
  .ha-pwd-toggle:hover { color: #005969; background: rgba(0,89,105,0.05); }

  .ha-demo-hint {
    display: flex; flex-direction: column; gap: 3px; width: 100%;
    padding: 11px 14px; margin-bottom: 20px; cursor: pointer; text-align: left;
    background: #f2fafb; border: 1px dashed #b9d9de; border-radius: 8px;
    font-family: inherit; transition: border-color .18s, background .18s;
  }
  .ha-demo-hint:hover { border-color: #005969; background: #eaf6f8; }
  .ha-demo-title { font-size: 11px; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; color: #5b7a80; }
  .ha-demo-line { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12.5px; color: #005969; }

  .ha-error {
    display: flex; align-items: center; gap: 8px;
    background: #fff5f5; border: 1px solid #fecaca; color: #b91c1c;
    padding: 10px 12px; border-radius: 8px; font-size: 12.5px; line-height: 1.4;
  }

  .ha-submit {
    margin-top: 6px;
    width: 100%; padding: 13px 22px;
    background: #005969; color: #fff;
    border: 0; border-radius: 8px;
    font-family: inherit; font-size: 13px; font-weight: 600;
    letter-spacing: 0.12em; text-transform: uppercase;
    cursor: pointer; transition: background .2s, transform .1s;
    display: inline-flex; align-items: center; justify-content: center; gap: 10px;
  }
  .ha-submit:hover:not(:disabled) { background: #003d4a; }
  .ha-submit:active:not(:disabled) { transform: translateY(1px); }
  .ha-submit:disabled { opacity: .6; cursor: not-allowed; }
  .ha-spin {
    width: 14px; height: 14px;
    border: 2px solid rgba(255,255,255,0.35); border-top-color: #fff;
    border-radius: 50%; animation: spin .7s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  .ha-footer {
    margin-top: 24px;
    text-align: center; font-size: 13px; color: #6b8b91;
  }
  .ha-footer a {
    color: #005969; text-decoration: none; font-weight: 600;
    border-bottom: 1px solid transparent; transition: border-color .15s;
  }
  .ha-footer a:hover { border-bottom-color: #c8a97e; }

  /* Tablet — collapse to single column with image as a slim band */
  @media (max-width: 900px) {
    .hira-auth { grid-template-columns: 1fr; grid-template-rows: 38vh 1fr; }
    .ha-hero-content { padding: 24px 28px 28px; }
    .ha-monogram { width: 44px; height: 44px; font-size: 22px; margin-bottom: 14px; }
    .ha-tagline { font-size: 1.5rem; margin-bottom: 10px; }
    .ha-blurb { font-size: 13px; max-width: none; }
    .ha-form-inner { padding: 32px 24px; max-width: 420px; }
    .ha-logo { height: 34px; margin-bottom: 18px; }
    .ha-title { font-size: 1.55rem; }
    .ha-sub { margin-bottom: 22px; }
  }

  /* Phone — even tighter */
  @media (max-width: 480px) {
    .hira-auth { grid-template-rows: 30vh 1fr; }
    .ha-hero-content { padding: 18px 22px 22px; }
    .ha-back { top: 12px; right: 14px; }
    .ha-form-inner { padding: 22px 20px 28px; }
    .ha-form { gap: 14px; }
    .ha-title { font-size: 1.4rem; }
  }
`;
