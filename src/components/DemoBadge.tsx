import { useEffect, useState } from 'react';
import { useBackendMode } from '@/lib/frappe';
import { DEMO_CREDENTIALS } from '@/lib/demoDb';

/**
 * Quiet marker shown only when no Frappe backend is answering.
 *
 * Everything on the site works in this state, but orders are stored in the
 * browser rather than reaching the merchant — so it needs to be visible
 * somewhere, without getting in the way of a client walkthrough. Dismissing it
 * sticks for the session.
 */
export default function DemoBadge() {
  const mode = useBackendMode();
  const [open, setOpen] = useState(false);
  const [hidden, setHidden] = useState(() => sessionStorage.getItem('hs_demo_badge_off') === '1');

  useEffect(() => {
    if (mode === 'demo') document.body.classList.add('hs-demo');
    else document.body.classList.remove('hs-demo');
  }, [mode]);

  if (mode !== 'demo' || hidden) return null;

  return (
    <>
      <div className={`hs-demo-badge${open ? ' open' : ''}`}>
        <button
          type="button"
          className="hs-demo-pill"
          onClick={() => setOpen(o => !o)}
          aria-expanded={open}
        >
          <span className="hs-demo-dot" aria-hidden="true" />
          Demo mode
        </button>

        {open && (
          <div className="hs-demo-panel" role="region" aria-label="Demo mode details">
            <p>
              No store backend is connected, so the site is running on its built-in
              catalogue. Browsing, cart, wishlist, coupons, checkout and the admin
              panel all work — but <strong>orders are saved in this browser only</strong> and
              never reach the merchant.
            </p>
            <p className="hs-demo-creds">
              Admin sign-in
              <code>{DEMO_CREDENTIALS.email}</code>
              <code>{DEMO_CREDENTIALS.password}</code>
            </p>
            <button
              type="button"
              className="hs-demo-hide"
              onClick={() => {
                sessionStorage.setItem('hs_demo_badge_off', '1');
                setHidden(true);
              }}
            >
              Hide for this session
            </button>
          </div>
        )}
      </div>
      <style>{styles}</style>
    </>
  );
}

const styles = `
  .hs-demo-badge {
    position: fixed; left: 16px; bottom: 16px; z-index: 8000;
    font-family: 'DM Sans', system-ui, sans-serif;
    display: flex; flex-direction: column-reverse; align-items: flex-start; gap: 8px;
  }
  .hs-demo-pill {
    display: inline-flex; align-items: center; gap: 7px;
    padding: 7px 13px; border-radius: 999px; cursor: pointer;
    background: rgba(255,255,255,.94); border: 1px solid #dce9eb;
    backdrop-filter: blur(6px);
    font-size: 11px; font-weight: 600; letter-spacing: .07em; text-transform: uppercase;
    color: #5b7a80; box-shadow: 0 2px 10px rgba(0,89,105,.08);
    transition: color .18s, border-color .18s;
  }
  .hs-demo-pill:hover { color: #005969; border-color: #b9d9de; }
  .hs-demo-dot {
    width: 6px; height: 6px; border-radius: 50%; background: #d9a441;
    box-shadow: 0 0 0 3px rgba(217,164,65,.18);
  }
  .hs-demo-panel {
    width: 290px; padding: 15px 16px; border-radius: 12px;
    background: #fff; border: 1px solid #dce9eb;
    box-shadow: 0 12px 34px rgba(0,89,105,.14);
  }
  .hs-demo-panel p { margin: 0 0 11px; font-size: 12.5px; line-height: 1.6; color: #5b7a80; }
  .hs-demo-panel strong { color: #25454a; font-weight: 600; }
  .hs-demo-creds {
    display: flex; flex-direction: column; gap: 5px;
    font-size: 10.5px !important; font-weight: 600;
    letter-spacing: .08em; text-transform: uppercase; color: #8aa5aa !important;
  }
  .hs-demo-creds code {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 12px; letter-spacing: 0; text-transform: none;
    padding: 5px 8px; border-radius: 5px;
    background: #f2fafb; color: #005969; border: 1px solid #e0f0f2;
  }
  .hs-demo-hide {
    margin-top: 3px; padding: 0; border: 0; background: none; cursor: pointer;
    font-size: 11.5px; color: #8aa5aa; text-decoration: underline; font-family: inherit;
  }
  .hs-demo-hide:hover { color: #005969; }

  @media (max-width: 620px) {
    .hs-demo-badge { left: 12px; bottom: 12px; }
    .hs-demo-panel { width: calc(100vw - 40px); max-width: 290px; }
  }
`;
