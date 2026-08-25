import { useEffect, useRef, useState } from 'react';
import { createBooking, getBookingSlots } from '@/lib/backend';
import { whatsappLink, FALLBACK_SLOTS } from '@/lib/contact';
import { asset } from '@/lib/config';

/**
 * Persistent contact bar: request a video call, or open WhatsApp.
 *
 * The booking form takes a request rather than confirming a slot outright —
 * the store rings back to agree a time. Every request is stored as a real
 * document so it lands in the admin panel and the ERPNext desk instead of an
 * inbox someone has to remember to check.
 */

const MIN_DIGITS = 7;

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default function FloatingActions() {
  const [open, setOpen] = useState(false);
  const [slots, setSlots] = useState<string[]>(FALLBACK_SLOTS);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [bookingId, setBookingId] = useState('');
  const [form, setForm] = useState({
    customer_name: '',
    phone: '',
    email: '',
    preferred_date: '',
    preferred_time: '',
    notes: '',
  });

  const dialogRef = useRef<HTMLDivElement>(null);
  const firstFieldRef = useRef<HTMLInputElement>(null);
  const wa = whatsappLink();

  // Slots are server-side so the store can change its hours without a deploy.
  useEffect(() => {
    let alive = true;
    getBookingSlots()
      .then(s => { if (alive && s.length) setSlots(s); })
      .catch(() => { /* keep the bundled list */ });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    // Focus the first field so the form is usable straight from the keyboard.
    const t = setTimeout(() => firstFieldRef.current?.focus(), 80);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      clearTimeout(t);
    };
  }, [open]);

  function close() {
    setOpen(false);
    setError('');
    // Leave the confirmation up briefly, then reset for the next visitor.
    setTimeout(() => { setBookingId(''); }, 300);
  }

  function update(field: keyof typeof form, value: string) {
    setForm(f => ({ ...f, [field]: value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!form.customer_name.trim()) { setError('Please tell us your name'); return; }
    if (form.phone.replace(/\D/g, '').length < MIN_DIGITS) { setError('Enter a valid phone number'); return; }
    if (form.email && !/.+@.+\..+/.test(form.email)) { setError('That email address looks incomplete'); return; }

    setSending(true);
    try {
      const res = await createBooking(form);
      setBookingId(res.booking_id);
    } catch (err: unknown) {
      setError((err as Error).message || 'We could not send your request. Please try again.');
    }
    setSending(false);
  }

  return (
    <>
      <div className="hs-fab" role="group" aria-label="Contact The Hira Store">
        <button type="button" className="hs-fab-btn hs-fab-call" onClick={() => setOpen(true)}>
          <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true">
            <polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" />
          </svg>
          <span>Book a Video Call</span>
        </button>

        {wa && (
          <a className="hs-fab-btn hs-fab-wa" href={wa} target="_blank" rel="noopener noreferrer">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
              <path d="M17.5 14.4c-.3-.2-1.7-.9-2-1-.3-.1-.5-.1-.7.1-.2.3-.7 1-.9 1.2-.2.2-.3.2-.6.1-.3-.2-1.2-.5-2.3-1.4-.9-.8-1.4-1.7-1.6-2-.2-.3 0-.5.1-.6l.5-.5c.1-.2.2-.3.3-.5 0-.2 0-.4 0-.5 0-.2-.7-1.6-.9-2.2-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.4s1 2.8 1.2 3c.2.2 2 3.1 4.9 4.3.7.3 1.2.5 1.6.6.7.2 1.3.2 1.8.1.6-.1 1.7-.7 1.9-1.4.2-.7.2-1.3.2-1.4-.1-.1-.3-.2-.5-.3z" />
              <path d="M12 2a10 10 0 00-8.5 15.2L2 22l4.9-1.4A10 10 0 1012 2zm0 18.2c-1.6 0-3.1-.4-4.4-1.2l-.3-.2-2.9.8.8-2.8-.2-.3A8.2 8.2 0 1112 20.2z" />
            </svg>
            <span>Chat on WhatsApp</span>
          </a>
        )}
      </div>

      {open && (
        <div className="hs-vc-overlay" onMouseDown={e => { if (e.target === e.currentTarget) close(); }}>
          <div className="hs-vc-modal" ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="hs-vc-title">
            <button type="button" className="hs-vc-close" onClick={close} aria-label="Close">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>

            {bookingId ? (
              <div className="hs-vc-done">
                <div className="hs-vc-tick" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <h2 id="hs-vc-title">Request received</h2>
                <p>
                  Thank you, {form.customer_name.split(' ')[0]}. Our jewellery consultant will
                  call you to confirm a time.
                </p>
                <p className="hs-vc-ref">Reference <strong>{bookingId}</strong></p>
                {wa && (
                  <a className="hs-vc-wa-link" href={wa} target="_blank" rel="noopener noreferrer">
                    Or message us on WhatsApp
                  </a>
                )}
                <button type="button" className="hs-vc-submit" onClick={close}>Done</button>
              </div>
            ) : (
              <>
                <div className="hs-vc-head">
                  <img src={asset('site-images/hira-logo.png')} alt="The Hira Store" />
                  <h2 id="hs-vc-title">Book a Video Call</h2>
                  <p>
                    See the pieces up close with a jewellery consultant. Tell us when suits
                    you and we'll call to confirm.
                  </p>
                </div>

                <form className="hs-vc-form" onSubmit={submit}>
                  <label className="hs-vc-field">
                    <span>Name *</span>
                    <input
                      ref={firstFieldRef}
                      value={form.customer_name}
                      onChange={e => update('customer_name', e.target.value)}
                      placeholder="Your name"
                      autoComplete="name"
                    />
                  </label>

                  <label className="hs-vc-field">
                    <span>Phone *</span>
                    <input
                      value={form.phone}
                      onChange={e => update('phone', e.target.value)}
                      placeholder="+91 98765 43210"
                      inputMode="tel"
                      autoComplete="tel"
                    />
                  </label>

                  <label className="hs-vc-field hs-vc-wide">
                    <span>Email</span>
                    <input
                      type="email"
                      value={form.email}
                      onChange={e => update('email', e.target.value)}
                      placeholder="you@example.com"
                      autoComplete="email"
                    />
                  </label>

                  <label className="hs-vc-field">
                    <span>Preferred date</span>
                    <input
                      type="date"
                      value={form.preferred_date}
                      min={todayISO()}
                      onChange={e => update('preferred_date', e.target.value)}
                    />
                  </label>

                  <label className="hs-vc-field">
                    <span>Preferred time</span>
                    <select
                      value={form.preferred_time}
                      onChange={e => update('preferred_time', e.target.value)}
                    >
                      <option value="">Any time</option>
                      {slots.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </label>

                  <label className="hs-vc-field hs-vc-wide">
                    <span>What are you looking for?</span>
                    <textarea
                      rows={2}
                      value={form.notes}
                      onChange={e => update('notes', e.target.value)}
                      placeholder="Bridal sets, everyday earrings, a gift…"
                    />
                  </label>

                  {error && <div className="hs-vc-error" role="alert">{error}</div>}

                  <button type="submit" className="hs-vc-submit" disabled={sending}>
                    {sending ? 'Sending…' : 'Request a Call'}
                  </button>

                  <p className="hs-vc-note">
                    No payment required. We'll only use these details to arrange your call.
                  </p>
                </form>
              </>
            )}
          </div>
        </div>
      )}

      <style>{styles}</style>
    </>
  );
}

const styles = `
  /* Floating bar — sits opposite the demo-mode chip so the two never overlap. */
  .hs-fab {
    position: fixed; right: 18px; bottom: 18px; z-index: 8500;
    display: flex; flex-direction: column; align-items: flex-end; gap: 10px;
    font-family: 'DM Sans', system-ui, sans-serif;
  }
  .hs-fab-btn {
    display: inline-flex; align-items: center; gap: 9px;
    padding: 12px 18px; border: 0; border-radius: 999px; cursor: pointer;
    font-family: inherit; font-size: 13px; font-weight: 600; letter-spacing: .01em;
    color: #fff; text-decoration: none; white-space: nowrap;
    box-shadow: 0 6px 20px rgba(0,0,0,.16);
    transition: transform .18s ease, box-shadow .18s ease, filter .18s ease;
  }
  .hs-fab-btn:hover { transform: translateY(-2px); box-shadow: 0 10px 26px rgba(0,0,0,.22); filter: brightness(1.06); }
  .hs-fab-btn:active { transform: translateY(0); }
  .hs-fab-call { background: #005969; }
  .hs-fab-wa { background: #25D366; }

  /* Modal */
  .hs-vc-overlay {
    position: fixed; inset: 0; z-index: 9500;
    background: rgba(12,32,36,.55); backdrop-filter: blur(3px);
    display: flex; align-items: center; justify-content: center; padding: 20px;
    animation: hsVcFade .18s ease;
  }
  @keyframes hsVcFade { from { opacity: 0 } to { opacity: 1 } }
  .hs-vc-modal {
    position: relative; width: 100%; max-width: 480px;
    max-height: calc(100vh - 40px); overflow-y: auto;
    background: #fdfbf6; border-radius: 14px; padding: 30px 28px 26px;
    box-shadow: 0 24px 60px rgba(0,0,0,.28);
    font-family: 'DM Sans', system-ui, sans-serif;
    animation: hsVcRise .22s cubic-bezier(.2,.7,.3,1);
  }
  @keyframes hsVcRise { from { opacity: 0; transform: translateY(12px) } to { opacity: 1; transform: none } }
  .hs-vc-close {
    position: absolute; top: 12px; right: 12px; width: 30px; height: 30px;
    display: grid; place-items: center; border: 0; border-radius: 50%;
    background: rgba(0,89,105,.07); color: #5b7a80; cursor: pointer;
  }
  .hs-vc-close:hover { background: rgba(0,89,105,.14); color: #005969; }

  .hs-vc-head { text-align: center; margin-bottom: 20px; }
  .hs-vc-head img { height: 36px; width: auto; margin-bottom: 12px; }
  .hs-vc-head h2 {
    font-family: 'Playfair Display', Georgia, serif; font-weight: 400;
    font-size: 25px; color: #005969; margin: 0 0 7px;
  }
  .hs-vc-head p { font-size: 13.5px; line-height: 1.6; color: #5b7a80; margin: 0; }

  .hs-vc-form { display: grid; grid-template-columns: 1fr 1fr; gap: 13px; }
  .hs-vc-field { display: flex; flex-direction: column; gap: 6px; }
  .hs-vc-wide { grid-column: 1 / -1; }
  .hs-vc-field span {
    font-size: 10.5px; font-weight: 600; letter-spacing: .08em;
    text-transform: uppercase; color: #8aa5aa;
  }
  .hs-vc-field input, .hs-vc-field select, .hs-vc-field textarea {
    width: 100%; padding: 11px 12px; border: 1.5px solid #dfeced; border-radius: 8px;
    font-family: inherit; font-size: 14px; color: #25454a; background: #fff;
    outline: none; transition: border-color .18s; resize: vertical;
  }
  .hs-vc-field input:focus, .hs-vc-field select:focus, .hs-vc-field textarea:focus { border-color: #005969; }
  .hs-vc-field input::placeholder, .hs-vc-field textarea::placeholder { color: #b9cbcf; }

  .hs-vc-error {
    grid-column: 1 / -1; padding: 9px 12px; border-radius: 8px;
    background: #fff1f1; border: 1px solid #fca5a5; color: #c0392b; font-size: 13px;
  }
  .hs-vc-submit {
    grid-column: 1 / -1; margin-top: 4px; padding: 13px 20px;
    border: 0; border-radius: 8px; background: #005969; color: #fff;
    font-family: inherit; font-size: 13.5px; font-weight: 600;
    letter-spacing: .05em; text-transform: uppercase; cursor: pointer;
    transition: background .18s;
  }
  .hs-vc-submit:hover:not(:disabled) { background: #003d4a; }
  .hs-vc-submit:disabled { opacity: .6; cursor: not-allowed; }
  .hs-vc-note {
    grid-column: 1 / -1; margin: 2px 0 0; text-align: center;
    font-size: 11.5px; line-height: 1.5; color: #8aa5aa;
  }

  /* Confirmation */
  .hs-vc-done { text-align: center; padding: 8px 0 4px; }
  .hs-vc-tick {
    width: 52px; height: 52px; margin: 0 auto 14px; border-radius: 50%;
    display: grid; place-items: center; background: #e7f6ef; color: #16a34a;
  }
  .hs-vc-done h2 {
    font-family: 'Playfair Display', Georgia, serif; font-weight: 400;
    font-size: 24px; color: #005969; margin: 0 0 8px;
  }
  .hs-vc-done p { font-size: 13.5px; line-height: 1.6; color: #5b7a80; margin: 0 0 10px; }
  .hs-vc-ref { font-size: 12.5px !important; color: #8aa5aa !important; }
  .hs-vc-ref strong {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    color: #005969; letter-spacing: .04em;
  }
  .hs-vc-wa-link {
    display: inline-block; margin-bottom: 16px; font-size: 13px;
    color: #25D366; font-weight: 600; text-decoration: none;
  }
  .hs-vc-wa-link:hover { text-decoration: underline; }

  @media (max-width: 560px) {
    /* Labels would crowd the viewport on a phone; keep the icons only. */
    .hs-fab { right: 14px; bottom: 14px; gap: 8px; }
    .hs-fab-btn span { display: none; }
    .hs-fab-btn { padding: 13px; border-radius: 50%; }
    .hs-vc-modal { padding: 26px 20px 22px; }
    .hs-vc-form { grid-template-columns: 1fr; }
  }
`;
