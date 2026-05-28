import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useFrappeAuth } from 'frappe-react-sdk';
import { useWishlist } from '@/store/wishlist';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const setWishlistUser = useWishlist(s => s.setUser);
  const { login, currentUser } = useFrappeAuth();

  useEffect(() => {
    if (currentUser) navigate('/account', { replace: true });
  }, [currentUser]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!email || !password) { setError('Username/email and password required'); return; }
    setLoading(true);
    try {
      await login({ username: email, password });
      setWishlistUser(email);
      navigate('/account');
    } catch (err: unknown) {
      setError((err as Error).message || 'Invalid username/email or password');
    }
    setLoading(false);
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-head">
          <div className="auth-logo">The Hira Store</div>
          <h1>Welcome Back</h1>
          <p>Sign in to your account</p>
        </div>
        <div className="auth-body">
          <form onSubmit={handleSubmit}>
            <div className="field">
              <label>Email or Username</label>
              <input type="text" value={email} onChange={e => setEmail(e.target.value)} placeholder="your@email.com or username" autoComplete="username" />
            </div>
            <div className="field">
              <label>Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" autoComplete="current-password" />
            </div>
            {error && <div className="auth-error">{error}</div>}
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? <><span className="btn-spin" style={{ display: 'inline-block' }} />Signing in…</> : 'Sign In'}
            </button>
          </form>
          <div className="divider">or</div>
          <Link to="/" className="guest-btn">← Back to Store</Link>
        </div>
        <div className="auth-footer">
          Don&apos;t have an account? <Link to="/signup">Create one</Link>
        </div>
      </div>

      <style>{authStyles}</style>
    </div>
  );
}

const authStyles = `
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
  .btn-primary { width:100%;padding:13px 24px;background:#005969;color:#fff;font-size:14px;font-weight:500;border:none;border-radius:6px;cursor:pointer;letter-spacing:.03em;transition:background .2s;display:flex;align-items:center;justify-content:center;gap:8px; }
  .btn-primary:hover:not(:disabled) { background:#003d4a; }
  .btn-primary:disabled { opacity:.6;cursor:not-allowed; }
  .btn-spin { width:16px;height:16px;border:2px solid rgba(255,255,255,.4);border-top-color:#fff;border-radius:50%;animation:spin .7s linear infinite; }
  @keyframes spin { to{transform:rotate(360deg)} }
  .divider { display:flex;align-items:center;gap:12px;margin:20px 0;color:#6b8b91;font-size:12px; }
  .divider::before,.divider::after { content:'';flex:1;height:1px;background:#c8e0e4; }
  .guest-btn { width:100%;padding:11px 24px;background:transparent;color:#334d52;font-size:13px;font-weight:400;border:1.5px solid #c8e0e4;border-radius:6px;cursor:pointer;transition:border-color .2s,background .2s;display:block;text-align:center;text-decoration:none; }
  .guest-btn:hover { border-color:#005969;background:#f0f8f9; }
  .auth-footer { padding:0 36px 28px;text-align:center;font-size:13px;color:#6b8b91; }
  .auth-footer a { color:#005969;text-decoration:none;font-weight:500; }
  .auth-footer a:hover { text-decoration:underline; }
`;
