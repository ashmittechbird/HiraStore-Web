import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useFrappePostCall, useBackendMode, useFrappeAuth } from '@/lib/frappe';
import { useWishlist } from '@/store/wishlist';

export default function SignupPage() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const { call, loading } = useFrappePostCall<{ message: string }>('frappe.core.doctype.user.user.sign_up');
  const location = useLocation();
  const navigate = useNavigate();
  const mode = useBackendMode();
  const { updateCurrentUser } = useFrappeAuth();
  const setWishlistUser = useWishlist(w => w.setUser);

  // Frappe owns password creation — it emails a set-password link and never
  // accepts one over the sign-up endpoint. Without a backend there's no mail to
  // send, so the account is created with a password chosen right here instead.
  const choosesPassword = mode === 'demo';

  const returnParam = new URLSearchParams(location.search).get('return');
  const loginHref = returnParam ? `/login?return=${encodeURIComponent(returnParam)}` : '/login';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!fullName || !email) { setError('Name and email are required'); return; }
    if (choosesPassword && password.length < 6) {
      setError('Choose a password of at least 6 characters');
      return;
    }
    try {
      await call({ email, full_name: fullName, password, redirect_to: '' });
      if (choosesPassword) {
        // The account is signed in straight away — pull the new session into the
        // auth context before navigating, or a guarded page bounces us to login.
        await updateCurrentUser();
        setWishlistUser(email);
        navigate(returnParam && returnParam.startsWith('/') ? returnParam : '/account', { replace: true });
        return;
      }
      setSuccess(true);
    } catch (err: unknown) {
      setError((err as Error).message || 'We could not create the account');
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-head">
          <div className="auth-logo">The Hira Store</div>
          <h1>Create Account</h1>
          <p>Join The Hira Store family</p>
        </div>
        <div className="auth-body">
          {success ? (
            <div style={{ textAlign: 'center', padding: '8px 0 16px' }}>
              <div style={{ fontSize: '32px', marginBottom: '12px' }}>✉️</div>
              <p style={{ color: '#334d52', fontWeight: 500, marginBottom: '8px' }}>Check your email!</p>
              <p style={{ fontSize: '13px', color: '#6b8b91', marginBottom: '24px' }}>
                We sent a link to <strong>{email}</strong>.<br />Click it to set your password and log in.
              </p>
              <Link to={loginHref} className="btn-primary" style={{ display: 'block', textAlign: 'center', textDecoration: 'none' }}>Go to Sign In</Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div className="field">
                <label>Full Name</label>
                <input type="text" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Your name" autoComplete="name" />
              </div>
              <div className="field">
                <label>Email</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="your@email.com" autoComplete="email" />
              </div>
              {choosesPassword && (
                <div className="field">
                  <label>Password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    autoComplete="new-password"
                  />
                </div>
              )}
              {error && <div className="auth-error">{error}</div>}
              <button type="submit" className="btn-primary" disabled={loading}>
                {loading ? 'Creating account…' : 'Create Account'}
              </button>
              <div className="divider">or</div>
              <Link to="/" className="guest-btn">← Back to Store</Link>
            </form>
          )}
        </div>
        <div className="auth-footer">
          Already have an account? <Link to={loginHref}>Sign in</Link>
        </div>
      </div>

      <style>{`
        .auth-page { min-height:80vh;display:flex;align-items:center;justify-content:center;padding:48px 24px;background:#f8fbfc; }
        .auth-card { background:#fff;border-radius:12px;border:1px solid #ddeef1;box-shadow:0 2px 24px rgba(0,26,32,.09);width:100%;max-width:420px;overflow:hidden; }
        .auth-head { padding:36px 36px 28px;border-bottom:1px solid #ddeef1;text-align:center; }
        .auth-logo { font-family:'Playfair Display',serif;font-size:1.6rem;color:#005969;margin-bottom:6px; }
        .auth-head h1 { font-family:'Playfair Display',serif;font-size:1.4rem;font-weight:400;color:#005969;margin-bottom:4px; }
        .auth-head p { font-size:13px;color:#6b8b91; }
        .auth-body { padding:28px 36px 32px; }
        .field { margin-bottom:20px; }
        .field label { display:block;font-size:12px;font-weight:500;color:#6b8b91;text-transform:uppercase;letter-spacing:.06em;margin-bottom:7px; }
        .field input { width:100%;padding:11px 14px;border:1.5px solid #c8e0e4;border-radius:6px;font-size:14px;color:#334d52;background:#fff;transition:border-color .2s,box-shadow .2s;outline:none; }
        .field input:focus { border-color:#005969;box-shadow:0 0 0 3px rgba(0,89,105,.08); }
        .field input::placeholder { color:#6b8b91;font-size:13px; }
        .auth-error { background:#fff1f1;border:1px solid #fca5a5;border-radius:6px;padding:10px 14px;font-size:13px;color:#c0392b;margin-bottom:18px; }
        .btn-primary { width:100%;padding:13px 24px;background:#005969;color:#fff;font-size:14px;font-weight:500;border:none;border-radius:6px;cursor:pointer;letter-spacing:.03em;transition:background .2s; }
        .btn-primary:hover:not(:disabled) { background:#003d4a; }
        .btn-primary:disabled { opacity:.6;cursor:not-allowed; }
        .divider { display:flex;align-items:center;gap:12px;margin:20px 0;color:#6b8b91;font-size:12px; }
        .divider::before,.divider::after { content:'';flex:1;height:1px;background:#c8e0e4; }
        .guest-btn { width:100%;padding:11px 24px;background:transparent;color:#334d52;font-size:13px;border:1.5px solid #c8e0e4;border-radius:6px;cursor:pointer;transition:border-color .2s,background .2s;display:block;text-align:center;text-decoration:none; }
        .guest-btn:hover { border-color:#005969;background:#f0f8f9; }
        .auth-footer { padding:0 36px 28px;text-align:center;font-size:13px;color:#6b8b91; }
        .auth-footer a { color:#005969;text-decoration:none;font-weight:500; }
        .auth-footer a:hover { text-decoration:underline; }
      `}</style>
    </div>
  );
}
