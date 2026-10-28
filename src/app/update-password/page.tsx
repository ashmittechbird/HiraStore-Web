import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { call } from '@/lib/backend';
import { useFrappeAuth } from '@/lib/frappe';
import { AuthShell, AuthError } from '../login/page';

/**
 * Where the links in Frappe's emails land: "Set your password" after signing
 * up, and "Reset your password" after asking for one. Both are
 * /update-password?key=… on the store's own domain.
 *
 * On the live site that path is served by the storefront, not by Frappe, so
 * until this page existed every one of those links opened "Page Not Found" —
 * no new customer could ever finish creating an account.
 *
 * Frappe checks the key, applies its password policy, and signs the person in
 * on success; this page only collects the password and reports the outcome.
 */
export default function UpdatePasswordPage() {
  const [params] = useSearchParams();
  const key = params.get('key') || '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [expired, setExpired] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { updateCurrentUser } = useFrappeAuth();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (password.length < 8) { setError('Use at least 8 characters'); return; }
    if (password !== confirm) { setError('The two passwords don’t match'); return; }
    setLoading(true);
    try {
      // Success answers with where Frappe would send the user next ("me",
      // "/app"); the storefront has its own account page for that.
      await call('frappe.core.doctype.user.user.update_password', { new_password: password, key });
      await updateCurrentUser();
      navigate('/account', { replace: true });
      return;
    } catch (err: unknown) {
      // A used or out-of-date key is answered 410 Gone: "The reset password
      // link has either been used before or is invalid".
      const msg = (err as Error).message || '';
      if (/expired|invalid|used before|\(410\)/i.test(msg)) setExpired(true);
      else setError(msg || 'We could not save that password. Please try again.');
    }
    setLoading(false);
  }

  if (!key || expired) {
    return (
      <AuthShell title="This link has expired" sub="Password links work once, and only for a limited time.">
        <p className="ha-note">
          Ask for a fresh one and we&rsquo;ll email it straight away.
        </p>
        <Link to="/login?forgot=1" className="ha-submit" style={{ textDecoration: 'none' }}>Email me a new link</Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Choose your password" sub="You’ll use it to sign in and to check your orders.">
      <form onSubmit={submit} className="ha-form">
        <label className="ha-field">
          <span>New password</span>
          <div className="ha-pwd-wrap">
            <input
              type={show ? 'text' : 'password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="new-password"
              autoFocus
            />
            <button type="button" className="ha-pwd-toggle" onClick={() => setShow(v => !v)}
              aria-label={show ? 'Hide password' : 'Show password'}>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            </button>
          </div>
        </label>
        <label className="ha-field">
          <span>Confirm password</span>
          <input
            type={show ? 'text' : 'password'}
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            autoComplete="new-password"
          />
        </label>

        {error && <AuthError>{error}</AuthError>}

        <button type="submit" className="ha-submit" disabled={loading}>
          {loading ? <><span className="ha-spin" />Saving…</> : 'Save and sign in'}
        </button>
      </form>
    </AuthShell>
  );
}
